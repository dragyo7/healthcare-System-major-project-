# PROJECT AUDIT, REMEDIATION & EVIDENCE LEDGER REPORT

> **Comprehensive Technical Audit, System Hardening & Claim-to-Evidence Ledger**  
> **Project**: Modular AI-Powered Multilingual Clinical Decision Support System (CDSS)  
> **Repository Root**: `E:\Major Project Code`  
> **Branch**: `feature/cds-gateway` | **HEAD**: `7b0867b6aed2736538c08fc51c88e3b08a00ad51`  
> **Frozen RAG Baseline**: Commit `497a547` (V2.10, 2,204 chunks, fail-closed verifier)  
> **Scope**: Implementation Audit & Remediation (Manuscript Review Excluded & Deferred)  
> **Audit Date**: October 2026  

---

## 1. Baseline & Final Git Invariant State

- **Active Branch**: `feature/cds-gateway`
- **Initial & Final HEAD**: `7b0867b6aed2736538c08fc51c88e3b08a00ad51`
- **Remote Origin**: `https://github.com/dragyo7/healthcare-System-major-project-.git`
- **Git State Verification**:
  - `git diff --cached` is strictly empty (`0` bytes staged).
  - Zero commits created (`git commit` was not run).
  - No files staged (`git add` was not run).
  - Zero destructive operations (`git reset --hard`, `git clean -fd`, `git checkout --`, `git stash` were strictly avoided).
- **Manuscript Isolation**: `Complete_Healthcare_CDS_Research_Paper.docx` was neither opened, inspected, audited, nor modified during this session.

---

## 2. Issues Reproduced, Root Causes & Verified Fixes

### 2.1 Patient Login Loop, Form Validation & Empty State Handling
- **Root Cause**: In [`Login.jsx`](file:///E:/Major%20Project%20Code/Portal%20Major%20P/patient_frontend/src/views/Login.jsx), a strict HTML5 `required` attribute on the phone field prevented form submission when the optional phone number was omitted. Furthermore, transient API responses during initial dashboard bootstrap caused local state clearing and redirect loops.
- **Remediation**:
  1. Updated `Login.jsx` to make phone optional (`placeholder="9876543210 (optional)"`), added client-side regex format checks, and removed blocking HTML5 attributes.
  2. Structured dashboard data loading to handle honest empty states gracefully without clearing valid JWT sessions.
- **Files Modified**: [`Portal Major P/patient_frontend/src/views/Login.jsx`](file:///E:/Major%20Project%20Code/Portal%20Major%20P/patient_frontend/src/views/Login.jsx), [`Portal Major P/patient_frontend/src/App.jsx`](file:///E:/Major%20Project%20Code/Portal%20Major%20P/patient_frontend/src/App.jsx).
- **Evidence**: [`scratch/test_patient_signup_and_loop.js`](file:///E:/Major%20Project%20Code/scratch/test_patient_signup_and_loop.js) passed 7/7.

### 2.2 Patient Self-Registration Privilege Escalation & Arbitrary ID Injection
- **Root Cause**: The public self-registration route (`POST /api/auth/patient/signup`) previously accepted client payloads without validating whether the caller submitted `role: 'doctor'` or `role: 'receptionist'`, or attempted to inject arbitrary `user_id` or `patient_id` values.
- **Remediation**:
  1. Injected strict server-side validation rejecting any `role` other than `'patient'` with HTTP `403 Forbidden`.
  2. Injected check rejecting caller-supplied `user_id` or `patient_id` with HTTP `400 Bad Request`.
  3. Enforced email and name format validation (minimum 2 characters).
  4. Enforced staff intake conflict check: if an email is registered with the `!ACTIVATION_PENDING$` sentinel, public self-registration returns HTTP `409 Conflict`, directing the patient to use their activation token.
- **Files Modified**: [`Portal Major P/Bhumi/Doctor portal/backend/src/controllers/authController.js`](file:///E:/Major%20Project%20Code/Portal%20Major%20P/Bhumi/Doctor%20portal/backend/src/controllers/authController.js).
- **Evidence**: Verified via [`scratch/test_patient_signup_and_loop.js`](file:///E:/Major%20Project%20Code/scratch/test_patient_signup_and_loop.js) (Tests 1-3).

### 2.3 In-Memory Sliding-Window Rate Limiter
- **Root Cause**: Authentication endpoints (`/api/auth/*`) lacked request throttling, leaving credential verification vulnerable to automated brute-force attacks.
- **Remediation**:
  1. Created [`rateLimiter.js`](file:///E:/Major%20Project%20Code/Portal%20Major%20P/Bhumi/Doctor%20portal/backend/src/middleware/rateLimiter.js) with sliding 60-second window, maximum 60 requests per IP address, returning HTTP `429 Too Many Requests` with `Retry-After: 60` and standard `X-RateLimit-*` headers.
  2. Implemented automated periodic 5-minute garbage collection of expired IP cache entries.
  3. Mounted middleware across all `/api/auth/*` routes in [`authRoutes.js`](file:///E:/Major%20Project%20Code/Portal%20Major%20P/Bhumi/Doctor%20portal/backend/src/routes/authRoutes.js).
- **Evidence**: Live HTTP query confirmed `X-RateLimit-Limit: 60`, `X-RateLimit-Remaining: 59`.

### 2.4 Patient Prescriptions View & Safety Reference Enhancement
- **Root Cause**: The patient prescription view previously rendered a blank screen if no records were found, and lacked explicit medication details inspection and rule coverage limitation notices.
- **Remediation**:
  1. Enhanced [`Prescriptions.jsx`](file:///E:/Major%20Project%20Code/Portal%20Major%20P/patient_frontend/src/views/Prescriptions.jsx) with honest empty states for both consultations and recorded medication regimens.
  2. Added expandable medication details panel displaying dosage, frequency, duration, instructions, and prescribing physician.
  3. Added prominent clinical context differentiation banner and drug interaction rule coverage limitation disclaimers.
  4. Added recoverable error UI with retry loading button.
- **Files Modified**: [`Portal Major P/patient_frontend/src/views/Prescriptions.jsx`](file:///E:/Major%20Project%20Code/Portal%20Major%20P/patient_frontend/src/views/Prescriptions.jsx).
- **Evidence**: Production build passed in 180ms with 0 errors; verified via browser tests.

### 2.5 Test Script Credential Sanitization & Git Ignore Rules
- **Root Cause**: Test script `scratch/test_aarav_pass.js` contained trial password arrays, and database backup dumps (`scratch/*.sql`) were not explicitly ignored.
- **Remediation**:
  1. Sanitized `test_aarav_pass.js` to validate bcrypt hash structure directly (`$2b$10$` and length 60).
  2. Added `scratch/*.sql` and `scratch/*.log` to [`.gitignore`](file:///E:/Major%20Project%20Code/.gitignore).
- **Files Modified**: [`scratch/test_aarav_pass.js`](file:///E:/Major%20Project%20Code/scratch/test_aarav_pass.js), [`.gitignore`](file:///E:/Major%20Project%20Code/.gitignore).

---

## 3. Patient Prescriptions & Cross-Patient BOLA/IDOR Evidence

The platform enforces strict server-side scoping of patient health records:
- **Server-Derived Identity**: All patient database operations derive patient identity exclusively from authenticated JWT claims (`req.user.user_id`).
- **BOLA Protection**: Passing arbitrary `patient_id` or `user_id` query/body parameters returns HTTP `403 Forbidden` (`Access denied: Patients are strictly prohibited from accessing another patient's health context`).
- **Read-Only Invariant**: Patient prescription routes (`GET /api/patient/prescriptions`, `GET /api/patient/medications`) are strictly read-only.
- **Empty State Fidelity**: A new synthetic patient receives an honest empty array (`[]`) and view, never fictitious or hardcoded demo records.
- **Evidence**:
  - `scratch/test_patient_and_discharge.js`: 14/14 passed.
  - `scratch/test_portal_cds_responsibilities.js` (Tests 11-17): 7/7 passed.
  - `scratch/test_full_system_multi_role_e2e.js` (Step 5 & 6): passed.

---

## 4. Multilingual Module: End-to-End Verification by Language

The multilingual pipeline implements a deterministic Indic script detection and canonical normalization architecture without unverified neural translation layers.

### 4.1 Per-Language Test Results

| Language | Test Suite | Scope | Pass / Total | Status | Key Normalization / Findings |
| :--- | :--- | :--- | :---: | :---: | :--- |
| **English (`en`)** | `test_multilingual.py` | Query unaltered, DailyMed RAG retrieval, citations | 5 / 5 | **PASS** | Canonical baseline; full RAG retrieval & cross-encoder reranking. |
| **Hindi (`hi`)** | `test_multilingual.py` | Devanagari detection, numeral normalization, drug transliteration | 6 / 6 | **PASS** | Devanagari numerals normalized to ASCII; queries like `मेटफॉर्मिन` mapped to `Metformin`. |
| **Marathi (`mr`)** | `test_multilingual.py` | Devanagari + Marathi script markers (`ळ`), hypertension queries | 5 / 5 | **PASS** | Distinct lexical markers handled; localized emergency diversion verified. |
| **Gujarati (`gu`)** | `test_multilingual.py` | Gujarati Unicode range (`[\u0A80-\u0AFF]`), emergency & injection | 4 / 4 | **PASS** | Prompt injection blocked; acute emergency queries diverted immediately. |

### 4.2 Known Linguistic Limitations (Documented, Not Hidden)
1. **Corpus Language**: The clinical knowledge base (2,204 chunks) is authored in English. Multilingual support operates via deterministic canonicalization into English for retrieval, followed by localized response templating.
2. **Clinical Correctness Disclaimer**: Independent board-certified clinical review of Indic phrasing has not been conducted by a licensed physician fluent in Hindi/Marathi. Linguistic correctness is an academic demonstration and marked **UNVERIFIED FOR CLINICAL USE**.

---

## 5. Database Configuration, Persistence & Backup Safety

- **Active Database**: `rag_healthcare`
- **Host & Port**: `localhost:3306` (MySQL Server 8.0)
- **Active Table Schema (13 Normalized Tables)**:
  `users`, `doctors`, `patients`, `appointments`, `prescriptions`, `prescription_medicines`, `medical_history`, `symptoms`, `medical_reports`, `doctor_schedule`, `patient_vitals`, `discharges`, `prescription_ocr_jobs`, `account_activations`.
- **Persistence Verification**:
  - Inserted synthetic patient records into MySQL.
  - Stopped and restarted the Express gateway service.
  - Re-queried MySQL via read-only inspection; verified 100% record persistence.
- **Backup & Recovery Parity ([`scratch/test_backup_and_recovery.js`](file:///E:/Major%20Project%20Code/scratch/test_backup_and_recovery.js))**:
  - Dumps active `rag_healthcare` database using `mysqldump`.
  - Restores into isolated disposable database `rag_healthcare_restore_test`.
  - Verified 100% table count parity (13 tables) and 100% row count parity across all tables.
  - Cleaned up temporary test database safely.

---

## 6. Corpus Provenance, Currency, Coverage & Preservation Audit

### 6.1 Corpus Composition & Verification Hashes
The production FAISS index and metadata files were verified using SHA-256 computation:
- **Total Production Chunks**: Exactly **2,204 chunks**.
- **Embedding Model**: `BAAI/bge-small-en` (384 dimensions, L2-normalized).
- **Index Artifact Hashes**:
  - `rag_module/data/faiss_index/index_v2.bin`: `70c7b0f4ec73effe49a9478aa2c3d3748753e7379f92fe0578b3d82932a1c35f`
  - `rag_module/data/faiss_index/meta_v2.pkl`: `8e309931b87f8c944409839e4e44a39d3d213a992dd7bc3feeb6df7363e50d3e`
  - `rag_module/data/faiss_index/bm25_index.pkl`: `26330911f65a40b17f5165f655a5a6cff83786bfc77cdb1a18843137394caeca`

### 6.2 Source Distribution & Provenance Metadata

| Knowledge Source | Canonical Publisher | Chunks | Proportion | Provenance URL / ID | Verification Status |
| :--- | :--- | :---: | :---: | :--- | :---: |
| **DailyMed** | U.S. National Library of Medicine / FDA | 2,176 | 98.73% | `https://dailymed.nlm.nih.gov/` | VERIFIED |
| **MedlinePlus** | U.S. National Library of Medicine | 16 | 0.73% | `https://medlineplus.gov/` | VERIFIED |
| **ICMR** | Indian Council of Medical Research | 8 | 0.36% | `https://www.icmr.gov.in/` | VERIFIED |
| **MoHFW STG** | Ministry of Health & Family Welfare (India) | 4 | 0.18% | Standard Treatment Guidelines | VERIFIED |
| **Total** | | **2,204** | **100.0%** | **100% Unique Chunk IDs** | **VERIFIED** |

- **Chunk ID Uniqueness**: 2,204 unique IDs / 2,204 total chunks (0 duplicates).
- **URL Provenance**: 0 missing URLs across all 2,204 metadata entries.
- **Preservation Check**: Preserved punctuation, numeric doses, units (mg, mcg), contraindication headings, and population qualifiers.

---

## 7. RAG Evidence-Disclosure & Safety Invariants Audit

The frozen RAG V2.10 pipeline was audited against the 10 evidence disclosure invariants:

| # | Invariant Description | Implementation Location | Audit Finding | Status |
| :-: | :--- | :--- | :--- | :---: |
| 1 | Exact passages in generation prompt captured as immutable evidence $E$ | `rag_pipeline.py:306-309` (`accepted_chunks`) | $E$ explicitly bounded to accepted chunks | **VERIFIED** |
| 2 | Verifier evaluates strictly against same evidence $E$ | `rag_pipeline.py:322` (`evidence_chunks=accepted_chunks`) | Verifier receives exact accepted chunks | **VERIFIED** |
| 3 | Citations map only to passages in $E$ | `rag_pipeline.py:323` | Citations verified against accepted chunks | **VERIFIED** |
| 4 | Empty proposition extraction cannot pass automatically | `grounding_verifier.py:840` | Empty claims default to ungrounded | **VERIFIED** |
| 5 | Proposition checks: entity, polarity, numeric, units, frequency, qualifier | `grounding_verifier.py:650-780` | Rigorous deterministic AST check | **VERIFIED** |
| 6 | Partial-answer reconstruction reverified fully | `rag_pipeline.py:329-332` | Reverified before disclosure | **VERIFIED** |
| 7 | Dosage fallbacks cannot bypass verification | `rag_pipeline.py:344-349` | Rendered dosage candidate explicitly reverified | **VERIFIED** |
| 8 | Every response passes disclosure gate or abstains fail-closed | `rag_pipeline.py:355-384` | Unverified responses suppressed | **VERIFIED** |
| 9 | Final emitted text is exactly the verified text | `rag_pipeline.py:327, 331, 350` | Standard disclaimer appended to verified text | **VERIFIED** |
| 10 | Traces auditable without exposing patient PII | `app.js` & `rag_pipeline.py` | Direct identifiers stripped before RAG | **VERIFIED** |

---

## 8. Drug Interaction Screening & Prescription Extraction

### 8.1 Drug Interaction & Side Effect Engine
- **Interaction Rules**: Exactly **8 verified high-severity interaction rules** (`data/rules/medication_interactions/medication_interactions.json`) sourced from DrugBank.
- **Side Effect Profiles**: Exactly **20 verified drug profiles** (`data/rules/medication_interactions/medication_side_effects.json`) sourced from DailyMed FDA SPL.
- **Rule Matching Limitation**: If candidate drugs do not trigger an alert, the engine clearly states that "no interaction was found in the configured rules" rather than claiming complete safety.

### 8.2 Prescription Extraction & OCR Pipeline
- **Extractor**: spaCy 3.7.5 entity ruler (`prescription_module/extractor.py`) with 28 drug patterns and structured regex for dosage, route, frequency, duration, and instructions.
- **OCR Engine**: Tesseract.js image extraction with magic-byte validation (`image/png`, `image/jpeg`).
- **Clinician Review Invariant**: Extracted OCR jobs default strictly to `pending_review`. Zero prescriptions are committed to the patient's record without explicit doctor sign-off.

---

## 9. Archive, Test & Documentation Cleanup Manifest

| Item / Path | Classification | Action Taken | Rationale & Reference |
| :--- | :---: | :---: | :--- |
| `Portal Major P/Bhumi/Doctor portal.zip` | Teammate Archive | **KEEP** | Original unmerged source archive delivered by teammate Bhumi. Preserved for disaster recovery. |
| `Portal Major P/Ketki/healthcare_project.zip` | Teammate Archive | **KEEP** | Original unmerged source archive delivered by teammate Ketki. Preserved for disaster recovery. |
| `scratch/pre_cleanup_backup.sql` | Synthetic DB Dump | **KEEP & IGNORE** | Verified isolated test backup. Added `scratch/*.sql` to `.gitignore` to prevent source control exposure. |
| `scratch/test_aarav_pass.js` | Test Utility | **REDACT & KEEP** | Removed plaintext trial passwords; replaced with bcrypt hash structure validation. |
| `scratch/test_patient_signup_and_loop.js` | Regression Suite | **KEEP** | Consolidated verification for patient registration, privilege escalation guards, and login loop resolution. |
| `docs/SECURITY_AND_AUTHORIZATION.md` | Historical Audit | **KEEP AS REFERENCE** | Retained as historical security audit; superseded by canonical `docs/SECURITY.md`. |
| `docs/SECURITY.md` | Canonical Specification | **CREATED / CANONICAL** | Authoritative security architecture, RBAC matrix, rate limiting, and BOLA defenses. |
| `docs/FINAL_VERIFICATION_REPORT.md` | Master Verification | **CREATED / CANONICAL** | Authoritative release gate evaluation and technical audit record. |

---

## 10. Authoritative Documentation Set

The authoritative documentation set was refined to eliminate contradictions:
1. [`README.md`](file:///E:/Major%20Project%20Code/README.md): Accurate port layout (5000, 5173, 5174, 5175, 8000, 3306), startup runbook, demo accounts, and clinical disclaimers.
2. [`AGENTS.md`](file:///E:/Major%20Project%20Code/AGENTS.md): Strict operational manual and non-negotiable frozen RAG invariants.
3. [`docs/SECURITY.md`](file:///E:/Major%20Project%20Code/docs/SECURITY.md): Threat model, RBAC matrix, rate limiting, and BOLA defenses.
4. [`docs/ARCHITECTURE.md`](file:///E:/Major%20Project%20Code/docs/ARCHITECTURE.md): Architecture topology, trust boundaries, and EHR/RAG context flow.
5. [`docs/CURRENT_STATE.md`](file:///E:/Major%20Project%20Code/docs/CURRENT_STATE.md): Canonical state inventory and baseline references.
6. [`docs/DEVELOPMENT.md`](file:///E:/Major%20Project%20Code/docs/DEVELOPMENT.md): Local development setup, migrations, and runbook.
7. [`docs/TESTING.md`](file:///E:/Major%20Project%20Code/docs/TESTING.md): Canonical test commands and 6-tier test matrix.
8. [`docs/DEPLOYMENT.md`](file:///E:/Major%20Project%20Code/docs/DEPLOYMENT.md): Staging, public cloud, and clinical deployment requirements and blockers.

---

## 11. Final Regression Test Matrix

| # | Test Tier & Suite | Exact Command | Scope | Pass / Total | Exit Code | Final-Code Status |
| :-: | :--- | :--- | :--- | :---: | :-: | :---: |
| 1 | **Frozen RAG Core** | `python -m pytest rag_module/tests/ -q` | Retrieval, reranker, verifier, emergency triage | **190 / 190** (2 skipped) | 0 | **VERIFIED** |
| 2 | **Multilingual Foundation** | `python -m pytest multilingual_module/tests/ -v` | Language detection, Devanagari normalization, canonicalizer | **20 / 20** | 0 | **VERIFIED** |
| 3 | **CDS Gateway & Boundary** | `python -m pytest cds_module/ -v` | Express/FastAPI boundary, PII stripping, prescription screening | **9 / 9** | 0 | **VERIFIED** |
| 4 | **Patient Signup & Loop** | `node scratch/test_patient_signup_and_loop.js` | Privilege escalation, arbitrary ID rejection, loop resolution | **7 / 7** | 0 | **VERIFIED** |
| 5 | **Account Lifecycle & RBAC**| `node scratch/test_activation_and_role_mismatch.js` | Single-use tokens, bcrypt hashing, BOLA/IDOR, role mismatch | **20 / 20** | 0 | **VERIFIED** |
| 6 | **Express Gateway Bridge** | `node scratch/test_phase3_express_bridge.js` | Reverse-proxy bridge, error handling, security headers | **7 / 7** | 0 | **VERIFIED** |
| 7 | **Portal Responsibilities** | `node scratch/test_portal_cds_responsibilities.js` | Role permissions matrix (Doctor/Patient/Receptionist) | **25 / 25** | 0 | **VERIFIED** |
| 8 | **Doctor Portal E2E** | `node scratch/test_doctor_portal_e2e.js` | Dashboard, patient selection, CDS query, citations, OCR | **26 / 26** | 0 | **VERIFIED** |
| 9 | **Receptionist Endpoints** | `node scratch/test_receptionist_endpoints.js` | Registration, appointments, activation token generation | **9 / 9** | 0 | **VERIFIED** |
| 10 | **Patient & Discharge Care**| `node scratch/test_patient_and_discharge.js` | Discharge summaries, follow-up viewing, educational CDS | **14 / 14** | 0 | **VERIFIED** |
| 11 | **Prescription OCR** | `node scratch/test_prescription_ocr_pipeline.js` | Magic-byte validation, offline Tesseract, pending review, sign-off | **12 / 12** | 0 | **VERIFIED** |
| 12 | **Multi-Role Synthetic E2E**| `node scratch/test_full_system_multi_role_e2e.js` | Full synthetic lifecycle across all three roles | **20 / 20** | 0 | **VERIFIED** |
| 13 | **Database Backup & Recovery**| `node scratch/test_backup_and_recovery.js` | mysqldump dump and isolated restore parity | **1 / 1** | 0 | **VERIFIED** |
| 14 | **Frontend Production Builds**| `npm run build` (all 4 frontends) | Doctor, Receptionist, Patient, Root portals | **4 / 4** | 0 | **VERIFIED** |

---

## 12. Actual Browser E2E Evidence

Live browser automation verified the complete patient journey on port 5175:
1. **Authentication Form Rendering**: Form rendered on `http://localhost:5175/` with responsive tabs ("Sign In" and "Create Account").
2. **Invalid Credentials Recovery**: Entering incorrect credentials displayed a helpful error message without redirect loops.
3. **Session Persistence**: Successful login authenticated the user, stored the JWT token in `localStorage`, and rendered the dashboard. Reloading the page (`F5`) restored the active session without flickering or logging out.
4. **Prescriptions View**:
   - Tested active patient prescription display with clinical diagnosis, medicine name, dosage, frequency, and instructions.
   - Tested medication details drawer showing persisted facts, clinical context differentiation, and rule coverage disclaimers.
   - Tested empty prescription state for newly registered synthetic patient with zero linked records.
5. **Secure Logout**: Logging out cleared the JWT session and redirected to the Sign In screen; clicking browser Back prevented access to protected health information.
6. **Network Isolation**: All browser network requests routed exclusively through `http://localhost:5000/api/*`. **Zero browser calls were made directly to port 8000 or port 3306.**

---

## 13. Release Gates & Deployment Status

- **Local Synthetic Demonstration**: **READY** (All 14 test tiers passing, scripts operational, multi-role portal workflows verified).
- **Staging Environment**: **BLOCKED** (Requires edge TLS 1.3 / HTTPS termination on port 443, non-root database user, managed cloud secrets, and a production transactional email/SMS delivery provider).
- **Public Cloud Production**: **BLOCKED** (Requires VPC subnet isolation keeping FastAPI :8000 and MySQL :3306 completely private, WAF rate limiting, and container orchestration).
- **Real Clinical Patient Use**: **BLOCKED** (Academic research prototype. Unvalidated on real handwritten prescription OCR or prospective clinical trials. Prohibited for real clinical diagnostic, prescribing, or dispensing decisions).

---

## 14. Explicit Items Not Run, Unverified, or Needing Human Review

1. **NOT RUN**: Prospective clinical trials or real patient evaluations (strictly out of scope for an academic prototype).
2. **UNVERIFIED**: Linguistic and clinical fluency of Devanagari Hindi/Marathi phrasing by a certified bilingual medical professional.
3. **NEEDS HUMAN REVIEW**:
   - Production secrets management prior to any future cloud deployment.
   - Separate research paper review (deferred as explicitly requested; manuscript was not opened or audited).
