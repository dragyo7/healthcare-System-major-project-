# Project Roadmap & Phase Progression

> **Document Type**: Master Project Engineering Roadmap
> **Project**: Modular AI-Powered Multilingual Clinical Decision Support System (4th-Year Major Project)
> **Authoritative Branch**: `main` (Merged and Hardened Baseline `5a03d85`)
> **Status**: **ALL PHASES (0–9) COMPLETE, VERIFIED & MERGED TO MAIN**
> **Date**: October 2026

---

## Phase Overview

```text
┌────────────────────────┐
│ PHASE 0: RAG CORE      │  [COMPLETE / HARD FROZEN - Commit 497a547]
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ PHASE 1: CDS GATEWAY   │  [COMPLETE / VERIFIED - 9/9 Tests Passed]
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ PHASE 2: DOCTOR PORTAL │  [COMPLETE / VERIFIED - 26/26 Tests Passed]
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ PHASE 3: MULTILINGUAL  │  [COMPLETE / VERIFIED - 16/16 Tests Passed]
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ PHASE 4: RECEPTIONIST  │  [COMPLETE / VERIFIED - 9/9 Tests Passed]
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ PHASE 5: PATIENT MOD.  │  [COMPLETE / VERIFIED - 14/14 Tests Passed]
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ PHASE 6: DISCHARGE     │  [COMPLETE / VERIFIED - Migration 002]
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ PHASE 7: OCR / IMAGES  │  [COMPLETE / VERIFIED - 12/12 Tests Passed]
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ PHASE 8: FULL SYS E2E  │  [COMPLETE / VERIFIED - 20/20 Tests Passed]
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ PHASE 9: RBAC & SEC    │  [COMPLETE / VERIFIED - 12/12 Tests Passed]
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ FINAL RELEASE MERGE    │  [MERGED TO MAIN - Commit cbee83a -> 5a03d85]
└────────────────────────┘
```

---

## Detailed Phase Breakdown

### PHASE 0 — Medical Evidence RAG Foundation
* **Status**: **COMPLETE / HARD FROZEN** (Baseline Commit `497a547`)
* **Scope Completed**:
  * Ingestion of 2,204 DailyMed SPL monograph knowledge chunks.
  * Dense FAISS index (`BAAI/bge-small-en`, 384 dimensions) and BM25 lexical retriever.
  * Reciprocal Rank Fusion (`k=60`) and Cross-Encoder second-stage reranker (`cross-encoder/ms-marco-MiniLM-L-6-v2`).
  * `EvidencePolicyEngine` with dynamic entity isolation.
  * Deterministic `AnswerGroundingVerifier` and fail-closed safety policy.
  * Baseline Test Suite: 190 passed, 2 skipped, 0 failed.

---

### PHASE 1 — CDS Gateway & Security Foundation
* **Status**: **COMPLETE / VERIFIED**
* **Scope Completed**:
  * Unified FastAPI CDS Gateway (`/cds/evaluate`, `/cds/screen-prescription`).
  * Role-scoped execution modes (`doctor`, `patient`, non-clinical `receptionist` rejection).
  * Integration of deterministic `drug_module` interaction engine (DrugBank 8 rules, SIDER 20 profiles).
  * Emergency triage diversion (108/112) and prompt injection early blocking.
  * Automated Gateway Test Suite: 9/9 passed.

---

### PHASE 2 — Teammate Doctor Portal Integration & E2E Verification
* **Status**: **COMPLETE / VERIFIED**
* **Scope Completed**:
  * Express backend bridge (`POST /api/doctor/cds` $\to$ `POST /cds/evaluate`).
  * Server-side BOLA authorization defense on all patient endpoints.
  * Request-scoped Zero-PII patient context sanitization.
  * Browser $\to$ Express $\to$ FastAPI $\to$ Express $\to$ Browser network path verification.
  * Live browser verification of Doctor Dashboard, Patient Dossier, PDF generation, and in-dossier CDS Assistant.
  * Express Bridge Suite: 7/7 passed.
  * Portal Responsibilities Suite: 25/25 passed.
  * Doctor Portal E2E Suite: 26/26 passed.

---

### PHASE 3 — Multilingual Foundation Layer
* **Status**: **COMPLETE / VERIFIED**
* **Scope Completed**:
  * Independent cross-cutting architecture (`multilingual_module/`).
  * Deterministic language detection for English, Hindi, and Marathi.
  * Medical concept normalization and canonical query representation preserving drug names, dosages, units, and negations.
  * Authoritative trilingual safety templates for emergency diversion (112/108), prompt injection blocks, and drug interactions.
  * Integration with CDS orchestrator with zero modification to frozen RAG indices.
  * Multilingual Test Suite: 16/16 passed.

---

### PHASE 4 — Secure Receptionist Integration
* **Status**: **COMPLETE / VERIFIED**
* **Scope Completed**:
  * Integrated front-desk receptionist interface into the unified frontend on port 5173.
  * Receptionist administrative routes (`/api/receptionist/doctors`, `/api/receptionist/patients`, `/api/receptionist/appointments`).
  * Enforced strict server-side rejection of any clinical RAG or CDS requests by administrative accounts (HTTP 403 Forbidden).
  * Receptionist Endpoints Test Suite: 9/9 passed.

---

### PHASE 5 — Patient Self-Service Portal
* **Status**: **COMPLETE / VERIFIED**
* **Scope Completed**:
  * Integrated Patient self-service portal into the unified frontend.
  * Patient personal health metrics, appointment history, active prescriptions, and discharge directives.
  * BOLA isolation: Patient token strictly bound to caller identity; cross-patient parameter tampering rejected.
  * Educational patient guidance with internal chunk IDs and scores redacted.
  * Patient & Discharge Care Suite: 14/14 passed.

---

### PHASE 6 — Post-Discharge Care & Follow-Up
* **Status**: **COMPLETE / VERIFIED**
* **Scope Completed**:
  * Applied database migration `002_create_discharges_table.sql`.
  * Doctor endpoint `POST /api/doctor/discharge` for authorizing discharge directives, follow-up dates, and red-flag warning signs.
  * Patient endpoint `GET /api/patient/discharge` for viewing discharge care plans.
  * Grounded patient post-discharge assistant (`POST /api/patient/cds`) answering recovery questions based strictly on the patient's authorized care plan.

---

### PHASE 7 — Prescription Image OCR Pipeline
* **Status**: **COMPLETE / VERIFIED**
* **Scope Completed**:
  * Applied database migration `003_create_prescription_ocr_jobs.sql`.
  * Multer magic-byte upload validation preventing non-image file uploads.
  * Offline Tesseract.js optical character recognition engine with regex clinical entity extraction (`drug`, `dose`, `route`, `frequency`, `duration`).
  * Strict Human Clinician Invariant: Extracted prescriptions remain in unconfirmed draft status (`needs_review: true`) until explicitly reviewed and confirmed via `POST /api/doctor/prescriptions/confirm-ocr`.
  * Prescription OCR Pipeline Test Suite: 12/12 passed.

---

### PHASE 8 — Full-System Multi-Role Synthetic Journey
* **Status**: **COMPLETE / VERIFIED**
* **Scope Completed**:
  * Complete synthetic cross-role lifecycle execution:
    1. Receptionist registers patient and books appointment.
    2. Doctor consults, reviews patient dossier, runs CDS inquiries, screens prescriptions for interactions, and persists the prescription.
    3. Doctor authors post-discharge recovery instructions.
    4. Patient logs in, reviews prescriptions, downloads PDF, and queries post-discharge assistant in English and Indic languages.
  * Negative security test matrix (tampered IDs, unauthorized PDF access, invalid tokens).
  * Multi-Role Synthetic Journey Test Suite: 20/20 passed.

---

### PHASE 9 — Secure Role Selection, Account Lifecycle & RBAC
* **Status**: **COMPLETE / VERIFIED**
* **Scope Completed**:
  * Applied database migration `004_create_account_activations.sql`.
  * Role selection entry point supporting Doctor, Receptionist, and Patient logins.
  * Eliminated all universal/default passwords: patient intake generates a cryptographically random 32-byte single-use activation token.
  * Patient activation page (`/activate?token=...`) with 48-hour expiration and immediate anti-replay invalidation upon consumption.
  * Server-side role-mismatch defense (e.g., Patient attempting to authenticate via Doctor login).
  * Account Activation & RBAC Suite: 12/12 passed.

---

### Final Release Integration & Hardening
* **Status**: **MERGED TO MAIN & HARDENED** (Merge commit `cbee83a`, hardened through `5a03d85`)
* **Scope Completed**:
  * MySQL session advisory locks (`rx_lock_<docId>_<patId>`) enforcing concurrent prescription creation idempotency and fail-closed timeout (HTTP 503 with 0 orphaned rows).
  * Doctor and Patient prescription PDF ownership authorization with zero PDF bytes streamed on unauthorized requests (HTTP 403).
  * Modal backdrop rendering repair with semantic CSS tokens and Escape key dismiss.
  * Strict date range (`1900-01-01` to current date) and sanitized emergency contact field validation in patient registration.
  * Production bundle compilation verified: Vite 8 + React 19 (1.03s, 0 errors).
  * Root `README.md` and research manuscript (`Complete_Healthcare_CDS_Research_Paper_Final_v2.10.docx` & `.pdf`) synchronized with empirical findings.
