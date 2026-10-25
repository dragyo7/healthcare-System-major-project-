# USER STORIES & DEMONSTRATION WORKFLOWS — Clinical Decision Support System

> **Project**: Modular AI-Powered Clinical Decision Support (CDS) System
> **Target Audience**: Clinical Evaluators, System Administrators, QA Engineers, and Demo Presenters
> **Verification Date**: 2026-10-25
> **Evidence Directory**: `audit_evidence/second_pass_audit_20261025/`

---

## 1. System Roles & Access Matrix

The platform implements strict Role-Based Access Control (RBAC) backed by JWT authorization and database foreign key isolation:

| Role | Intended User | Key Capabilities | Boundary & Invariants |
|---|---|---|---|
| **Doctor** (`DOCTOR`) | Attending Physician, Clinician | View clinical dossiers, screen drug interactions, review AI medicine suggestions, author & sign prescriptions, author discharge directives, override non-hard-stop DDIs with documented clinical rationale. | Cannot approve prescriptions with active allergy contraindications (`cannot_override: true`). Must review and sign all OCR extractions before persistence. |
| **Patient** (`PATIENT`) | Individual Patient | View personal medical history, active prescriptions, doctor-authored discharge summary, download authorized prescription PDFs, interact with post-discharge recovery assistant. | Strictly isolated to own medical records (HTTP 403 on BOLA cross-patient queries). Assistant cannot invent unrecorded care directives. |
| **Receptionist** (`RECEPTIONIST`) | Hospital Desk Staff | Register new patients, manage appointment schedules, check-in patients, update non-clinical demographics. | Zero access to clinical prescription authoring or medication safety overrides. |

---

## 2. Demonstration Workflows & Step-by-Step Walkthroughs

### Workflow 1: Doctor Login, Dossier Review & Safe Prescription Authoring

#### Clinical Story
*As an attending physician, I want to review a patient's clinical history, enter an intended medication regimen, have the system deterministically screen for severe interactions and allergies, evaluate evidence-based alternatives, and generate a signed prescription PDF.*

#### Preconditions
- Express backend running on port 5000 connected to `rag_healthcare_test`.
- FastAPI CDS gateway running on port 8000.
- Vite frontend running on port 5173.
- Patient Aarav Patil (ID: 1) has active prescription for Clarithromycin.

#### Step-by-Step Procedure
1. Navigate to `http://localhost:5173/login`.
2. Click **Doctor** role card.
3. Enter email `doctor@gmail.com` and password `doctor123`. Click **Sign In**.
4. On the Doctor Dashboard, click **Prescriptions** in the left navigation sidebar.
5. In the Patient selector dropdown, choose **Aarav Patil (Patient ID #1)**. Observe active medications (`Clarithromycin 500mg`) and allergies.
6. Under **New Medication Order**, enter:
   - Medication: `Atorvastatin`
   - Dose: `40 mg`
   - Frequency: `Once daily at bedtime`
   - Duration: `30 days`
7. Click **Check Drug Safety**.
8. **Observe Safety Screen Alert**:
   - The safety engine immediately intercepts the severe CYP3A4 Drug-Drug Interaction (`RUL-INT-007`): *"Atorvastatin co-administration with Clarithromycin significantly increases statin plasma concentrations, elevating risk of rhabdomyolysis and severe myopathy."*
   - Severity: `CRITICAL / SEVERE`.
   - Override Required: The clinician must provide an explicit clinical monitoring rationale to proceed.
9. **Inspect Medicine Suggestions**:
   - Below the alert, the suggestion engine proposes evidence-based alternatives that bypass the CYP3A4 pathway:
     - `Rosuvastatin 10mg` (Minimal CYP3A4 metabolism)
     - `Pravastatin 20mg` (Sulfation pathway)
   - Click **Accept Alternative: Rosuvastatin**.
   - Notice that dose is revalidated and reset for clinician confirmation.
10. If maintaining Atorvastatin with clinical justification, enter the override reason: *"Patient requires high-intensity statin; temporary dose reduction with weekly serum CK monitoring."*
11. Click **Approve & Save Prescription**.
12. Click **Download PDF** to verify live PDFKit generation containing the digital signature, clinic header, prescription ID, and dosage instructions.

#### APIs Involved
- `POST /api/auth/login` (Returns doctor JWT)
- `GET /api/doctor/patients/1/dossier`
- `POST /api/doctor/prescriptions/screen` $\to$ `POST http://127.0.0.1:8000/cds/screen-prescription`
- `POST /api/doctor/prescriptions`
- `GET /api/doctor/prescriptions/:id/pdf`

#### Pass/Fail Verification Criteria
- [x] Severe DDI intercepted in < 15ms.
- [x] Un-overridden submission returns HTTP 422.
- [x] Overridden submission persists clinical rationale in audit log.
- [x] Valid PDF generated without server error.
- **Evidence Screenshot**: `audit_evidence/second_pass_audit_20261025/atorvastatin_clarithromycin_safety_1792937263898.png`

---

### Workflow 2: Allergy Hard Stop Enforcement (Non-Overridable Safety Invariant)

#### Clinical Story
*As a clinical safety officer, I want to verify that entering a medication to which the patient has a documented allergy triggers an absolute, non-overridable hard stop that blocks submission both in the UI and at the server boundary.*

#### Preconditions
- Authenticated as Doctor (`doctor@gmail.com`).
- Target Patient: Terrilyn Murphy (Synthea ID: 149), who has documented `Aspirin` allergy.

#### Step-by-Step Procedure
1. Navigate to `/doctor/prescriptions`.
2. Select **Terrilyn Murphy (Patient ID #149)**.
3. In the prescription form, enter:
   - Medication: `Aspirin`
   - Dose: `81 mg`
   - Frequency: `Once daily`
   - Duration: `30 days`
4. Click **Check Drug Safety**.
5. **Observe Immediate Hard Stop**:
   - Red banner: **ALLERGY CONTRAINDICATION DETECTED**.
   - Message: *"Patient has documented allergy to Aspirin (substance). Administration poses acute risk of anaphylaxis or severe hypersensitivity reaction."*
   - Status: `cannot_override: true`.
   - The **Approve Prescription** button is disabled, and override input fields are hidden.
6. Attempt direct HTTP API bypass via curl/Postman:
   - Server returns `422 Unprocessable Entity` with `{"error": "Allergy contraindication cannot be overridden"}`.

#### Pass/Fail Verification Criteria
- [x] Hard stop triggered deterministically.
- [x] UI prevents approval submission.
- [x] Direct backend request without UI is rejected with 422.
- [x] Zero allergic prescription records created in database.
- **Evidence Screenshot**: `audit_evidence/second_pass_audit_20261025/allergy_hard_stop_1792937328395.png`

---

### Workflow 3: Doctor Post-Discharge Care Plan Authoring

#### Clinical Story
*As an attending physician discharging an inpatient, I want to record clear, structured post-procedure instructions, wound care protocols, medication schedules, and follow-up directives so that the patient can recover safely.*

#### Step-by-Step Procedure
1. Log in as Doctor (`doctor@gmail.com` / `doctor123`).
2. Navigate to **Post-Discharge Care** in the Doctor Portal sidebar.
3. Select patient **Aarav Patil (Patient ID #1)**.
4. Fill in the structured discharge form:
   - **Admission Diagnosis**: *Acute Hypertensive Crisis & Unstable Angina (Resolved)*
   - **Discharge Summary**: *Patient stabilized on oral antihypertensive therapy. Normal cardiac enzymes on serial testing.*
   - **Medication Instructions**: *Amlodipine 5mg Once Daily every morning. Discontinue OTC decongestants.*
   - **Wound Care Instructions**: *Keep surgical catheter puncture site clean and dry for 48 hours. Inspect daily for erythema or discharge.*
   - **Dietary Directives**: *Low-sodium cardiac diet (< 2g sodium/day). Adequate hydration.*
   - **Follow-up Directives**: *Outpatient cardiology clinic review in 14 days.*
5. Click **Publish & Authorize Discharge Plan**.
6. The record is stored in the MySQL `discharges` table with a timestamp and clinician ID.

#### Pass/Fail Verification Criteria
- [x] Form fields validated for non-empty clinical content.
- [x] Record persisted in database with authorized clinician identity.
- [x] Immediately available to authorized patient portal.
- **Evidence Screenshot**: `audit_evidence/second_pass_audit_20261025/doctor_discharge_plan_1792937363888.png`

---

### Workflow 4: Patient Recovery CDS Assistant (Grounded Against Saved Plan)

#### Clinical Story
*As a discharged patient (Aarav Patil), I want to ask my recovery assistant questions about my care and receive answers that are strictly grounded in my doctor's instructions, rather than generic medical internet advice.*

#### Step-by-Step Procedure
1. Navigate to `http://localhost:5173/login`.
2. Select **Patient** role card.
3. Enter email `patient@gmail.com` and password `patient123`. Click **Sign In**.
4. On the Patient Dashboard, observe:
   - **Discharge Care Directives**: Displays the authorized diagnosis, medications, and follow-up appointment date.
5. Click **Post-Discharge Assistant** in the navigation bar.
6. In the query box, type:
   > *"What care should I take based on my discharge instructions?"*
7. Click **Send**.
8. **Observe Assistant Output**:
   - The assistant answers: *"Based on your authorized hospital discharge care plan: You are prescribed Amlodipine 5mg once daily every morning. Keep surgical catheter puncture site clean and dry for 48 hours. Follow low-sodium cardiac diet (<2g sodium/day) and attend your outpatient cardiology review in 14 days."*
   - Verification Status: `grounded`.
   - Metadata / Citation: `[Discharge Directives - Dr. Sharma, Cardiology]`.
   - Pipeline Mode: `discharge_care_grounding`.

#### Pass/Fail Verification Criteria
- [x] Response contains specific instructions authored by doctor.
- [x] Does not hallucinate generic or unprescribed medications.
- [x] Zero exposure of internal verifier diagnostics (`[INVALID_CITATION]`).
- **Evidence Screenshot**: `audit_evidence/second_pass_audit_20261025/patient_recovery_grounded_1792937454316.png`

---

### Workflow 5: Synthea Patient Honest Absence Disclosure

#### Clinical Story
*As an imported Synthea patient (Terrilyn Murphy) who has historical health records but NO hospital discharge plan on file, I want the CDS assistant to honestly inform me that no instructions exist, rather than fabricating a recovery plan or providing misleading generic advice.*

#### Step-by-Step Procedure
1. Navigate to `http://localhost:5173/login`.
2. Select **Patient** role card.
3. Enter email `synthea.terrilyn.murphy@demo.local` and password `patient123`. Click **Sign In**.
4. On the Dashboard:
   - Notice: **Discharge Summary & Care Directives**: *"No discharge summary on file for your admission."*
   - Notice: **Current Prescriptions**: *"No active prescriptions found."*
5. Click **Medical History**:
   - Observe imported Synthea conditions: *Hypertension*, *Type 2 Diabetes*, *Hyperlipidemia*.
   - Observe documented allergies: *Aspirin*, *Latex*, *Bee venom*.
6. Click **Post-Discharge Assistant**.
7. In the chat box, type:
   > *"What care should I take?"*
8. Click **Send**.
9. **Observe Honest Disclosure**:
   - The assistant states: *"No hospital discharge plan or post-procedure care instructions were found on file for your record. Please consult your treating physician or care team for personalized medical advice."*
   - Policy Status: `abstained_policy`.
   - Zero hallucinated care instructions.

#### Pass/Fail Verification Criteria
- [x] Honest disclosure rendered without error.
- [x] System does not substitute generic DailyMed RAG for missing personal instructions.
- [x] Demonstrates Synthea historical data is distinguished from active clinical care plans.
- **Evidence Screenshot**: `audit_evidence/second_pass_audit_20261025/terrilyn_assistant_discharge_1792939248984.png`

---

### Workflow 6: General Medical Reference CDS Inquiry

#### Clinical Story
*As a patient or clinician, I want to ask general pharmacological questions about medications and receive verified, citation-backed answers from the frozen DailyMed knowledge base.*

#### Step-by-Step Procedure
1. In the Patient or Doctor CDS Assistant, enter:
   > *"What is Metformin used for?"*
2. Click **Send**.
3. **Observe Grounded Output**:
   - The system detects general pharmacological intent.
   - Routes request to the frozen hybrid retrieval pipeline (FAISS dense + BM25 sparse + RRF k=60 + Cross-Encoder reranker).
   - Generates answer grounded in DailyMed FDA monographs.
   - Shows verified citations: `[1] DailyMed - Metformin Hydrochloride Tablet Monograph (FDA Section: Indications & Usage)`.
   - Displays mandatory clinical disclaimer.

#### Pass/Fail Verification Criteria
- [x] Fast hybrid retrieval (< 65ms).
- [x] Citations link to DailyMed chunks.
- [x] Safety verifier validates proposition grounding before answer delivery.
- **Evidence Screenshot**: `audit_evidence/second_pass_audit_20261025/terrilyn_metformin_eval_1792939309046.png`

---

### Workflow 7: Receptionist Registration & Appointment Flow

#### Clinical Story
*As a hospital receptionist, I want to register a new incoming patient and book an appointment with an available physician.*

#### Step-by-Step Procedure
1. Navigate to `http://localhost:5173/login`.
2. Select **Receptionist** role card.
3. Enter email `receptionist@gmail.com` and password `receptionist123`. Click **Sign In**.
4. On the Receptionist Dashboard, click **Register New Patient**.
5. Fill in demographics: Full Name, Date of Birth, Gender, Contact Phone, and Emergency Contact.
6. Click **Submit Registration**.
7. Navigate to **Appointments**.
8. Select registered patient, choose attending physician (`Dr. Sharma`), select date and time slot.
9. Click **Confirm Appointment**.
10. The appointment appears in the live doctor consultation queue.

#### Pass/Fail Verification Criteria
- [x] Patient registered with immediate unique ID.
- [x] Appointment visible on both receptionist schedule and doctor dashboard.
- [x] Receptionist cannot view or alter clinical prescription safety screens.
- **Evidence Screenshots**:
  - `audit_evidence/final_release_gate_20261025/23_receptionist_dashboard_appointments.png`
  - `audit_evidence/final_release_gate_20261025/24_hindi_language_interface.png`

---

### Workflow 8: Negative Security Matrix & BOLA Defense

#### Clinical Story
*As a security auditor, I want to confirm that broken object level authorization (BOLA) attempts, cross-patient data access, and unauthenticated requests are strictly rejected.*

#### Test Scenarios & Outcomes
1. **Cross-Patient Query (BOLA)**:
   - Patient Terrilyn Murphy (#149) sends request to `/api/patient/cds` passing `patient_id: 1` (Aarav Patil).
   - *Outcome*: Server enforces JWT token identity matching URL parameter. Returns `403 Forbidden` (`"Access denied: cannot query another patient's medical records"`).
2. **Unauthenticated Access**:
   - Anonymous HTTP GET to `/api/patient/prescriptions` without `Authorization: Bearer <token>`.
   - *Outcome*: Returns `401 Unauthorized`.
3. **Role Elevation Attempt**:
   - Patient token attempts to access `POST /api/doctor/prescriptions`.
   - *Outcome*: Returns `403 Forbidden` (`"Doctor privileges required"`).
4. **Unsupported Chemical Inquiry**:
   - Querying `"fictitiousexoticchem12345"` in CDS.
   - *Outcome*: Safe fail-closed abstention (`abstained_policy`) with zero hallucination.

---

### Workflow 9: Self-Service Account Recovery & Cryptographic Password Reset

#### Clinical Story
*As an authorized patient or clinician who forgot my password, I want to submit my registered institutional email, receive an anti-enumeration confirmation, obtain a secure single-use time-limited reset authorization, and update my credentials safely.*

#### Step-by-Step Procedure
1. On `http://localhost:5173/login`, click **Forgot Password?**.
2. Enter registered email `aarav@gmail.com`. Click **Request Password Assistance**.
3. **Observe Anti-Enumeration Notice**: Regardless of whether the email exists, a uniform success confirmation appears. In local prototype mode, a single-use SHA-256 token authorization link is generated (`/reset-password?token=...`).
4. Click **Complete Password Reset** to open the reset interface.
5. Enter new password: `NewPassword123!` and confirm password.
6. Click **Update Password**.
7. Observe immediate update confirmation.
8. Attempting to reload or reuse the same token URL returns: *"This password reset token is invalid, expired, or has already been used."*
9. Log in with `aarav@gmail.com` and `NewPassword123!` $\to$ Authenticates successfully into Patient Dashboard.
10. **Evidence Screenshots**:
    - `audit_evidence/final_release_gate_20261025/06_forgot_password_submission.png`
    - `audit_evidence/final_release_gate_20261025/07_password_reset_page.png`

---

### Workflow 10: Standardized Physician Directory & Search Filtering

#### Clinical Story
*As a receptionist or patient, I want to search and discover approved physicians by name, specialty, or license number, ensuring test artifacts, duplicate profiles, and unapproved personnel are excluded.*

#### Step-by-Step Procedure
1. Navigate to Receptionist Physician Directory at `http://localhost:5173/receptionist/doctors`.
2. Inspect the roster: 4 canonical approved clinicians are displayed with verified credentials:
   - **Dr. Rahul Sharma**: Cardiology, MBBS MD Cardiology, MCI-2022-77182, 14 yrs experience.
   - **Dr. Priya Nair**: General Medicine, MBBS MD Internal Medicine, MCI-2023-88291, 8 yrs experience.
   - **Dr. Elena Vance**: Cardiology, MBBS MD DM Cardiology, MCI-2024-99120, 9 yrs experience.
   - **Dr. Kavita Verma**: Neurology, MBBS DM Neurology, NMC-449036-NEURO, 11 yrs experience.
3. In the search box, type `Cardiology`.
4. Observe real-time filtering displaying only Dr. Rahul Sharma and Dr. Elena Vance.
5. In the search box, type `Neurology`.
6. Observe filtering displaying Dr. Kavita Verma.
7. Click **Clear** to restore full roster.
8. **Evidence Screenshot**:
   - `audit_evidence/final_release_gate_20261025/09_clean_doctor_directory_search.png`

---

## 3. Demo Readiness Checklist

Before presenting a live demonstration, verify each item:

- [x] **MySQL 8.0** active on port 3306 with `rag_healthcare_test` accessible.
- [x] **FastAPI CDS Gateway** active on port 8000 (2,204 chunks indexed, healthy status).
- [x] **Express EHR Backend** active on port 5000 (connected to test database).
- [x] **Unified Frontend** active on port 5173 with dark/light mode and responsive layout.
- [x] **Synthea Cohort** verified (5 patients imported with real historical FHIR data).
- [x] **Doctor Safety Screening** ready to demonstrate Atorvastatin + Clarithromycin DDI and Aspirin allergy hard stop.
- [x] **Discharge Assistant** ready to demonstrate grounded care (Aarav Patil) and honest absence (Terrilyn Murphy).
- [x] **Account Lifecycle** ready to demonstrate forgot password, token reset, and replay prevention.
- [x] **Doctor Directory** cleaned and standardized with 4 approved physicians.
- [x] **26 Browser Evidence Screenshots** verified and indexed in `audit_evidence/final_release_gate_20261025/evidence_manifest.json`.
