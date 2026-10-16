# FINAL_GOAL.md — Healthcare CDSS Product Completion Contract

> **Document Type**: Authoritative Product Completion Contract  
> **Project**: Modular AI-Powered Multilingual Clinical Decision Support System (CDSS)  
> **Academic Context**: 4th-Year Computer Engineering Major Project (2026)  
> **Repository**: `dragyo7/healthcare-System-major-project-`  
> **Primary Branch**: `main`<br>
> **Audited Documentation Baseline**: `ac26bb7`<br>
> **Frozen RAG Implementation Baseline**: Commit `497a547` (V2.10 Hard-Frozen)

---

## 1. Product Vision & Operational Scope

The final product is a **locally reproducible, evidence-grounded, multilingual Clinical Decision Support System** engineered to demonstrate how modern AI architectures can safely augment healthcare workflows without the life-threatening risks of generative hallucination.

### A. The Four Core Clinical Problems Solved
1. **Cognitive Overload & Diagnostic Drift**: Rapid clinical copilot synthesizing evidence from FDA drug monographs for clinicians under time pressure.
2. **Preventable Adverse Drug Events (ADEs)**: Deterministic, sub-15ms multi-drug interaction and patient-allergy screening before any prescription can be persisted.
3. **Generative Hallucination in Generic LLMs**: Eliminates unconstrained medical fabrication through a frozen RAG pipeline and an atomic proposition verifier (`AnswerGroundingVerifier`) that enforces a **strict fail-closed policy**.
4. **Post-Discharge Linguistic Isolation**: Enables non-English speaking patients to understand their doctor's authorized discharge instructions in Hindi, Marathi, or Gujarati with preserved drug entities and units.

### B. What the System IS
- A decision-support copilot for licensed physicians.
- A front-desk administrative portal for patient intake and single-use account activation.
- A secure patient portal for reviewing verified active prescriptions, discharge instructions, and asking recovery-related educational questions.

### C. What the System IS NOT (Non-Goals & Explicit Boundaries)
- **NOT an Autonomous Diagnostician**: The system never prescribes autonomously; every action requires explicit clinician confirmation.
- **NOT a Public Internet Service**: Engineered for deployment within internal hospital LANs or on-premise clinical servers.
- **NOT a Regulated Medical Device**: This is an academic engineering research prototype; it has not undergone randomized clinical trials or clearance by the FDA (SaMD) or CDSCO.

---

## 2. Intended Architecture & Component Separation

```text
                               UNIFIED FRONTEND (Port 5173)
                   (React 19 + Vite 8 SPA — Single Entry Point)
                                      │
                                      ▼ HTTP (JWT Bearer: doc / pat / rec)
                        EXPRESS EHR GATEWAY (Port 5000)
                     (Auth, RBAC, BOLA, Advisory Lock Manager)
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            │ SQL Queries (Port 3306)                           │ HTTP POST (Port 8000)
            ▼                                                   ▼ (Zero-PII Context)
    MYSQL DATABASE (8.0)                             FASTAPI CDS GATEWAY
  • 13 Relational Tables                            • POST /cds/evaluate
  • Migrations 001–004                              • POST /cds/screen-prescription
  • Advisory Lock (rx_lock)                                     │
                                       ┌────────────────────────┼────────────────────────┐
                                       ▼                        ▼                        ▼
                                 DRUG MODULE           MULTILINGUAL MODULE       FROZEN RAG v2.10
                              • DrugBank (8 rules)    • en / hi / mr / gu      • FAISS (2,204 chunks)
                              • SIDER (20 profiles)   • Entity Canonicalizer   • BM25 + RRF (k=60)
                              • Sub-15ms Lookup       • Safety Templates       • Cross-Encoder Rerank
                                                                               • TinyLlama-1.1B
                                                                               • Grounding Verifier
```

### Architectural Separation Rationale
1. **Relational EHR vs. Vector RAG Separation**: Patient PII and relational clinical data live exclusively in MySQL. Clinical knowledge (FDA monographs, treatment guidelines) lives in FAISS. Patient data is **never** vectorized or embedded into the shared knowledge base.
2. **Node.js Gateway vs. Python AI Engine**: Node.js/Express manages asynchronous HTTP traffic, JWT token verification, BOLA access controls, MySQL transactions, and binary PDF streaming. Python/FastAPI manages heavy PyTorch neural models, tokenizers, vector math, and regex canonicalization.
3. **Deterministic Safety vs. Generative Reasoning**: Drug-drug interactions and allergy checks execute strictly via deterministic rule graphs in under 15ms. The generative RAG pipeline is reserved for open-ended clinical inquiries and patient educational queries.

---

## 3. End-to-End Workflow Acceptance Criteria

### Workflow 1: Attending Doctor
- [x] **Authentication**: Logs in with role `doctor` via `POST /api/auth/doctor/login` and receives a role-scoped JWT.
- [x] **Patient Dossier**: Opens authorized patient record (`GET /api/doctor/patients/:id`). Views diagnosed conditions and documented allergies (e.g. `Penicillin`).
- [x] **CDS Assistant Inquiry**: Submits patient-context clinical question. Receives structured answer with explicit DailyMed FDA monograph citations.
- [x] **Deterministic Drug-Drug Interaction Screening**: Submits candidate medications (e.g., `Atorvastatin` + `Clarithromycin`). Receives interactive high-severity alert (`RUL-INT-007`) in **< 15ms**.
- [x] **Allergy Contraindication Interception**: Attempting to prescribe an allergenic drug (e.g., `Penicillin 500mg`) is intercepted by the server-side safety boundary with HTTP 422.
- [x] **Prescription Persist & Concurrency Idempotency**: Submits safe prescription (`Amlodipine 5mg`). Express acquires MySQL session advisory lock `rx_lock_<docId>_<patId>`. Rapid duplicate submissions deduplicate cleanly (1 created, 4 deduplicated).
- [x] **Prescription PDF Authorization**: Downloads generated prescription PDF (`GET /api/doctor/prescriptions/:id/pdf`). Unauthorized doctors attempting access are blocked with HTTP 403 and **zero bytes streamed**.
- [x] **Prescription OCR Review Invariant**: Uploads scanned prescription image. Tesseract.js extracts candidate medications marked `needs_review: true`. Cannot enter patient records without explicit doctor confirmation.
- [x] **Discharge Care Authoring**: Authors post-discharge directives, follow-up dates, and red-flag warning triggers (`POST /api/doctor/discharge`).

### Workflow 2: Patient Post-Discharge Self-Service
- [x] **Single-Use Activation**: Front desk generates a 32-byte cryptographic token. Patient navigates to `/activate?token=...`, defines a secure password, and activates account. Token cannot be reused (HTTP 400 on replay).
- [x] **Role Isolation & BOLA Defense**: Logs in with role `patient`. Scoped strictly to own medical records; parameter tampering attempting to view other patients' data returns HTTP 403 or empty set.
- [x] **Personal Health Records**: Views active prescriptions, upcoming appointments, and discharge directives (`GET /api/patient/dashboard`, `GET /api/patient/discharge`).
- [x] **Discharge-Grounded Assistant**: Asks post-discharge medication questions. The assistant answers based strictly on the doctor's authorized care plan, displaying `Safety Policy Checked (abstained_policy)`.
- [x] **Multilingual Support**: Supports English (`en`), Hindi (`hi`), Marathi (`mr`), and Gujarati (`gu`). Preserves drug entities (e.g. `Amlodipine`) and dosages while localizing conversational guidance.
- [x] **Safe Abstention on Unsupported Queries**: Asks about unsupported or fictitious drugs (e.g. *Fictitiouzamol*). System safely refuses to invent medical claims (`fail-closed abstention`).

### Workflow 3: Front-Desk Receptionist
- [x] **Administrative Authentication**: Logs in with role `receptionist`.
- [x] **Patient Intake Validation**: Registers new patient demographics. Enforces DOB range (`1900-01-01` to current date) and 10-digit emergency contact format.
- [x] **Zero Clinical Access**: Receptionist account has zero access to clinical dossiers, CDS endpoints, or prescription records. Attempting access returns HTTP 403 Forbidden.
- [x] **Appointment Scheduling**: Books patient consultations with hospital doctors (`POST /api/receptionist/appointments`).

---

## 4. Technical Quality & Completion Invariants

| Dimension | Acceptance Standard | Measured Result | Verification Evidence |
| :--- | :--- | :---: | :--- |
| **Retrieval Quality** | Hit@5 against verified clinical monograph set | **98.4%** (MRR: 0.94) | `scratch/audit_retrieval_pipeline.py` |
| **Citation Attribution** | Claims backed by authentic DailyMed chunk IDs | **100% Attribution** | `rag_module/data/faiss_index/meta_v2.pkl` |
| **Deterministic Latency**| Multi-drug interaction rule evaluation time | **Median: 12.59 ms** | `scratch/profile_prescription_safety_paths.js` |
| **Grounding Verification**| Atomic proposition check on candidate generations | **Zero Hallucinations** | `rag_module/safety/grounding_verifier.py` |
| **BOLA Defense** | Cross-patient record tampering prevention | **100% Blocked** | `tests/integration/test_route_authorization_matrix.js` |
| **Lock Concurrency** | Race condition duplicate prescription prevention | **Zero Duplicate Rows** | `tests/integration/test_concurrent_prescription_idempotency.js` |
| **PDF Ownership** | Stream blocked before bytes sent on unauthorized call | **0 Bytes Streamed** | `tests/integration/test_pdf_ownership_and_lock_failure.js` |
| **RAG Regression** | Preserves frozen RAG baseline (`497a547`) | **193 Pass, 2 Skip, 0 Fail** | `rag_module/tests/` (Task-6523) |
| **Frontend Compilation**| Production bundle build without type/syntax errors | **0 Errors (1.03s)** | `cd frontend; npm run build` |

---

## 5. Definition of Done (Demonstration & Handover)

The system is considered **complete and ready for academic demonstration** when:
1. All three role portals (Doctor, Patient, Receptionist) operate on a single URL (`http://localhost:5173`).
2. Express gateway, FastAPI CDS, and MySQL run reproducibly via `npm start` or PowerShell script.
3. Seeded synthetic personas allow immediate demonstration without manual database seeding:
   - Doctor: `doctor@gmail.com` / `doctor123`
   - Receptionist: `receptionist@gmail.com` / `receptionist123`
   - Patient: `aarav@gmail.com` / `patient123`
4. The 14 integration test suites in `tests/run_all_tests.js` pass with 0 failures.
5. All limitations are explicitly documented in `README.md`, `FINAL_GOAL.md`, and research documentation.
