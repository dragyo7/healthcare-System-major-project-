# FLOW.md — Execution & Data-Flow Map

> **Document Purpose**: Exact, function-by-function execution and data-flow map across all subsystems.
> **Repository**: `dragyo7/healthcare-System-major-project-`
> **Primary Branch**: `main`<br>
> **Audited Documentation Baseline**: `ac26bb7`<br>
> **Frozen RAG Implementation Baseline**: Commit `497a547` (V2.10 Hard-Frozen)<br>
> **Rule**: Every step reflects real, verified source code, exact file paths, and exact symbols.

---

## Table of Workflows

1. [Application Startup & Service Dependencies](#1-application-startup--service-dependencies)
2. [Login, JWT Issuance & Role-Based Access Control](#2-login-jwt-issuance--role-based-access-control)
3. [Receptionist Patient Intake & Cryptographic Account Activation](#3-receptionist-patient-intake--cryptographic-account-activation)
4. [Doctor Patient Dossier & Documented Allergy Retrieval](#4-doctor-patient-dossier--documented-allergy-retrieval)
5. [Deterministic Drug Interaction & Allergy Screening (<15ms)](#5-deterministic-drug-interaction--allergy-screening-15ms)
6. [Doctor Prescription Authoring, Advisory Locking & Deduplication](#6-doctor-prescription-authoring-advisory-locking--deduplication)
7. [Prescription PDF Ownership Verification & Binary Streaming](#7-prescription-pdf-ownership-verification--binary-streaming)
8. [Prescription Image OCR Upload & Mandatory Clinician Confirmation](#8-prescription-image-ocr-upload--mandatory-clinician-confirmation)
9. [Post-Discharge Directive Authoring & Retrieval](#9-post-discharge-directive-authoring--retrieval)
10. [Patient Post-Discharge Assistant & Fail-Closed Grounding](#10-patient-post-discharge-assistant--fail-closed-grounding)
11. [Clinical RAG Query (Retrieval, Rerank, Generate, Verify)](#11-clinical-rag-query-retrieval-rerank-generate-verify)
12. [Indic Multilingual Canonicalization & Localized Output](#12-indic-multilingual-canonicalization--localized-output)
13. [Negative & Security Defense Paths](#13-negative--security-defense-paths)
14. [Academic Ethics Disclosures, Explicit Consent & About Portal](#14-academic-ethics-disclosures-explicit-consent--about-portal)
15. [Current Change Section](#15-current-change-section)

---

## 1. Application Startup & Service Dependencies

**Trigger**: Running `powershell -ExecutionPolicy Bypass -File ./scripts/start_platform.ps1` or `npm start`.

```mermaid
graph TD
    Start["Master Script: start_platform.ps1"] --> CheckMySQL{"Check MySQL (3306)"}
    CheckMySQL -->|Not Listening| BootMySQL["mysqld.exe --port=3306"]
    CheckMySQL -->|Listening| BootFastAPI
    BootMySQL --> BootFastAPI["python -m uvicorn rag_module.api:app --port 8000"]
    BootFastAPI --> HealthFastAPI{"GET http://127.0.0.1:8000/health"}
    HealthFastAPI -->|HTTP 200| BootExpress["node server.js (Port 5000)"]
    BootExpress --> HealthExpress{"GET http://localhost:5000/health"}
    HealthExpress -->|HTTP 200| BootVite["npm run dev in frontend/ (Port 5173)"]
    BootVite --> Ready["Open Browser: http://localhost:5173"]
```

### Exact Call Path:
1. `scripts/start_platform.ps1` validates port availability using `Get-NetTCPConnection`.
2. Starts MySQL daemon on port 3306 pointing to `scratch/mysql_data/`.
3. Launches FastAPI gateway: `rag_module/api.py` loads `cds_module/router.py`, initializes `RAGService` (`rag_module/service.py`), and pre-warms FAISS index vectors (`index_v2.bin`).
4. Launches Express gateway: `Portal Major P/Bhumi/Doctor portal/backend/server.js` imports `src/app.js`, initializes MySQL connection pool (`src/config/db.js`), and registers CORS, rate limiters, and routes.
5. Launches Frontend: `frontend/vite.config.js` boots Vite development server on port 5173.

---

## 2. Login, JWT Issuance & Role-Based Access Control

**Entry Point**: `frontend/src/pages/Auth/Login.jsx` (`handleSubmit`)
**Trigger**: User enters email, password, and selects role (`doctor`, `patient`, `receptionist`).

### Execution Path:
1. `Login.jsx` calls `api.post('/api/auth/<role>/login', { email, password })` defined in `frontend/src/api/authApi.js`.
2. Request hits Express router: `src/routes/authRoutes.js` $\to$ `authRateLimiter` (`src/middleware/rateLimiter.js`).
3. Express controller executes `doctorLogin`, `patientLogin`, or `receptionistLogin` in `src/controllers/authController.js`:
   - Queries `users` table: `SELECT * FROM users WHERE email = ? AND role = ?`.
   - Compares password with `bcrypt.compare(password, user.password_hash)`.
   - If valid, signs JWT: `jwt.sign({ id: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h' })`.
   - Returns `{ token, user: { id, email, role, name } }`.
4. Frontend `AuthContext.jsx` stores token in `localStorage.getItem('token')` and updates React state.
5. `AppRoutes.jsx` `RootRedirect` reads `user.role` and navigates to role workspace:
   - `doctor` $\to$ `/doctor` (guarded by `RoleGuard allowedRoles={['doctor']}`)
   - `patient` $\to$ `/patient` (guarded by `RoleGuard allowedRoles={['patient']}`)
   - `receptionist` $\to$ `/receptionist` (guarded by `RoleGuard allowedRoles={['receptionist']}`)

---

## 3. Receptionist Patient Intake & Cryptographic Account Activation

**Entry Point**: `frontend/src/pages/Receptionist/Patients.jsx` (`handleRegisterPatient`)
**Trigger**: Receptionist fills demographic form (Name, DOB, Gender, Blood Group, Phone) and clicks "Register Patient".

```mermaid
sequenceDiagram
    autonumber
    actor Rec as Receptionist
    participant UI as Receptionist UI (5173)
    participant GW as Express Gateway (5000)
    participant DB as MySQL DB (3306)
    actor Pat as Patient

    Rec->>UI: Submit Patient Form
    UI->>GW: POST /api/receptionist/patients (JWT)
    Note over GW: Input Validation: DOB (1900-today), 10-digit phone
    GW->>DB: INSERT INTO patients (name, dob, gender, blood_group, contact)
    Note over GW: Generate crypto.randomBytes(32).toString('hex')
    GW->>DB: INSERT INTO account_activations (token, patient_id, expires_at = +48h)
    GW-->>UI: HTTP 201 Created { patient_id: 128, activation_token: "..." }
    Rec->>Pat: Communicates URL: http://localhost:5173/activate?token=...
    Pat->>UI: Opens /activate?token=... & enters password
    UI->>GW: POST /api/auth/patient/activate { token, password }
    GW->>DB: SELECT * FROM account_activations WHERE token = ? AND used_at IS NULL
    GW->>DB: INSERT INTO users (email, password_hash, role='patient')
    GW->>DB: UPDATE patients SET user_id = ? WHERE id = ?
    GW->>DB: UPDATE account_activations SET used_at = NOW() WHERE token = ?
    GW-->>UI: HTTP 200 OK ("Account activated successfully")
```

### Exact Symbols & Files:
- Controller: `src/controllers/receptionistController.js:registerPatient`
- Date Validation: Lines 71–85 (`dobDate < minDate || dobDate > today`)
- Phone Sanitization: Line 88 (`emergency_contact.replace(/\D/g, '').slice(-10)`)
- Token Generation: `crypto.randomBytes(32).toString('hex')`
- Activation Controller: `src/controllers/authController.js:patientActivate`

---

## 4. Doctor Patient Dossier & Documented Allergy Retrieval

**Entry Point**: `frontend/src/pages/Doctor/Patients.jsx`
**Trigger**: Doctor selects patient from roster.

### Execution Path:
1. Calls `GET /api/doctor/patients/:patientId` with JWT Bearer header.
2. Route guarded by `authenticateDoctor` (`src/middleware/authMiddleware.js`).
3. Express controller `getPatientDetails` (`src/controllers/doctorController.js:77`):
   - Executes SQL: `SELECT p.*, mh.condition_name, mh.allergies, mh.notes FROM patients p LEFT JOIN medical_histories mh ON p.id = mh.patient_id WHERE p.id = ?`.
4. Formats patient dossier object including allergy string (e.g. `Penicillin`).
5. Returns HTTP 200 with JSON dossier payload.
6. Frontend renders red alert badge in patient header: `Allergy: Penicillin`.

---

## 5. Deterministic Drug Interaction & Allergy Screening (<15ms)

**Entry Point**: `frontend/src/pages/Doctor/Prescriptions.jsx` (`handleScreenMedications`)
**Trigger**: Doctor adds candidate drugs (`Atorvastatin` + `Clarithromycin`) in prescription form.

### Execution Path:
1. Frontend dispatches `POST /api/doctor/prescriptions/screen` with body `{ patient_id: 1, medications: ["Atorvastatin", "Clarithromycin"] }`.
2. Guarded by `authenticateDoctor`.
3. Express controller `screenPrescriptionSafety` (`src/controllers/doctorController.js:462`):
   - Fetches patient's documented allergies: `SELECT allergies FROM medical_histories WHERE patient_id = ?`.
   - Checks candidate medications against allergy list via string matching.
   - Forwards medications to FastAPI: `POST http://127.0.0.1:8000/cds/screen-prescription`.
4. FastAPI route `screen_prescription_endpoint` (`cds_module/router.py:44`) calls `CDSOrchestrator.screen_prescriptions` (`cds_module/orchestrator.py:270`):
   - Invokes `drug_module.interaction_engine.InteractionEngine.check_interactions(medications)`.
   - Checks pairwise drug combinations against `data/rules/medication_interactions/rules.json`.
   - Evaluates Rule `RUL-INT-007`: Severity `major`, mechanism `CYP3A4 inhibition increases statin toxicity`.
   - Returns in **< 15ms** without invoking any LLM inference.
5. Express combines DDI alerts with allergy warnings and returns HTTP 200.
6. Frontend displays interactive red alert box with severity badge and clinical guidance.

---

## 6. Doctor Prescription Authoring, Advisory Locking & Deduplication

**Entry Point**: `frontend/src/pages/Doctor/Prescriptions.jsx` (`handleSavePrescription`)
**Trigger**: Doctor clicks "Authorize & Persist Prescription".

```mermaid
sequenceDiagram
    autonumber
    actor Doc as Doctor
    participant UI as Prescriptions UI
    participant GW as Express Gateway
    participant DB as MySQL DB

    Doc->>UI: Click "Authorize Prescription"
    UI->>GW: POST /api/doctor/prescriptions (JWT)
    Note over GW: Allergy Contraindication Gate
    GW->>DB: Check allergies (Penicillin check)
    alt Patient Allergic to Candidate Drug
        GW-->>UI: HTTP 422 Unprocessable Entity ("Prescription rejected: Patient allergic")
    else Medication Safe
        Note over GW: Session Advisory Lock: rx_lock_doc1_pat1
        GW->>DB: SELECT GET_LOCK('rx_lock_doc1_pat1', 10)
        DB-->>GW: Lock Acquired (1)
        GW->>DB: Deduplication Check (Same drugs within 30s)
        alt Duplicate Request (Race Condition)
            GW-->>UI: HTTP 200 OK (Existing Rx #101 Returned)
        else Valid New Submission
            GW->>DB: INSERT INTO prescriptions (doctor_id, patient_id, notes)
            GW->>DB: INSERT INTO prescription_items (prescription_id, drug_name, dosage, freq)
            GW->>DB: SELECT RELEASE_LOCK('rx_lock_doc1_pat1')
            GW-->>UI: HTTP 201 Created { prescription_id: 101, status: "created" }
        end
    end
```

### Exact Symbols & Files:
- Controller: `src/controllers/doctorController.js:createPrescription` (Lines 185–310)
- Lock Function: `connection.query("SELECT GET_LOCK(?, 10) AS lock_acquired", [lockKey])`
- Deduplication: `SELECT id FROM prescriptions WHERE doctor_id = ? AND patient_id = ? AND created_at >= NOW() - INTERVAL 30 SECOND`
- Lock Timeout Failure: If `lock_acquired !== 1`, returns HTTP 503 (`"Unable to obtain prescription lock within timeout. Please retry."`).

---

## 7. Prescription PDF Ownership Verification & Binary Streaming

**Entry Point**: `frontend/src/pages/Doctor/Prescriptions.jsx` or `frontend/src/pages/Patient/Prescriptions.jsx`
**Trigger**: User clicks "Download PDF".

### Execution Path:
1. Calls `GET /api/doctor/prescriptions/:prescriptionId/pdf` or `GET /api/patient/prescriptions/:prescriptionId/pdf`.
2. Guarded by `authenticateDoctor` or `authenticatePatient`.
3. Express controller `generatePrescriptionPDF` (`doctorController.js:335`) or `generatePatientPrescriptionPDF` (`patientController.js:80`):
   - Queries prescription record: `SELECT * FROM prescriptions WHERE id = ?`.
   - **Ownership Guard**:
     - For Doctor: `prescription.doctor_id === req.user.doctorId`.
     - For Patient: `prescription.patient_id === req.user.patientId`.
     - If mismatch: **Immediately returns HTTP 403 Forbidden with zero PDF bytes streamed**.
   - If authorized: Instantiates `PDFDocument` (`pdfkit`), writes hospital header, patient demographics, medications table, and doctor signature.
   - Pipes directly to `res`: `res.setHeader('Content-Type', 'application/pdf')`.
4. Browser downloads binary stream starting with magic bytes `%PDF-1.3`.

---

## 8. Prescription Image OCR Upload & Mandatory Clinician Confirmation

**Entry Point**: `frontend/src/pages/Doctor/Prescriptions.jsx` (`handleOcrUpload`)
**Trigger**: Doctor uploads a scanned prescription image file.

### Execution Path:
1. Dispatches `POST /api/doctor/prescriptions/upload-ocr` with multipart `FormData`.
2. Express middleware `src/middleware/ocrUploadMiddleware.js`:
   - Multer checks file size (< 10MB) and MIME magic-bytes (`image/jpeg`, `image/png`).
3. Express controller `uploadAndProcessPrescriptionOcr` (`doctorController.js:520`):
   - Saves image to `uploads/prescriptions/`.
   - Calls `src/services/prescriptionOcrService.js:processPrescriptionImage`:
     - Invokes `Tesseract.recognize(imagePath, 'eng')` using local `eng.traineddata`.
     - Applies regex clinical entity rules (`regex_rules.py` / JavaScript extraction rules) extracting drug, strength, dosage form, frequency, and duration.
   - Inserts record into `prescription_ocr_jobs`: Status `processed`, parsed data JSON, `needs_review: true`.
   - Returns `{ jobId, parsed_data, needs_review: true }`.
4. Frontend displays extracted items in an editable review form.
5. **Confirmation Step**: Doctor reviews, adjusts dosage if needed, and clicks "Confirm Prescription".
   - Calls `POST /api/doctor/prescriptions/confirm-ocr` with `{ jobId, confirmed_items }`.
   - Express controller `confirmPrescriptionOcrJob`:
     - Updates `prescription_ocr_jobs` status to `confirmed`.
     - Executes `createPrescription` transaction, persisting items to the official `prescriptions` table.

---

## 9. Post-Discharge Directive Authoring & Retrieval

**Entry Point**: `frontend/src/pages/Doctor/Discharge.jsx`
**Trigger**: Doctor authors discharge instructions for admitted patient.

### Execution Path:
1. Calls `POST /api/doctor/discharge` with payload `{ patient_id, instructions, medications, dietary_precautions, red_flag_warnings, follow_up_date }`.
2. Guarded by `authenticateDoctor`.
3. Express controller `createOrUpdateDischarge` (`doctorController.js:490`):
   - Inserts or updates into `discharges` table (Migration 002).
   - Records doctor ID, timestamp, and structured clinical directives.
4. **Patient Retrieval Flow**:
   - Patient opens `/patient/discharge`.
   - Calls `GET /api/patient/discharge` (guarded by `authenticatePatient`).
   - Express controller `getPatientDischarge` (`patientController.js:105`):
     - Queries `SELECT * FROM discharges WHERE patient_id = ?` using caller's authenticated `patientId`.
     - Returns care plan JSON.
   - Frontend renders recovery directives, emergency red-flags, and upcoming follow-up appointments.

---

## 10. Patient Post-Discharge Assistant & Fail-Closed Grounding

**Entry Point**: `frontend/src/pages/Patient/Assistant.jsx` (`handleSendQuery`)
**Trigger**: Patient asks: *"When should I take my Amlodipine blood pressure medicine?"*

```mermaid
sequenceDiagram
    autonumber
    actor Pat as Patient
    participant UI as Patient Assistant UI
    participant GW as Express Gateway
    participant CDS as FastAPI CDS Gateway
    participant RAG as Frozen RAG Pipeline

    Pat->>UI: Submit Question
    UI->>GW: POST /api/patient/cds { query: "..." } (JWT)
    Note over GW: Load Patient #1 Authorized Discharge Directives
    GW->>CDS: POST /cds/evaluate { clinical_query, mode="patient", patient_context }
    CDS->>CDS: Strip demographic PII (Zero-PII invariant)
    CDS->>CDS: Multilingual script check (en, hi, mr, gu)
    CDS->>RAG: Retrieve DailyMed monographs + Discharge Care Directives
    RAG->>RAG: Hybrid BM25 + BGE Dense Retrieval -> Rerank (k=60)
    RAG->>RAG: Local TinyLlama-1.1B Generates Candidate Response
    Note over RAG: AnswerGroundingVerifier Proposition Check
    alt Claims Corroborated by Patient Care Directives
        RAG-->>CDS: Verified Grounded Output + Citations
        CDS-->>GW: HTTP 200 { answer: "Take every morning with water...", verification_status: "verified" }
        GW-->>UI: Display Answer with Green Safety Badge: Safety Policy Checked
    else Unindexed or Unsupported Claim
        RAG-->>CDS: Proposition Check Failed
        CDS-->>GW: HTTP 200 { answer: "Safe Abstention...", verification_status: "abstained_policy" }
        GW-->>UI: Display Honest Abstention Notice ("Please consult your attending physician")
    end
```

### Exact Symbols & Files:
- Express Controller: `src/controllers/patientController.js:evaluatePatientCDS`
- CDS Orchestrator: `cds_module/orchestrator.py:evaluate_clinical_query`
- Verification Invariant: `rag_module/safety/grounding_verifier.py:verify_answer_grounding`

---

## 11. Clinical RAG Query (Retrieval, Rerank, Generate, Verify)

**Entry Point**: `rag_module/api.py` (`POST /chat`) or `cds_module/router.py` (`POST /cds/evaluate`)
**Pipeline Orchestrator**: `rag_module/rag_pipeline.py:MedicalRAGPipeline`

### Step-by-Step Execution:
1. **Emergency & Triage Check**: `guardrails.py:detect_emergency_triage`. Matches acute red-flag patterns (e.g. crushing chest pain). If matched, returns instant diversion response citing national emergency numbers (**108 / 112**), completely bypassing text generation.
2. **Prompt-Injection Defense**: `guardrails.py:detect_prompt_injection`. Scans for adversarial boundary-override patterns. If detected, intercepts with security rejection.
3. **Canonical Normalization**: `multilingual_module/canonicalizer.py:canonicalize_medical_query`. Normalizes generic drug brand names (e.g., *Lipitor $\to$ Atorvastatin*).
4. **Hybrid Retrieval**:
   - *Dense*: `retrieval/dense_retriever.py` uses `BAAI/bge-small-en` (384D) against FAISS `index_v2.bin` ($k=20$).
   - *Sparse*: `retrieval/bm25_retriever.py` queries `Rank-BM25` over tokenized DailyMed corpus ($k=20$).
   - *Fusion*: `retrieval/hybrid_retriever.py` executes Reciprocal Rank Fusion ($k=60$) combining ranks.
5. **Cross-Encoder Reranking**: `reranking/cross_encoder_reranker.py` scores query-document pairs using `cross-encoder/ms-marco-MiniLM-L-6-v2`. Selects top-5 chunks within a 1024-token budget.
6. **Local Generative Decoding**: `generation/generator_v2.py` invokes `TinyLlama-1.1B-Chat-v1.0` with structured clinical prompt templates.
7. **Proposition Grounding Verification**: `safety/grounding_verifier.py:AnswerGroundingVerifier`:
   - Extracts atomic clinical claims: `(subject, relation, value, unit)`.
   - Computes token overlap and entity-binding against cited DailyMed chunks.
   - If grounded: Returns answer with DailyMed chunk IDs.
   - If ungrounded: Safely intercepts and returns `abstained_policy`.

---

## 12. Indic Multilingual Canonicalization & Localized Output

**Module**: `multilingual_module/`
**Supported Languages**: English (`en`), Hindi (`hi`), Marathi (`mr`), Gujarati (`gu`)

### Execution Path:
1. **Script & Language Detection**: `detector.py:detect_language`. Scans Unicode codepoint ranges (Devanagari: `\u0900-\u097F`, Gujarati: `\u0A80-\u0AFF`).
2. **Entity & Unit Preservation**: `canonicalizer.py:canonicalize_medical_query`.
   - Detects Latin or transliterated drug names (e.g. *ॲम्लोडिपिन $\to$ Amlodipine*).
   - Detects dosages and temporal units (e.g. *५ मिग्रॅ $\to$ 5mg*, *सकाळी $\to$ morning*).
   - Generates canonical English query for DailyMed retrieval.
3. **Localized Safety Templates**: `safety_templates.py:get_localized_emergency_guidance`, `get_localized_interaction_alert`.
   - If emergency triage or DDI alert fires, delivers calibrated native Indic text.
4. **Response Localization**: `localizer.py:localize_cds_response`.
   - Maps verified RAG claims into target language syntax without corrupting pharmacological entities.

---

## 13. Negative & Security Defense Paths

| Threat / Failure Scenario | Interception Point | Handling Mechanism | Observable Result |
| :--- | :--- | :--- | :--- |
| **Unauthenticated Request** | `src/middleware/authMiddleware.js` | Missing `Authorization: Bearer <token>` header | HTTP 401 Unauthorized (`"Access token missing"`) |
| **Role Escalation (e.g. Patient accessing Doctor route)** | `src/middleware/authMiddleware.js` | `req.user.role !== 'doctor'` check | HTTP 403 Forbidden (`"Access forbidden: requires doctor role"`) |
| **Cross-Patient BOLA Tampering** | `src/controllers/patientController.js` | Scopes SQL strictly to caller JWT `req.user.patientId` | Ignores tampered URL/body parameters; returns only caller records |
| **Unauthorized PDF Exfiltration** | `src/controllers/doctorController.js:335` | Checks `prescription.doctor_id === req.user.doctorId` | HTTP 403 Forbidden. **Zero PDF bytes streamed** |
| **Prescription Advisory Lock Congestion** | `src/controllers/doctorController.js:203` | MySQL `GET_LOCK` timeout (> 10s) | HTTP 503 Service Unavailable. **Zero orphaned rows** |
| **Account Activation Replay Attack** | `src/controllers/authController.js:109` | Checks `used_at IS NULL` on token | HTTP 400 Bad Request (`"Activation token already consumed"`) |
| **Documented Patient Allergy** | `src/controllers/doctorController.js:200` | Checks candidate drug against patient allergy list | HTTP 422 Unprocessable Entity (`"Prescription rejected: Patient allergic"`) |
| **High-Severity Drug Interaction** | `drug_module/interaction_engine.py` | Compiled DrugBank interaction rule graph | Immediate interactive red warning banner with severity & mechanism |
| **Prompt Injection Attack** | `rag_module/safety/guardrails.py` | Regex injection pattern detector | Blocked before retrieval: returns security notice |
| **Acute Medical Emergency** | `rag_module/safety/guardrails.py` | Red-flag clinical symptom detector | Bypasses LLM: returns national emergency guidance (**108 / 112**) |
| **Ungrounded RAG Claim** | `rag_module/safety/grounding_verifier.py` | Proposition-to-chunk token alignment check | Withheld fail-closed: returns `abstained_policy` badge |

---

## 14. Academic Ethics Disclosures, Explicit Consent & About Portal

**Entry Points**:
- Public Navigation: Header link (`/home`), Footers on `/login`, `/signup`, `/activate`, `/about`
- Authenticated Navigation: Sidebar bottom navigation link (`About & Ethics`) in `DashboardLayout.jsx`
- Registration Gate: `frontend/src/pages/Auth/Signup.jsx`

```mermaid
graph TD
    User["User/Registrant"] -->|Clicks 'About & Ethics'| About["/about (About.jsx)"]
    About --> Disclose1["1. Academic Prototype Scope & SVPCET Affiliation"]
    About --> Disclose2["2. NMC 2020 Medical Disclaimer & Mandatory RMP Oversight"]
    About --> Disclose3["3. Clinical Safety, Grounding Verifier & Safe Abstention"]
    About --> Disclose4["4. OCR Pipeline Margin of Error & Mandatory Clinician Review"]
    About --> Disclose5["5. Emergency Triage (112, 108, 102) & Non-Substitution"]
    About --> Disclose6["6. Privacy, DPDP 2023 & Zero Cloud Transmission Invariant"]
    About --> Disclose7["7. Research Datasets (DailyMed, DrugBank, SIDER, Stanford)"]
    About --> Disclose8["8. Academic Grievance & Contact Mechanism"]
    User -->|Visits /signup| Form["Signup Form"]
    Form --> ConsentBox{"Consent Checkbox Checked?"}
    ConsentBox -->|No| Block["Submit Disabled / Validation Alert: 'You must acknowledge...'"]
    ConsentBox -->|Yes (Affirmative)| Submit["POST /api/auth/patient/signup (terms_accepted: true)"]
    Submit --> ServerGuard{"Server Security Guard 3: terms_accepted === true?"}
    ServerGuard -->|No (missing, false, invalid)| Reject["HTTP 400 Bad Request: 'Affirmative consent... strictly required'"]
    ServerGuard -->|Yes| DBInsert["Persist user with UTC timestamp & consent_version 'v1.0-2026-10'"]
```

### Exact Call Path & Safeguards:
1. **Public & Authenticated Routing**: `frontend/src/routes/AppRoutes.jsx` registers `/about` as a publicly accessible route rendering `pages/Common/About.jsx`.
2. **Informed Consent Gate (Client-Side)**: `frontend/src/pages/Auth/Signup.jsx` renders an affirmative consent checkbox (`termsAccepted`).
   - Text: *"I acknowledge that this system is an academic research prototype utilizing synthetic demonstration data. I have read and agree to the Ethical Disclaimers, Clinical Limitations, and Privacy Notice."*
   - Submission check: `handleSubmit` inspects `formData.termsAccepted === true`. If unchecked, registration halts immediately with error alert: `"You must accept the terms, academic disclaimer, and privacy policy to register."`
3. **Server-Side Enforcement (Security Guard 3)**: `Portal Major P/Bhumi/Doctor portal/backend/src/controllers/authController.js:patientSignup`:
   - Inspects `req.body.terms_accepted === true || req.body.termsAccepted === true`.
   - Strictly enforces boolean `=== true`; strings `"true"` or numbers `1` are rejected with HTTP 400.
   - Rejection occurs before starting a database connection or creating records, preventing orphan accounts.
4. **Audit Evidence Persistence (Migration 006)**:
   - `users.consent_timestamp`: Persisted using `UTC_TIMESTAMP()`.
   - `users.consent_version`: Persisted as `'v1.0-2026-10'`.
   - Existing accounts maintain `consent_timestamp = NULL` (zero historical fabrication).
5. **Statutory & Regulatory Transparency**:
   - Accurately details Indian legal framework: DPDP Act 2023 & Draft DPDP Rules 2025 (phased implementation schedule; DPO requirement under Sec 10(2)(a) applicable only to Significant Data Fiduciaries; academic grievance officer provided); IT Act 2000 Sec 43A / SPDI Rules 2011; NMC Telemedicine Guidelines 2020; ABDM non-integration disclosure; CDSCO non-certified SaMD disclosure.
6. **Zero Cloud Transmission**: All inference (FAISS, Cross-Encoder, TinyLlama) and storage (MySQL) execute strictly on-premise on `127.0.0.1`.

---

## 15. Current Change Section

*(This section is updated whenever code modifications are proposed and executed)*

- **Change ID**: `FINAL-CDSS-COMPLETION-GATE-001` (DEC-029: Test Reconciliation, Dual-Key Theme Persistence, Indian Emergency Guidance Localization, and Doctor Profile Integration)
- **Problem Being Solved**:
  1. Test count discrepancy: Previous audit listed individual suite counts (30+11+20+25+12+14+20+9+38 = 179) while stating a summary total of 148. Needed empirical reconciliation across test cases vs assertion checks.
  2. Theme storage key divergence: `DECISIONS.md` referenced `cdss_theme` while code referenced `theme`.
  3. Localized emergency guidance: Multilingual safety templates contained US `911` references; Indian clinical deployment requires `112` and `108`.
  4. Doctor profile integration: `Doctor/Profile.jsx` had a local-state stub and was not connected to backend APIs `GET/PUT /api/doctor/profile`.
- **Execution Path**:
  1. **Dual-Key Theme Synchronization**:
     - `frontend/index.html`: Pre-paint anti-FOUT inline script updated to check `localStorage.getItem('cdss_theme') || localStorage.getItem('theme')`.
     - `frontend/src/contexts/ThemeContext.jsx`: Updated to read both keys on mount, mirror write both keys (`theme` and `cdss_theme`), and listen to cross-window/cross-tab storage events for both keys.
  2. **Indian Emergency Guidance Localization**:
     - `multilingual_module/safety_templates.py`: Purged all `911` emergency occurrences across `en`, `hi`, `mr`, and `gu`. Standardized to Indian emergency numbers: National Emergency Helpline (`112`) and Medical Ambulance (`108`).
     - `multilingual_module/tests/test_multilingual.py`: Updated `test_01_emergency_templates_presence_and_numbers` to assert presence of `112` and `108` and strictly assert `assert "911" not in text` across all 4 supported Indic languages.
  3. **Doctor Profile Full-Stack Wiring**:
     - `frontend/src/pages/Doctor/Profile.jsx`: Replaced local stub with real `doctorApi.getProfile` on component mount and `doctorApi.updateProfile` on form submit. Added saving spinner, error alerts, and read-only medical registration number display.
     - `tests/integration/test_doctor_profile_integration.js`: Authored dedicated 19-assertion integration test suite covering RBAC, 401 unauthenticated, 403 cross-role, 400 validation, live DB updates (`users.phone`, `doctors.specialization`, `doctors.bio`), reload persistence, and state cleanup.
  4. **Test Suite Execution & Reconciliation**:
     - Ran 10 test suites freshly; reconciled 185 test cases and 198 assertion checks (100% pass rate).
- **Active Working Tree Context**:
  - Head commit: `03087be` on `main`.
  - Working tree status: Working tree preserved; zero commits, zero pushes.
  - Primary database `rag_healthcare`: 100% UNTOUCHED (15 tables, 176 users, 160 patients, 65 prescriptions).
  - Frozen RAG baseline: Commit `497a547` (2,204 FAISS chunks, 100% frozen).
- **Post-Change Verification**:
  - Frontend production build: `dist/` built successfully in 10.65s (`npm run build`) with zero lint/compilation errors.
  - Test suites: 10/10 suites passing (185 test cases, 198 assertions, 0 failures, 0 skips).
  - Browser E2E verification: Theme toggle switches between light and dark modes with `theme` and `cdss_theme` synchronized in `localStorage`. Doctor profile loads legal name **Dr. Rahul Sharma** and medical license **MCI-2015-8921** directly from backend database.
- **Change ID**: `FINAL-CDSS-MIGRATION-SAFETY-001` (DEC-030: Migration Runner Hardening, Rollback Remediation, Advisory Concurrency & Test Isolation)
- **Problem Being Solved**:
  1. `scripts/run_migrations.js` lacked default protection against targeting primary `rag_healthcare` in development.
  2. `--status` and `--dry-run` executed DDL creating `schema_migrations` during read-only inspection.
  3. No concurrency lock existed to prevent concurrent migration race conditions.
  4. Migrations were vulnerable to silent modification without SHA-256 checksum detection.
  5. Rollback scripts included broad account deletion (`DELETE FROM users WHERE role = "receptionist"`) and hard-coded passwords.
- **Execution Path**:
  1. **Migration Runner Target Safety**:
     - Hardened `scripts/run_migrations.js` with fail-closed target validation refusing `rag_healthcare`, production targets, or missing `DB_NAME`.
     - Required approved test/disposable targets (`_test` / `_disposable`) with `verifyDestructiveTestSafety()`.
  2. **Read-Only Status & Dry-Run**:
     - `--status` and `--dry-run` inspect existing tables without running DDL or table creation.
  3. **Advisory Locking**:
     - Added MySQL `GET_LOCK("cdss_migration_runner_lock", 10)` and `RELEASE_LOCK` in execution `finally` block.
  4. **SHA-256 Checksums**:
     - Added checksum calculation and validation against `schema_migrations.checksum` to detect migration tampering.
  5. **Rollback Remediation**:
     - Cleaned `migrations/001_rollback.sql` to avoid broad receptionist deletions.
     - Removed hard-coded credentials from `migrations/001_add_receptionist_role.sql`.
     - Created `scripts/run_rollback.js` requiring explicit `--confirm-destructive-rollback` and `ALLOW_DESTRUCTIVE_DATABASE_TESTS=true`.
- **Post-Change Verification**:
  - `tests/test_migration_safety_orchestrator.js`: 16/16 tests passed.
  - `scratch/verify_primary_db_intact.js`: Primary database `rag_healthcare` confirmed 100% untouched.
  - Full regression test suites passed (100% pass rate).
  - All 4 frontends built successfully with 0 errors.

- **Change ID**: `FINAL-CDSS-ACCOUNT-APPOINTMENT-FLOW-001` (DEC-031: Singleton Receptionist, Multi-Account Lifecycle, Patient Appointment Discovery & Clinical Flow Hardening)
- **Problem Being Solved**:
  1. Multiple patient accounts needed self-registration (`/signup`, DPDP consent) without requiring mandatory passkeys.
  2. Multiple doctor accounts needed approved administrative onboarding with real stored specialties and isolated schedules.
  3. Single receptionist invariant needed database-enforced unique constraints (`uq_single_receptionist`) and transactional row-locking to prevent concurrent double-provisioning.
  4. Patient needed doctor directory discovery with genuine stored specialties, appointment requesting with double-booking prevention, and BOLA-defended cancellation.
  5. Doctor calendar needed date-based schedule navigation (`< Prev | Today | Next >`), status progression, and direct patient dossier linkage.
  6. Authentication pages needed refreshed green-and-white healthcare aesthetics with accessible contrast, soft mint gradients, elevated cards, and dark-mode support.
- **Execution Path**:
  1. **Database Singleton Constraint (Migration 007)**:
     - `migrations/007_enforce_single_receptionist_and_appointment_statuses.sql` adds virtual stored column `single_receptionist` and `UNIQUE KEY uq_single_receptionist`.
     - `appointments.status` ENUM expanded to 7 statuses (`pending`, `scheduled`, `confirmed`, `completed`, `cancelled`, `rejected`, `reschedule_requested`).
  2. **Auth & Backend Gateway**:
     - `authController.js`: `provisionReceptionist` enforces singleton via `SELECT ... FOR UPDATE` and catches `ER_DUP_ENTRY` returning 409 Conflict.
     - `patientController.js`: `getAvailableDoctors` queries `doctors d JOIN users u` returning genuine `specialization`; `requestAppointment` executes `SELECT ... FOR UPDATE` checking double-booking; `cancelPatientAppointment` enforces BOLA ownership check.
     - `receptionistController.js`: `registerDoctor` takes `full_name`, `email`, `phone`, `specialization`, `license_number`; `createAppointment` enforces double-booking guard.
  3. **Frontend UI Refinements**:
     - `Login.jsx` & `Signup.jsx`: Mint and deep emerald green palette (`#0f766e`, `#047857`, `#f0fdf4`), accessible form fields, DPDP consent, role selector, and dark mode support.
     - `frontend/src/pages/Patient/Appointments.jsx`: Searchable physician directory, speciality filters, appointment modal, and appointment history with cancel action.
     - `frontend/src/pages/Doctor/Appointments.jsx`: Date-based schedule navigator (`< Prev | Today | Next >` + date picker) and patient medical dossier links.
- **Post-Change Verification**:
  - `scratch/test_account_appointment_and_cds_flow.js`: 31/31 passed across Groups 1-7.
  - `scratch/test_full_system_multi_role_e2e.js`: 20/20 passed.
  - `scratch/test_activation_and_role_mismatch.js`: 20/20 passed.
  - `cds_module/test_cds_gateway.py`: 9/9 passed.
  - `multilingual_module/tests/`: 38/38 passed.
  - `rag_module/tests/`: 193 passed, 2 skipped, 0 failed.
  - Frontend production build (`npm run build`): 0 errors.
  - Primary database `rag_healthcare`: 100% UNTOUCHED.

- **Change ID**: `FINAL-CDSS-APPOINTMENT-STATE-MACHINE-001` (DEC-032: Appointment State Transition Machine & Dual-Role Administrative Queue)
- **Problem Being Solved**:
  1. Terminal appointment statuses (`completed`, `cancelled`, `rejected`) could previously be overwritten back to active statuses because controller logic lacked transition constraints.
  2. The receptionist interface lacked an administrative queue and action buttons for approving or rejecting patient-requested (`pending`) appointments.
  3. Patient appointment booking referenced un-normalized properties (`doc.id` instead of `doc.doctor_id || doc.id`), which broke booking in the UI.
  4. Public user registration (`Signup.jsx`) only serviced patients, leaving doctors without clear guidance on hospital administrative onboarding.
- **Execution Path**:
  1. **Backend State Machine**:
     - `doctorController.js` and `receptionistController.js`: Added `validTransitions` matrix in `updateAppointmentStatus`. Rejects transitions from terminal states (`completed`, `cancelled`, `rejected`) and invalid transitions with `400 Bad Request`.
  2. **Receptionist Review Queue**:
     - `frontend/src/pages/Receptionist/Appointments.jsx`: Added pending appointment review banner, filter tabs for all 7 statuses (`all`, `pending`, `confirmed`, `scheduled`, `completed`, `cancelled`, `rejected`), status badges, and action buttons (`Approve` to `confirmed`, `Reject` to `rejected`, `Complete`, `Cancel`).
  3. **Doctor Onboarding Guidance Gate**:
     - `frontend/src/pages/Auth/Signup.jsx`: Added clear role tabs (`Patient Registration` vs `Doctor Onboarding`). When Doctor is selected, presents clinical credentialing notice (NMC/NABH compliance) explaining administrative vetting with buttons to `/activate` and `/login`.
  4. **Frontend Property Normalization**:
     - `frontend/src/pages/Patient/Appointments.jsx`: Normalized doctor and appointment ID references to `doc.doctor_id || doc.id`, `doc.full_name || doc.name`, and `app.appointment_id || app.id`.
- **Post-Change Verification**:
  - `scratch/test_account_appointment_and_cds_flow.js`: 35/35 passed (including terminal transition rejections, receptionist rejection, and Indic emergency queries).
  - `scratch/test_full_system_multi_role_e2e.js`: 20/20 passed.
  - `scratch/test_activation_and_role_mismatch.js`: 20/20 passed.
  - `cds_module/test_cds_gateway.py`: 9/9 passed.
  - `multilingual_module/tests/`: 38/38 passed.
  - Frontend production build (`npm run build`): 0 errors.
  - Primary database `rag_healthcare`: 100% UNTOUCHED.

- **Change ID**: `FINAL-CDSS-FRONTEND-REPLACEMENT-001` (DEC-034: CDSS Frontend Visual Replacement, 372-Key Multilingual Parity, Real PDFKit Prescription Pipeline, Doctor-Authored Discharge Grounding & OCR Invariants)
- **Problem Being Solved**:
  1. Frontend required visual alignment with the reference fork's emerald/glassmorphism design (`DM Sans`, `Manrope`, 2-column auth hero, responsive tablists, styled role selectors).
  2. Authenticated portal pages needed comprehensive localization across English, Hindi, Marathi, and Gujarati (`en`, `hi`, `mr`, `gu`).
  3. Prescription PDF downloads needed real, styled `%PDF-` document generation with hospital branding, doctor credentials, and CDSS attestation seals, with strict BOLA defense.
  4. Post-discharge care instructions authored by doctors needed to persist in MySQL and directly ground the patient's conversational assistant queries without hallucination.
  5. The prescription OCR pipeline needed rigorous negative and positive automated verification (magic bytes, pending review state, clinician confirmation, duplicate prevention).
- **Execution Path**:
  1. **Visual Replacement & Styling**:
     - `frontend/src/index.css`: Added Google fonts, CareUnity 2-column layout grid, glowing emerald orbs, glassmorphic cards, and role selectors.
     - `Login.jsx`, `Signup.jsx`, `Activate.jsx`: Replaced old single-card layout with the 2-column CareUnity layout, interactive role buttons (`♡ Patient`, `▦ Receptionist`, `✚ Doctor`), single-click demo accounts, and floating multilingual selectors.
  2. **Multilingual Expansion (372 Keys)**:
     - `frontend/src/constants/translations.js`: Expanded dictionary to 372 keys across all 4 languages with 100% parity.
     - Localized `Doctor/Patients.jsx`, `Doctor/Prescriptions.jsx`, `Doctor/Discharge.jsx`, `Doctor/Profile.jsx`, `Patient/Prescriptions.jsx`, `Patient/MedicalHistory.jsx`, `Patient/Profile.jsx`, and `Receptionist/Patients.jsx`.
  3. **Prescription PDF Service (`prescriptionPdfService.js`)**:
     - Generates real, styled outpatient prescription PDFs via PDFKit featuring St. Mary Hospital header, patient and prescriber credentials, itemized medication table, clinical directives, and verified CDSS attestation stamp.
     - Wired to `doctorController.js` and `patientController.js` with BOLA security checks.
  4. **Doctor-Authored Discharge Care Integration**:
     - Tested saving discharge plans via `doctorController.js`, immediate patient viewing via `patientController.js`, and grounded AI answering via `cds_module/orchestrator.py` (`_resolve_discharge_care_query`).
  5. **Prescription OCR Pipeline Verification**:
     - Validated upload rejection on missing or fake files, candidate extraction via Tesseract, mandatory human confirmation requirement, and authoritative prescription creation.
- **Post-Change Verification**:
  - `scratch/gap_closure_master_verification.js`: 22/22 passed (100%).
  - `npm run build`: built in 1.35s with 0 errors.
  - Python `pypdf` test: verified page count = 1, text extraction verified St. Mary Hospital, diagnosis, dosage, and CDSS attestation.
  - Primary database `rag_healthcare`: 100% UNTOUCHED (15 tables, 176 users, 160 patients, 65 prescriptions).
