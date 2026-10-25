# Clinical Decision Support System (CDSS)
## Teacher & Evaluator Presentation Guide
### Final Year Major Engineering Project

---

## 1. Executive Problem Statement & Clinical Motivation

Modern Generative Large Language Models (LLMs) possess fluent medical vocabulary, yet **they are fundamentally unsafe when deployed unconstrained in clinical decision support**:
1. **Hallucination & Fabrication**: Generative models may invent non-existent drug dosages, fabricate contraindications, or omit life-threatening drug-drug interactions.
2. **Stochastic Drift & Non-Determinism**: An LLM might correctly warn against co-prescribing two interacting drugs on one query, but omit the warning when paraphrased.
3. **Absence of Role-Based Security Boundaries**: General-purpose chatbots do not distinguish between a licensed clinician prescribing under emergency override and an anxious patient inquiring about discharge recovery symptoms.

### Our Solution
We engineered a **Fail-Closed, Multi-Tier Clinical Decision Support System (CDSS)** that bridges an institutional **Electronic Health Record (EHR)** platform with an **Evidence-Grounded Retrieval-Augmented Generation (RAG)** engine and a **Deterministic Clinical Rule Engine**.

```
                        CLINICAL SAFETY PRINCIPLE
                     "Never Trust LLM Output Alone"
      Every clinical claim must be verified against DailyMed drug monographs
      or verified clinical guidelines before presentation to a clinician or patient.
      If verification fails, the system fails CLOSED (withholds answer safely).
```

---

## 2. System Architecture & Information Flow

The platform is structured into three cooperating tiers designed with clear separation of concerns:

```text
                               ┌────────────────────────────────────────────────┐
                               │           UNIFIED CLINICAL FRONTEND            │
                               │        React 19 + Vite (Port 5173/5174/5175)   │
                               └───────────────────────┬────────────────────────┘
                                                       │ Authenticated REST / JWT
                                                       ▼
                               ┌────────────────────────────────────────────────┐
                               │             EXPRESS EHR GATEWAY                │
                               │          Node.js / Express (Port 5000/5001)    │
                               │  • Role-Based Access Control (RBAC)            │
                               │  • Patient Privacy & Dossier Sanitization      │
                               │  • Deterministic Allergy Hard-Stops (HTTP 422) │
                               │  • Authoritative PDF Generation (PDFKit)       │
                               └───────────────────────┬────────────────────────┘
                                                       │ Zero-PII Context Forwarding
                                                       ▼
                               ┌────────────────────────────────────────────────┐
                               │             FASTAPI CDS GATEWAY                │
                               │               Python (Port 8000)               │
                               │  • Emergency Triage Interceptor (112 / 108)    │
                               │  • Multilingual Translation (en, hi, mr, gu)   │
                               │  • Drug Interaction Engine (DrugBank / SIDER)  │
                               │  • Frozen Evidence RAG Pipeline (v2.10)        │
                               └───────────────────────┬────────────────────────┘
                                                       │
                     ┌─────────────────────────────────┴─────────────────────────────────┐
                     ▼                                                                   ▼
       ┌───────────────────────────┐                                       ┌───────────────────────────┐
       │   DETERMINISTIC SAFETY    │                                       │   HYBRID EVIDENCE RAG     │
       │  • Rule-Based DDI Checks  │                                       │  • FAISS Dense Retrieval  │
       │  • Allergy Cross-Reactivity│                                      │  • BM25 Lexical Retrieval │
       │  • Prompt-Injection Block │                                       │  • Reciprocal Rank Fusion │
       │  • Grounding Verifier     │                                       │  • Cross-Encoder Rerank   │
       └───────────────────────────┘                                       │  • TinyLlama Generator   │
                                                                           └───────────────────────────┘
```

---

## 3. Deterministic Safety Rules vs. Stochastic RAG

One of the project's most critical innovations is distinguishing between **what must be deterministic** and **what can use AI retrieval**:

| Clinical Dimension | Technology Used | Why This Choice? | Safety Behavior |
| :--- | :--- | :--- | :--- |
| **Allergy Contraindications** | Deterministic Rule Engine | No LLM randomness permitted for life-threatening anaphylaxis. | **Hard Stop (HTTP 422)**. Cannot be overridden even by doctor. |
| **Drug-Drug Interactions (DDI)** | Curated Interaction Rules (DrugBank/SIDER) | Interactions (e.g. Atorvastatin + Clarithromycin → Rhabdomyolysis) must be detected 100% reliably. | **Alert & Override (HTTP 409)**. Requires doctor's recorded clinical rationale. |
| **Emergency Triage** | Regex & Intent Detection | Chest pain, acute dyspnea, anaphylaxis require immediate diversion to emergency services. | **Immediate Diversion**. Calls 112 / 108 immediately with zero LLM latency. |
| **Prompt Injection Defense** | Deterministic Pattern Matcher | Malicious attempts to bypass safety or exfiltrate system prompts must be blocked. | **Strict Block**. System refuses to process adversarial inputs. |
| **Medical Question Answering** | Hybrid RAG (FAISS + BM25 + Cross-Encoder) | Clinical guidelines (DailyMed) are vast and require semantic search. | **Fail-Closed Verification**. If TinyLlama output cannot be grounded in retrieved monograph, answer is withheld. |

---

## 4. Three-Role Demonstration Runbook

### Role 1: Hospital Receptionist (Administrative Front Desk)
1. **Login**: Login with receptionist credentials (`receptionist@gmail.com`).
2. **Patient Registration**: Navigate to **Patients** -> **+ Register Patient**. Fill in demographics and documented allergies (e.g. `Penicillin`).
3. **Appointment Scheduling**: Navigate to **Appointments** -> **+ Schedule Appointment**. Assign patient to Dr. Rahul Sharma with consultation reason.
4. **Institutional Security**: The receptionist has **zero access** to doctor clinical decision tools, prescription authorization, or patient clinical dossiers (enforced by RBAC HTTP 403).

### Role 2: Attending Physician / Doctor (Clinical Consultation & CDS)
1. **Login**: Login with doctor credentials (`doctor@gmail.com`).
2. **Review Patient Dossier**: Select the scheduled patient. The system surfaces documented allergies and active medication profile.
3. **Demonstrate Allergy Hard-Stop**:
   - Prescribe `Amoxicillin 500mg` to a patient with a documented `Penicillin` allergy.
   - The system intercepts the request with an **Allergy Contraindication Alert (HTTP 422)**, blocking the prescription from being saved.
4. **Demonstrate DDI Screening & Clinical Override**:
   - Prescribe `Atorvastatin 20mg` (cholesterol) and `Clarithromycin 500mg` (antibiotic).
   - The CDSS identifies a severe CYP3A4 interaction causing myopathy / rhabdomyolysis risk.
   - The doctor inputs a clinical rationale (*"Patient counseled on warning signs. Short 5-day therapy under close clinical monitoring"*).
   - Prescription is authorized and saved as an authoritative legal record.
5. **Prescription PDF Generation**:
   - Click **Download Prescription (PDF)**.
   - The system generates an official A4 document featuring hospital branding, patient/doctor metadata, medication instructions, and a digital CDSS verification seal.
6. **Post-Discharge Episode Creation**:
   - Navigate to **Discharge Care**. Author personalized recovery directives, discharge instructions, follow-up dates, and red-flag warning signs.

### Role 3: Patient (Self-Service & Post-Discharge Care)
1. **Login**: Login with patient credentials (or 1-click patient demo login).
2. **Personal Care Dashboard**: View active clinical episode, scheduled follow-ups, and treating physician.
3. **Discharge Instructions**: View personalized recovery plan, dietary guidance, and warning signs authored by the doctor.
4. **Prescription Access**: View authorized medications and download the official prescription PDF.
5. **Interactive Post-Discharge Assistant**:
   - Ask: *"What time should I take my Atorvastatin medicine?"* -> Assistant extracts documented bedtime administration timing from the discharge plan.
   - Ask: *"What are the warning signs where I should seek emergency care?"* -> Assistant presents exact red-flag symptoms authored by the doctor.
   - Ask: *"What follow-up appointments and lab tests do I need?"* -> Assistant states scheduled cardiology clinic follow-up and BMP lab requirements.
   - Restricted Patient Mode ensures the assistant never invents advice outside the authorized discharge plan.

---

## 5. Multilingual Clinical Capabilities

To serve diverse patient populations across India, the system supports 4 languages:
* **English (`en`)**
* **Hindi (`hi`)** (हिंदी)
* **Marathi (`mr`)** (मराठी)
* **Gujarati (`gu`)** (ગુજરાતી)

### Multilingual Features:
1. **Query Canonicalization**: Localized colloquial expressions (e.g., Hindi *"उपाशी पोटी"* / Marathi *"उपाशी पोटी"* -> *"on an empty stomach"*) are canonicalized into standard clinical inquiry representations.
2. **Preservation of Negation**: Negative inquiries (*"क्या मेटफॉर्मिन को शराब के साथ नहीं लेना चाहिए?"*) strictly preserve the negative modifier to prevent medical advice inversion.
3. **Emergency Numbers**: Emergency responses dynamically localize to India's unified emergency number **112** and ambulance service **108** (purging US numbers like 911).

---

## 6. Documented Limitations & Honest Engineering Disclosures

In academic engineering projects, acknowledging boundaries is as important as presenting capabilities:

1. **Compact Local Generator Capacity (`TinyLlama-1.1B-Chat`)**:
   * We run a compact 1.1B open-source model locally on consumer hardware without cloud API dependencies.
   * *Limitation*: Compact models occasionally generate conversational preamble drift.
   * *Engineering Defense*: Our `AnswerGroundingVerifier` intercepts unverified outputs fail-closed, withholding them safely rather than presenting questionable claims.
2. **Formulary Coverage (2,204 Production Chunks)**:
   * The vector knowledge base covers major cardiovascular, diabetic, and primary care medications.
   * *Limitation*: Unindexed rare disease entities (e.g. Gorham-Stout disease) are not in the local corpus.
   * *Engineering Defense*: The system strictly abstains (`abstained_policy`) within < 2 seconds rather than hallucinating answers.
3. **Cross-Encoder Lazy Loading**:
   * The second-stage Cross-Encoder reranker (`cross-encoder/ms-marco-MiniLM-L-6-v2`) loads on the first inference request (~1.5s cold start), after which inference is sub-second.
4. **In-Memory OCR Queue**:
   * Prescription image processing uses offline Tesseract.js with mandatory human clinician review (`pending_review` invariant). In a commercial hospital deployment, this would be backed by persistent message queues (e.g. RabbitMQ/Redis).

---

## 7. Full Empirical Verification & Test Results

The platform has been validated across **10 regression test suites**, achieving a **100% pass rate** across all automated tests:

| Test Suite | Purpose & Coverage | Verified Result | Pass Rate |
| :--- | :--- | :---: | :---: |
| **Acceptance Suite (24 Cases + CONC-01)** | RAG accuracy, fail-closed safety, emergency diversion, concurrency conflicts | **25 / 25 Passed** | **100%** |
| **Full-System Multi-Role E2E** | Receptionist -> Doctor -> Patient lifecycle + RBAC negative security matrix | **20 / 20 Passed** | **100%** |
| **Doctor Portal E2E** | Doctor consultation, dossier, appointments, prescriptions, discharge | **26 / 26 Passed** | **100%** |
| **Multilingual Foundation Pytest** | Query canonicalization, safety templates, Hindi/Marathi/Gujarati CDS | **38 / 38 Passed** | **100%** |
| **CDS Gateway Pytest** | FastAPI evaluate, screen-prescription, input validation | **9 / 9 Passed** | **100%** |
| **Patient & Discharge Care** | Patient portal, discharge viewing, restricted assistant, PDF endpoints | **14 / 14 Passed** | **100%** |
| **Prescription OCR Pipeline** | Multer magic-byte validation, OCR extraction, pending_review state | **12 / 12 Passed** | **100%** |
| **Express -> FastAPI Bridge** | Service-to-service communication, sanitization, zero-PII forwarding | **7 / 7 Passed** | **100%** |
| **Portal CDS Responsibilities** | Role boundary enforcement, doctor vs patient CDS parameter isolation | **25 / 25 Passed** | **100%** |
| **Negative Security Matrix** | BOLA attacks, cross-role tampering, unauthenticated access | **7 / 7 Passed** | **100%** |
| **TOTAL AUTOMATED VERIFICATIONS** | **All 10 Subsystem Test Suites** | **183 / 183 Passed** | **100%** |

### Real Browser Journey Verification
* **Journey 1**: Verified in browser with real user interactions on `http://localhost:5173`. Verified Amoxicillin allergy hard stop, Atorvastatin + Clarithromycin DDI override, prescription creation, discharge authoring, and patient assistant Q&A.
* **Journey 2**: Verified with secondary synthetic patient (Aspirin allergy block, Metformin + Lisinopril prescription, discharge creation, and paraphrased assistant inquiries).
* **PDF Byte Validation**: Verified valid `%PDF-` header bytes and binary file sizes (3,253 bytes) streamed via PDFKit for both doctor and patient downloads.
* **Frontend Production Builds**: All 4 frontend applications (`frontend`, `Doctor portal`, `Receptionist frontend`, `Patient frontend`) compile with **0 errors**.
