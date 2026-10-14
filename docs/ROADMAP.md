# Project Roadmap & Phase Progression

> **Document Type**: Master Project Engineering Roadmap  
> **Project**: Modular AI-Powered Multilingual Clinical Decision Support System  
> **Date**: October 2026  
> **Current Position**: **Phase 3 Complete / Standing by for Phase 4 & Phase 5 Teammate Modules**  

---

## Phase Overview

```text
┌────────────────────────┐
│ PHASE 0: RAG CORE      │  [COMPLETE / HARD FROZEN]
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ PHASE 1: CDS GATEWAY   │  [COMPLETE / VERIFIED]
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ PHASE 2: DOCTOR PORTAL │  [COMPLETE / VERIFIED]
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ PHASE 3: MULTILINGUAL  │  [COMPLETE / VERIFIED]
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ PHASE 4: PATIENT MOD.  │  [WAITING FOR TEAMMATE]
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ PHASE 5: RECEPTIONIST  │  [WAITING FOR TEAMMATE]
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ PHASE 6: OCR / IMAGES  │  [FUTURE SCOPE]
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ PHASE 7: FULL SYS E2E  │  [FUTURE SCOPE]
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ PHASE 8: RAG TUNING    │  [FUTURE SCOPE]
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ PHASE 9: DEPLOYMENT    │  [FUTURE SCOPE]
└────────────────────────┘
```

---

## Detailed Phase Breakdown

### PHASE 0 — Medical Evidence RAG Foundation
* **Status**: **COMPLETE / HARD FROZEN** (Baseline Commit `497a547`)
* **Scope Completed**:
  * Ingestion of 2,204 DailyMed SPL monograph knowledge chunks.
  * Dense FAISS index (`BAAI/bge-small-en`, 384 dimensions) and BM25 lexical retriever.
  * Reciprocal Rank Fusion (`k=60`) and Cross-Encoder second-stage reranker.
  * `EvidencePolicyEngine` with dynamic entity isolation.
  * Deterministic `AnswerGroundingVerifier` and fail-closed safety policy.
  * Baseline Test Suite: 190 passed, 2 skipped, 0 failed.

---

### PHASE 1 — CDS Gateway & Security Foundation
* **Status**: **COMPLETE / VERIFIED**
* **Scope Completed**:
  * Unified FastAPI CDS Gateway (`/cds/evaluate`, `/cds/screen-prescription`).
  * Role-scoped execution modes (`doctor`, `patient`, non-clinical `receptionist` rejection).
  * Integration of deterministic `drug_module` interaction engine (DrugBank, SIDER).
  * Emergency triage diversion and prompt injection early blocking.
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

### PHASE 4 — Patient Module Integration
* **Status**: **WAITING FOR TEAMMATE**
* **Upcoming Scope**:
  * Ingest teammate Patient Portal frontend component into the platform.
  * Connect to Express `/api/patient/cds` endpoint under `mode="patient"`.
  * Validate that patients can only evaluate their own medical history (BOLA enforcement).
  * Validate educational patient guidance with internal chunk IDs and scores redacted.
  * Verify multilingual query submission (Hindi/Marathi) from the Patient UI.

---

### PHASE 5 — Receptionist Module Integration
* **Status**: **WAITING FOR TEAMMATE**
* **Upcoming Scope**:
  * Ingest teammate Receptionist Portal frontend component into the platform.
  * Verify administrative endpoints (patient registration, appointment booking, doctor schedules).
  * Enforce strict rejection of any clinical RAG or CDS requests by administrative accounts (HTTP 403 Forbidden).

---

### PHASE 6 — Prescription OCR & Image Parsing Integration
* **Status**: **FUTURE SCOPE**
* **Upcoming Scope**:
  * Ingest handwritten/printed prescription image uploads.
  * OCR extraction via vision pipeline, normalizing text into structured medication objects (`drug`, `dose`, `route`, `frequency`, `duration`).
  * Feed parsed medications directly into `/cds/screen-prescription` for instantaneous safety checks.

---

### PHASE 7 — Full-System End-to-End Validation
* **Status**: **FUTURE SCOPE**
* **Upcoming Scope**:
  * Cross-portal live lifecycle testing:
    * Receptionist registers patient and books appointment.
    * Doctor consults, reviews dossier, queries CDS in Hindi/Marathi, and prescribes medications.
    * Patient logs in to view prescription, review educational guidance, and check interaction warnings.
  * Platform-wide automated integration test run.

---

### PHASE 8 — Targeted RAG Accuracy & Latency Optimization
* **Status**: **FUTURE SCOPE (AFTER COMPLETE SYSTEM INTEGRATION)**
* **Upcoming Scope**:
  * Benchmark token verification thresholds without relaxing fail-closed guarantees.
  * Evaluate compact generator fine-tuning or quantization to reduce inference latency.
  * Evaluate expanding DailyMed SPL coverage beyond primary care medications.

---

### PHASE 9 — Production Hardening & Container Deployment
* **Status**: **FUTURE SCOPE**
* **Upcoming Scope**:
  * Author consolidated multi-service `docker-compose.yml` (MySQL, Express, FastAPI, Vite).
  * Configure environment variable injection, TLS termination, and production database seed scripts.
  * Author formal major project deployment guide and examiner evaluation manual.
