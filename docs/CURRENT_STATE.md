# CURRENT STATE — CANONICAL PROJECT BASELINE

> **Document Type**: Authoritative Canonical Project State  
> **Repository Branch**: `feature/cds-gateway` (Merged from `feature/rag-v2-foundation` & Teammate Doctor Portal)  
> **Status**: **VERIFIED & OPERATIONAL BASELINE (All Phases Complete: Phase 0 RAG, Phase 1 CDS Gateway, Phase 2 Doctor E2E, Phase 3 Multilingual, Phase 4 Receptionist Integration, Phase 5 Patient Portal, Phase 6 Discharge Care, Phase 7 Prescription OCR Pipeline, Phase 8 Full-System Multi-Role E2E)**  
> **Date**: October 2026  
> **Authoritative Baseline Reference**: Hardened Frozen RAG V2.10 + CDS Gateway + Express EHR + Doctor Portal (5173) + Receptionist Portal (5174) + Patient Portal (5175) + Offline OCR Pipeline  

---

## 1. Project Overview

This project is a **Modular AI-Powered Multilingual Clinical Decision Support (CDS) System** designed as a 4th-year Major Project for healthcare environments.

The system connects three role-specific portals (Doctor, Patient, Receptionist) to a centralized clinical intelligence engine:
1. **Evidence-Grounded Medical Intelligence (RAG)**: Multi-source, citation-backed answers with strict fail-closed verification.
2. **Deterministic Medication Safety Engine (`drug_module`)**: Multi-drug interaction screening and contraindication detection based on verified clinical rules (DrugBank, SIDER).
3. **Prescription Extraction & Safety Flow (`prescription_module`)**: Structured prescription entity extraction, offline OCR (`tesseract.js`) image scanning, and safety screening.
4. **Post-Discharge Care & Follow-Up**: Doctor discharge summaries, red-flag warning signs, and restricted patient post-discharge CDS.
5. **Multilingual Foundation (`multilingual_module`)**: Cross-cutting language identification, canonical medical normalization, and localized response generation for English, Hindi, and Marathi.
6. **Electronic Health Record (EHR) Gateway (`backend`)**: Express + MySQL backend enforcing server-side JWT authentication, role-based access control (RBAC), Broken Object Level Authorization (BOLA) defenses, and Zero-PII sanitization.

---

## 2. Current Architecture

```text
┌───────────────────────┐ ┌───────────────────────────┐ ┌────────────────────────┐
│ Doctor React Frontend │ │ Receptionist Frontend     │ │ Patient React Frontend │
│ (Port 5173 - Bhumi)   │ │ (Port 5174 - Ketki Adapt) │ │ (Port 5175 - New)      │
└───────────┬───────────┘ └─────────────┬─────────────┘ └───────────┬────────────┘
            │                           │                           │
            └───────────────────────────┼───────────────────────────┘
                                        │ HTTP (localhost:5000/api/*)
                                        ▼
                   ┌─────────────────────────────────────────┐
                   │          Express API Gateway            │  (Node.js on Port 5000)
                   │  • JWT Bearer Authentication (RBAC)     │
                   │  • Doctor-Patient BOLA Check            │
                   │  • Zero-PII Context Sanitizer           │
                   │  • Offline Prescription OCR Engine      │
                   └────────────┬──────────────────┬─────────┘
                                │                  │
                     SQL (3306) │                  │ HTTP (127.0.0.1:8000/cds/evaluate)
                                ▼                  ▼
           ┌───────────────────────┐  ┌────────────────────────────────────────────────────────┐
           │    MySQL Database     │  │                 FastAPI CDS Gateway                    │
           │   (rag_healthcare)    │  │                 (Python on Port 8000)                  │
           │ • Users (Doc, Pat,    │  │                                                        │
           │   Receptionist)       │  │  ┌──────────────────────┐    ┌──────────────────────┐  │
           │ • Patients & Profiles │  │  │ Multilingual Layer   │    │  Deterministic Drug  │  │
           │ • Medical Hist & Sym  │  │  │ (en / hi / mr)       │    │     Safety Engine    │  │
           │ • Prescriptions & Rx  │  │  │ • Detector           │    │ • DrugBank 8 Rules   │  │
           │ • Discharges (New)    │  │  │ • Canonicalizer      │    │ • SIDER 20 Profiles  │  │
           │ • OCR Jobs (New)      │  │  │ • Safety Templates   │    │ • Severity Rules     │  │
           │ • Appointments/Sched  │  │  └──────────┬───────────┘    └──────────┬───────────┘  │
           └───────────────────────┘  │             │                           │              │
                                      │             ▼                           ▼              │
                                      │  ┌──────────────────────────────────────────────────┐  │
                                      │  │              FROZEN MEDICAL RAG V2.10            │  │
                                      │  │ • 2,204 DailyMed SPL Knowledge Chunks            │  │
                                      │  │ • FAISS Dense (BAAI/bge-small-en 384D)           │  │
                                      │  │ • BM25 Lexical Retriever                         │  │
                                      │  │ • Reciprocal Rank Fusion (k=60)                  │  │
                                      │  │ • Cross-Encoder Reranker (ms-marco-MiniLM-L-6)   │  │
                                      │  │ • EvidencePolicyEngine (Dynamic Entity Isolation)│  │
                                      │  │ • AnswerGroundingVerifier (Token-Level Verified) │  │
                                      │  │ • Fail-Closed Abstention Safety Policy           │  │
                                      │  └──────────────────────────────────────────────────┘  │
                                      └────────────────────────────────────────────────────────┘
```

---

## 3. Current Branch & Git Baseline

* **Active Git Branch**: `feature/cds-gateway`
* **Baseline Commits**:
  * `497a547`: Hardened RAG V2.10 Core Freeze
  * `a825690`: Initial Doctor Dashboard integration
  * `893155a`: Verified E2E RAG Chat & Safety Banners
  * `58a2bcd`: Project State Consolidation & Freeze Baseline
  * `7b0867b`: Integration of Frozen RAG V2.10 with verified Teammate Doctor Portal

---

## 4. Frozen Components (DO NOT MODIFY)

The following components are **HARD FROZEN** and validated. They must NOT be altered without formal architectural review and regression benchmarks:

1. **RAG V2.10 Knowledge Base**:
   * FAISS dense index (`data/faiss_index/index_v2.bin`, 2,204 DailyMed SPL chunks, 384 dimensions)
   * Pre-computed metadata (`meta_v2.pkl`)
   * BAAI/bge-small-en dense embedding model
   * BM25 sparse lexical index
   * Reciprocal Rank Fusion (`k=60`)
   * Cross-Encoder reranker (`cross-encoder/ms-marco-MiniLM-L-6-v2`)
2. **RAG Safety & Verification Engine**:
   * `EvidencePolicyEngine` dynamic entity isolation rules
   * `AnswerGroundingVerifier` strict token-overlap verification contract
   * Fail-closed safety behavior (`abstained_policy`, `withheld_verification_failure`)
   * Emergency triage interception regexes (English)
   * Prompt-injection defense regexes (English)
3. **Zero-PII Gateway Boundary**:
   * Direct patient identifiers (`name`, `email`, `phone`, `address`, `patient_id`) must NEVER be forwarded to FastAPI.
   * Patient health data must NEVER be indexed into FAISS, BM25, or DailyMed storage.

---

## 5. Working & Verified Components

* **Doctor Portal Workflows (26/26 Verified)**:
  * Doctor authentication, JWT issuance, unauthenticated 401 blocking, patient-role 403 blocking.
  * Real MySQL dashboard metrics (zero mock data).
  * Patient list and comprehensive dossier hydration (demographics, history, symptoms, reports, prescriptions).
  * Server-side BOLA authorization defense (HTTP 403 on unlinked patient inspection).
  * PDF report streaming with path traversal protection.
  * Prescription drafting with MySQL transaction commitment and dynamic PDFKit rendering.
  * Appointment lifecycle state machine (`scheduled` $\to$ `completed` $\to$ `cancelled`).
  * Doctor consultation schedule slot CRUD.
  * In-dossier CDS Assistant (grounded queries, candidate medication screening, DrugBank interaction alerts, emergency diversion, unsupported query fail-closed abstention, prompt injection defense).
* **Receptionist Portal Workflows (9/9 Verified)**:
  * Receptionist authentication, JWT verification, and RBAC authorization boundary.
  * Verified endpoints: `GET /api/receptionist/doctors`, `GET /api/receptionist/patients`, `POST /api/receptionist/patients`, `GET /api/receptionist/appointments`, `POST /api/receptionist/appointments`, `PATCH /api/receptionist/appointments/:id/status`.
  * Administrative boundary: 403 Forbidden when receptionist attempts clinical CDS or patient dossier routes.
  * Adapted Ketki Receptionist React Frontend running on Port 5174 (`Portal Major P/Ketki/receptionist_frontend`).
* **Patient Self-Service Portal (14/14 Verified)**:
  * Patient authentication, JWT issuance, and patient identity scoping.
  * Verified endpoints: `GET /api/patient/profile`, `GET /api/patient/dashboard`, `GET /api/patient/medical-history`, `GET /api/patient/prescriptions`, `GET /api/patient/medications`, `GET /api/patient/discharge`, `GET /api/patient/appointments`, `POST /api/patient/cds`.
  * Restricted educational CDS assistant with sanitized patient context (Zero PII).
  * Dedicated Patient React Frontend running on Port 5175 (`Portal Major P/patient_frontend`).
* **Post-Discharge Care & Follow-Up (Verified)**:
  * Authoritative `discharges` table with `discharge_summary`, `follow_up_date`, `discharge_status`, `red_flag_warning_signs`, `dietary_lifestyle_precautions`.
  * Doctor endpoints: `POST /api/doctor/discharge` and `GET /api/doctor/patients/:patientId/discharge`.
  * Patient endpoint: `GET /api/patient/discharge`.
  * Patient post-discharge CDS queries with zero raw PII forwarding.
* **Prescription Image OCR & Extraction Pipeline (12/12 Verified)**:
  * Authoritative `prescription_ocr_jobs` table.
  * Express upload middleware `ocrUploadMiddleware.js` (Multer $\le 5$MB) with magic byte validation (PNG, JPEG, WebP) rejecting spoofed files with 400 Bad Request.
  * Offline `tesseract.js` OCR engine + regex entity parser (medication names, dosage, frequency, duration, route, instructions).
  * Explicit clinician review endpoint `POST /api/doctor/prescriptions/confirm-ocr`. Zero auto-confirm safety invariant verified.
* **Full-System Multi-Role Synthetic Journey (20/20 Verified)**:
  * End-to-end synthetic lifecycle tested: Receptionist patient registration & appointment booking $\to$ Doctor consultation, CDS assistant, and OCR prescription image scan & confirmation $\to$ Doctor discharge care creation with red-flag warning signs $\to$ Patient portal viewing demographics, prescriptions, discharge instructions, and running post-discharge health CDS $\to$ Multi-role negative security matrix (401/403 RBAC & BOLA defense).
* **Tier-Isolated Network Architecture**:
  * Browser $\to$ Express (port 5000) $\to$ FastAPI (port 8000) $\to$ Express $\to$ Browser.
  * Zero direct browser calls to port 8000.
* **Multilingual Foundation Layer (16/16 Verified)**:
  * Deterministic script & lexical marker language detection (English, Hindi, Marathi).
  * Canonical medical query normalization preserving dosages, units, numbers, and negations.
  * Authoritative trilingual safety templates for emergencies (112/108), injection blocking, and interaction warnings.
  * Response localization attaching DailyMed citations without unconstrained LLM generation.

---

## 6. Partially Implemented Components

* *None*. All planned portal workflows, post-discharge tracking, and prescription OCR extraction pipelines are fully implemented and verified in the live environment.

---

## 7. Missing Components (Deliberate / Future Scope)

* **Containerized Deployment (`docker-compose.yml`)**: Planned for Phase 9 production packaging.
* **Expanded DailyMed Drug Corpus**: Additional therapeutic drug classes beyond the 2,204 chunks planned for future corpus releases.

---

## 8. Verified Test Baseline

The current baseline is proven by the following automated test executions in the live environment:

| Test Suite | Command | Total | Passed | Skipped | Failed | Duration |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **RAG Regression Suite** | `pytest rag_module/tests/ -q` | 192 | **190** | 2 | 0 | 216s |
| **FastAPI CDS Gateway** | `pytest cds_module/ -v` | 9 | **9** | 0 | 0 | 130s |
| **Express $\to$ FastAPI Bridge** | `node scratch/test_phase3_express_bridge.js` | 7 | **7** | 0 | 0 | 3s |
| **Portal CDS Responsibilities** | `node scratch/test_portal_cds_responsibilities.js` | 25 | **25** | 0 | 0 | 4s |
| **Doctor Portal E2E Suite** | `node scratch/test_doctor_portal_e2e.js` | 26 | **26** | 0 | 0 | 5s |
| **Multilingual Foundation** | `pytest multilingual_module/tests/ -v` | 16 | **16** | 0 | 0 | 64s |
| **Receptionist Endpoints** | `node scratch/test_receptionist_endpoints.js` | 9 | **9** | 0 | 0 | 2s |
| **Patient & Discharge Care** | `node scratch/test_patient_and_discharge.js` | 14 | **14** | 0 | 0 | 4s |
| **Prescription OCR Pipeline** | `node scratch/test_prescription_ocr_pipeline.js` | 12 | **12** | 0 | 0 | 3s |
| **Full-System Multi-Role E2E**| `node scratch/test_full_system_multi_role_e2e.js` | 20 | **20** | 0 | 0 | 5s |
| **Account Activation & RBAC** | `node scratch/test_activation_and_role_mismatch.js` | 12 | **12** | 0 | 0 | 2s |
| **Total Automated Assertions**| **All 11 Suites Combined** | **342** | **340** | **2** | **0** | **~8m** |
| **Doctor Frontend Build** | `npm run build` (Doctor Portal :5173) | — | **0 errors** | — | — | 199ms |
| **Receptionist Frontend Build**| `npm run build` (Receptionist Portal :5174) | — | **0 errors** | — | — | 135ms |
| **Patient Frontend Build** | `npm run build` (Patient Portal :5175) | — | **0 errors** | — | — | 183ms |
| **Root Frontend Build** | `npm run build` (Root Frontend) | — | **0 errors** | — | — | 974ms |

> **Arithmetic Clarification Note**: An earlier audit report cited 308 passing tests by summing Suites 1–9 (190 + 9 + 7 + 25 + 26 + 16 + 9 + 14 + 12 = 308 passed, 2 skipped). When Suite 10 (Full-System Multi-Role Journey, 20 assertions) was included, the sum became 328. With Suite 11 (Account Activation & Role Mismatch, 12 assertions), the exact sum is 340 passed assertions and 2 skipped across all 11 suites.

---

## 9. Security Guarantees & Invariants

1. **Strict Server-Side BOLA Enforcement**:
   * Every patient-specific endpoint verifies the doctor-patient relationship in MySQL before reading or modifying clinical records.
   * Manipulating `patient_id` in URL parameters or request bodies returns HTTP 403 Forbidden.
2. **Zero-PII Forwarding**:
   * `sanitizePatientContext()` in `cdsBridgeService.js` explicitly strips patient name, email, phone, physical address, and database primary keys before contacting FastAPI.
3. **Role-Based CDS Boundary**:
   * Doctors receive full clinical monograph citations and internal chunk IDs.
   * Patients receive educational guidance with raw chunk IDs and similarity scores redacted.
   * Administrative/receptionist roles are rejected with HTTP 403 before any clinical intelligence execution.
4. **Deterministic Fail-Closed Behavior**:
   * Unindexed entities (e.g., fictitious medications) trigger immediate policy abstention.
   * Grounding verification failures withhold generated statements safely (`withheld_verification_failure`).
5. **Zero Auto-Confirm Safety Invariant (OCR)**:
   * OCR extraction results remain in `pending_review` until an authorized doctor explicitly confirms candidate entities. No direct insertion into `prescriptions` without human clinical approval.

---

## 10. Multilingual Status

* **Supported Languages**: English (`en`), Hindi (`hi`), Marathi (`mr`).
* **Implementation Mechanism**: Cross-cutting pre-retrieval canonicalization and post-verification response localization.
* **Authoritative Corpus**: Single English DailyMed SPL index (2,204 chunks). Zero duplicate regional vector indexes.
* **Safety Translation**: Controlled localization templates with certified emergency numbers (`112`, `108`).

---

## 11. Known Limitations (Documented, Not Bugs)

1. **Reranker Cold-Start Latency**:
   * The Cross-Encoder model (`cross-encoder/ms-marco-MiniLM-L-6-v2`) loads on the first request (~1.5s cold-start), then switches to warm memory execution.
2. **Compact Generator Capacity (`TinyLlama-1.1B`)**:
   * The local 1.1B generator occasionally outputs conversational preambles that fail exact token verification. The `AnswerGroundingVerifier` intercepts these fail-closed (`withheld_verification_failure`).
3. **Corpus Coverage Boundaries**:
   * The DailyMed corpus covers cardiovascular, metabolic, diabetic, and primary care medications. Inquiries on unindexed entities safely trigger policy abstentions (`abstained_policy`).

---

## 12. Current Risks

1. **Concurrent Local Runtime Management**:
   * Running MySQL, Express, FastAPI, and Vite frontends as separate local processes requires lifecycle management until containerized with Docker.

---

## 13. System Port Allocation & Access

* **Doctor Portal**: `http://localhost:5173` (Synthetic doctor account: `doctor@gmail.com` [credentials redacted from docs])
* **Receptionist Portal**: `http://localhost:5174` (Synthetic receptionist account: `receptionist@gmail.com` [credentials redacted from docs])
* **Patient Portal**: `http://localhost:5175` (Synthetic patient account: `aarav@gmail.com` [credentials redacted from docs])
* **Patient Account Activation**: `http://localhost:5175/activate` (Single-use token setup)
* **Express API Gateway**: `http://localhost:5000`
* **FastAPI CDS Gateway**: `http://127.0.0.1:8000`
* **MySQL Server**: `127.0.0.1:3306` (database: `rag_healthcare`, migrations 001–004 applied)

---

## 14. Future Roadmap Summary

* **Phase 9**: Production Hardening, Containerized Deployment (`docker-compose.yml`), CI/CD Pipeline.
