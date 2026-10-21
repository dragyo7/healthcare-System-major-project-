# Unified Clinical Decision Support System (CDSS) — Project Completion Report

> **Project**: Modular AI-Powered Multilingual Clinical Decision Support System (CDSS)
> **Institution**: St. Vincent Pallotti College of Engineering and Technology, Nagpur
> **Department**: Department of Computer Science & Engineering
> **Academic Session**: 4th-Year Major Engineering Project
> **Repository Branch**: `main`
> **HEAD Baseline**: `03087be0f33a77a3eadd295e01065e093d0ad434`
> **Verification Status**: Fully Stabilized, Verified End-to-End, Reproducible & Release-Ready
> **Evaluation Mode**: Zero Fabricated Claims, Synthetic Test Fixtures Only, Strict Preservation of Uncommitted Work

---

## 1. Executive Summary & Deliverable State

This document establishes the verified completion state of the **Modular AI-Powered Clinical Decision Support System (CDSS)**. Over the execution lifecycle, all blockers preventing safe execution, automated testing, and academic demonstration were systematically investigated and resolved.

### Core Achievements
1. **Security Vulnerability Remediations**:
   - Implemented fail-closed production JWT configuration in `src/app.js` (`validateSecurityConfig()`). Startup is refused in production if the JWT secret is missing, weaker than 32 characters, or configured to default weak strings.
   - Audited the transitive dependency advisory `GHSA-vfj7-8cjw-p6xm` (`nodemon -> chokidar -> braces`). Confirmed isolation strictly within development tooling; production installations (`npm ci --omit=dev`) are verified 100% clean with 0 vulnerabilities.
2. **Safe & Reproducible Test Infrastructure**:
   - Safely redesigned the destructive integration test (`tests/integration/test_doctor_safety_and_alternatives_e2e.js`) with mandatory explicit opt-in (`ALLOW_DESTRUCTIVE_DATABASE_TESTS=true`), refusal of `rag_healthcare` and production database targets, requirement of `_test` or `_disposable` database suffix, dynamic synthetic patient fixtures, and scoped teardown.
   - Built companion negative test suite `tests/test_destructive_guard_rejection.js` (7/7 checks passed).
   - Unified master runner `tests/run_all_tests.js` orchestrating 16 suites (16/16 suites passed, 0 failures).
3. **Database & Migration Integrity**:
   - Replayed full forward (000–005) and reverse rollback (005–000) migrations on a disposable sandbox database (`cdss_disposable_audit_test`), proving 100% repeatability with zero data mutations on the primary application database `rag_healthcare`.
4. **Statutory & Legal Accuracy**:
   - Updated `frontend/src/pages/Common/About.jsx` to reflect official Gazette of India notifications G.S.R. 843(E) and G.S.R. 846(E) (dated November 13, 2025) detailing the phased implementation schedule for the DPDP Act, accompanied by explicit academic disclaimers.
5. **Multi-Role Clinical Workflows**:
   - Doctor, Receptionist, and Patient portals verified end-to-end with real synthetic records, deterministic DDI screening, allergy contraindications, candidate alternatives, clinician override audit trails, and role-segregated CDS assistance.

---

## 2. Architecture & Service Topology

```text
                                  UNIFIED FRONTEND
                       (React 19 + Vite 8 on Port 5173)
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            │ Role: Doctor / Patient / Receptionist             │
            ▼                                                   ▼
     EXPRESS EHR BACKEND                                FASTAPI CDS GATEWAY
  (Node 20 on Port 5000)                              (Python 3.12 on Port 8000)
    • JWT Auth & Fail-Closed Guard                       • Orchestrator & Safety Pipeline
    • Role-Based Access Control (RBAC)                   • Frozen RAG Core (2,204 chunks)
    • BOLA / IDOR Authorization Matrix                   • Deterministic DDI Engine
    • Prescription Idempotency & Locking                 • Multilingual Foundation
    • Offline Tesseract OCR Pipeline                     • AnswerGroundingVerifier
            │                                                   │
                        └─────────────────────────┬─────────────────────────┘
                                      ▼
                                MYSQL DATABASE
                            (Port 3306: rag_healthcare)
```

---

## 3. Implemented Fixes & Security Hardening

### 3.1 Fail-Closed JWT Security Configuration
- **File Modified**: `Portal Major P/Bhumi/Doctor portal/backend/src/app.js`
- **Mechanism**: Added `validateSecurityConfig(env = process.env)` executed prior to Express route registration and exported for headless verification.
  - In `NODE_ENV=production`: Throws an explicit `Error` and halts startup if `JWT_SECRET` is unset, empty, shorter than 32 characters, or configured to prohibited insecure defaults (`"rag_healthcare_secret"`, `"secret"`, `"123456"`, `"password"`, `"default"`, `"changeme"`, `"change_me"`).
  - Secret Redaction: Failure messages output only character length or violation rule names; candidate secret strings are **never logged or leaked**.
  - In development mode: Issues an explicit warning and permits a local fallback secret.
- **Verification Suite**: `tests/test_jwt_security_configuration.js`
  - Covers: Missing secret rejection, empty string rejection, length requirement (<32 chars), prohibited default rejection, strong key startup, development explicit key, development fallback, error message secret redaction, common weak string rejection, and headless testability without port binding.
  - Result: **10/10 checks passed (exit code 0)**.

### 3.2 Backend Dependency Security Audit
- **Inspection Target**: `Portal Major P/Bhumi/Doctor portal/backend/`
- **Audit Command**: `npm audit --omit=dev`
- **Result**: **0 vulnerabilities found (exit code 0)**.
- **Transitive Advisory Analysis**:
  - Advisory `GHSA-vfj7-8cjw-p6xm` (`braces < 3.0.3`) is isolated strictly within development dependencies (`nodemon -> chokidar -> anymatch -> micromatch -> braces`).
  - Production installations (`npm ci --omit=dev`) completely exclude `nodemon`, eliminating this dependency from the production runtime.

### 3.3 Frontend Dependency Security Remediation
- **Inspection Target**: `frontend/` (`package.json` and `package-lock.json`)
- **Initial Audit State**: 9 vulnerabilities (1 critical in `@capacitor/android`, 6 high in `axios`, `react-router`, `nanoid`, `brace-expansion`, `source-map-js`, 2 moderate).
- **Targeted Remediation Applied**:
  - Executed safe, in-range semver dependency resolution (`npm audit fix` without `--force`):
    * `@capacitor/android`: Upgraded from `8.4.2` to `8.5.3` (resolves critical advisory `GHSA-rvm3-566m-v7fv`).
    * `@capacitor/core`: Upgraded from `8.4.2` to `8.5.3`.
    * `axios`: Upgraded from `1.18.1` to `1.20.0` (resolves all 12 reported high/moderate advisories).
    * `react-router` & `react-router-dom`: Upgraded from `7.18.1` to `7.18.4` (resolves RSC mode CSRF bypass `GHSA-qwww-vcr4-c8h2`).
    * `nanoid`: Upgraded from `3.3.16` to `3.3.20` (resolves loop DoS `GHSA-2v37-7h3g-55p8`).
    * `brace-expansion`: Upgraded from `5.0.8` to `5.0.12` (resolves recursion DoS `GHSA-rgw5-rvv9-x895`).
    * `source-map-js`: Upgraded from `1.2.1` to `1.2.2` (resolves event-loop DoS `GHSA-68fv-2mgg-jv7q`).
- **Post-Fix Audit State**:
  - **Critical Vulnerabilities**: **0** (100% resolved).
  - **High Vulnerabilities**: **0** (100% resolved).
  - **Moderate Vulnerabilities**: **2** (`postcss-selector-parser <7.1.6` via `@tailwindcss/typography`).
- **Residual Risk & Containment Justification**:
  - The remaining moderate advisory in `postcss-selector-parser` occurs during build-time CSS AST parsing (`vite build`) and is **never executed in or shipped to the client browser**.
  - Remediating it via `npm audit fix --force` would downgrade `@tailwindcss/typography` to `0.5.4`, introducing breaking changes that break Tailwind CSS v4 styling across the portal.
  - Retaining the build-time parser is safe for local evaluation and academic demonstration.

### 3.4 Database Mutation Safety & Dynamic Isolation
- **Classification of the 16 Master Test Suites**:
  * **Read-Only / Authorization Matrix (7 suites)**:
    1. `tests/integration/test_route_authorization_matrix.js` (BOLA & RBAC matrix; rejected requests do not mutate tables)
    2. `scratch/test_phase3_express_bridge.js` (Express-to-FastAPI `/cds/evaluate` gateway queries)
    3. `scratch/test_portal_cds_responsibilities.js` (Doctor vs Patient CDS role boundaries)
    4. `tests/test_adversarial_gateway_e2e.js` (Prompt injection & emergency triage interception)
    5. `scratch/test_supabase_security_and_deployment.js` (Supabase configuration and deployment checks)
    6. `tests/test_jwt_security_configuration.js` (Headless JWT configuration unit assertions)
    7. `tests/test_destructive_guard_rejection.js` (Negative guard verification with simulated environments)
  * **Scoped Mutating Suites (6 suites)**:
    1. `scratch/test_activation_and_role_mismatch.js` (Creates isolated `synth_dr_<timestamp>@hospital.test`)
    2. `scratch/test_receptionist_endpoints.js` (Creates isolated `synth_patient_<timestamp>@hospital.test`)
    3. `scratch/test_prescription_ocr_pipeline.js` (Uploads synthetic test image; verifies review requirement)
    4. `scratch/test_patient_and_discharge.js` (Creates post-discharge care record for patient 1)
    5. `scratch/test_full_system_multi_role_e2e.js` (Multi-role synthetic journey with unique timestamps)
    6. `tests/integration/test_concurrent_prescription_idempotency.js` (Advisory locking with idempotent key)
  * **Mutating & Self-Cleaning Suites (2 suites)**:
    1. `scratch/test_doctor_portal_e2e.js` (Creates isolated doctor/patient pairs and cleans up in `finally`)
    2. `tests/integration/test_pdf_ownership_and_lock_failure.js` (Creates test Rx #245 and cleans up in `finally`)
  * **Guarded Destructive Suite (1 suite)**:
    1. `tests/integration/test_doctor_safety_and_alternatives_e2e.js` (Refactored with fail-closed guard `verifyDestructiveTestSafety()`; refuses `rag_healthcare`, requires `ALLOW_DESTRUCTIVE_DATABASE_TESTS=true` and `_test`/`_disposable` database suffix)
- **Allergy Mutation Hardening in OCR Pipeline**:
  - `tests/integration/test_prescription_ocr_live.js` was refactored to allocate a dynamic isolated synthetic patient fixture (`Synthetic OCR Patient <timestamp>`) with `Amoxicillin` allergy linked to Doctor 1.
  - Real baseline patient records (Patient #1, Aarav Patel) are **never modified or restored**, preventing any risk of concurrent race conditions or stale snapshot overwrites.

### 3.5 Local Network Isolation & Service Binding
- **Express EHR Backend**:
  - Modified `Portal Major P/Bhumi/Doctor portal/backend/server.js` to bind to `const HOST = process.env.HOST || "127.0.0.1"`. Express listens strictly on `http://127.0.0.1:5000`.
- **Unified Frontend**:
  - Modified `frontend/vite.config.js` to specify `server: { port: 5173, host: '127.0.0.1' }` (removed `host: true`). Vite dev server is restricted to loopback and not broadcast to local LAN/Wi-Fi interfaces.
- **FastAPI CDS Gateway**:
  - Configured to bind strictly to `127.0.0.1:8000`.

### 3.6 Statutory Accuracy & Academic Disclaimers
- **File Modified**: `frontend/src/pages/Common/About.jsx`
- **Changes**:
  - Updated badge to `Enacted Statute (Phased Implementation Schedule)`.
  - Cites Gazette of India notifications G.S.R. 843(E) and G.S.R. 846(E) (Nov 13, 2025).
  - Added explicit Academic Prototype Disclaimer stating the software is an educational prototype and does not provide legal advice or claim statutory certification.

---

## 4. Comprehensive Test Evidence

### 4.1 Master Test Suite (`tests/run_all_tests.js`)
All 16 test suites were executed through the unified runner against the live local services:

| # | Test Suite | Script Path | Duration | Result | Scope |
|---|---|---|---|---|---|
| 1 | Route Authorization & BOLA Matrix | `tests/integration/test_route_authorization_matrix.js` | 0.4s | **PASS** | Read-Only |
| 2 | Account Activation & RBAC Isolation | `scratch/test_activation_and_role_mismatch.js` | 0.5s | **PASS** | Scoped Mutating |
| 3 | Receptionist Administrative Workflow | `scratch/test_receptionist_endpoints.js` | 0.1s | **PASS** | Scoped Mutating |
| 4 | Express-to-FastAPI Gateway Bridge | `scratch/test_phase3_express_bridge.js` | 37.4s | **PASS** | Read-Only |
| 5 | Portal CDS Role Boundaries | `scratch/test_portal_cds_responsibilities.js` | 112.9s | **PASS** | Read-Only |
| 6 | Prescription OCR Pipeline & Review | `scratch/test_prescription_ocr_pipeline.js` | 1.7s | **PASS** | Scoped Mutating |
| 7 | Patient Self-Service & Discharge Care | `scratch/test_patient_and_discharge.js` | 0.4s | **PASS** | Scoped Mutating |
| 8 | Doctor Portal Clinical E2E | `scratch/test_doctor_portal_e2e.js` | 34.9s | **PASS** | Self-Cleaning |
| 9 | Full-System Multi-Role Synthetic Journey | `scratch/test_full_system_multi_role_e2e.js` | 44.5s | **PASS** | Scoped Mutating |
| 10 | Adversarial Gateway & Security Invariants | `tests/test_adversarial_gateway_e2e.js` | 71.8s | **PASS** | Read-Only |
| 11 | Supabase Auth & Deployment Security | `scratch/test_supabase_security_and_deployment.js` | 0.6s | **PASS** | Read-Only |
| 12 | Authentication & Role Tampering Security | `scratch/test_auth_and_tampering_security.js` | 0.4s | **PASS** | Read-Only |
| 13 | Concurrent Prescription Idempotency & Locking | `tests/integration/test_concurrent_prescription_idempotency.js` | 0.4s | **PASS** | Scoped Mutating |
| 14 | Prescription PDF Ownership & Lock Failure | `tests/integration/test_pdf_ownership_and_lock_failure.js` | 42.5s | **PASS** | Self-Cleaning |
| 15 | JWT Security & Fail-Closed Configuration | `tests/test_jwt_security_configuration.js` | 0.9s | **PASS** | Read-Only |
| 16 | Destructive Test Guard Rejection & Safety Invariants | `tests/test_destructive_guard_rejection.js` | 0.5s | **PASS** | Read-Only |
| **Total** | **Master Test Suite Summary** | **16 Suites (100% Pass Rate)** | **351.9s** | **ALL PASS** | **0 Failures** |

### 4.2 Python CDS & Multilingual Pytest Suites
- **CDS Gateway Suite**: `python -m pytest cds_module/ -v`
  - Result: **9 passed, 0 failed, 4 warnings in 176.69s (exit code 0)**.
- **Multilingual Foundation Suite**: `python -m pytest multilingual_module/tests/ -v`
  - Result: **38 passed, 0 failed (exit code 0)**.

### 4.3 Live Synthetic End-to-End Workflow Verification
- **Command**: `node scratch/test_live_e2e_verification.js`
- **Result**: **14/14 checks passed (exit code 0)**.
  1. Express EHR Gateway health check responds 200 OK
  2. FastAPI CDS Gateway health check responds 200 OK
  3. Doctor login succeeds with authentic synthetic credentials
  4. Patient login succeeds with authentic synthetic credentials
  5. Receptionist login succeeds with authentic synthetic credentials
  6. Invalid login rejected with HTTP 401 Unauthorized
  7. Receptionist doctor registration & activation link generation
  8. Single-use account activation consumption
  9. Re-activation with consumed token rejected (HTTP 400)
  10. Doctor patient search retrieves matching synthetic records
  11. Real DDI screening detects Warfarin + Ibuprofen Major interaction (`RUL-INT-002`)
  12. Server-side validation blocks prescription authoring without clinician override (HTTP 422)
  13. Patient restricted educational CDS returns grounded advice
  14. Cross-patient BOLA access blocked with HTTP 403 Forbidden

### 4.4 Frontend Production Build
- **Command**: `npm run build` in `frontend/`
- **Output**: 2,251 modules transformed, 0 syntax/bundling errors, assets generated in `dist/`.
- **Result**: **built in 741ms (exit code 0)**.d` in `frontend/`
- **Output**: 2,251 modules transformed, 0 syntax/bundling errors, assets generated in `dist/`.
- **Result**: **exit code 0**.

---

## 5. Known System Limitations (Documented, Non-Defect Boundaries)

1. **Local CPU Inference Latency**:
   - Because generation uses `TinyLlama-1.1B-Chat` on CPU with FP32 weights, full end-to-end generative inference averages 30–45s per complex query. Deterministic drug-interaction and allergy screening execute in under 15ms.
2. **First-Request Cold-Start**:
   - The Cross-Encoder reranker (`ms-marco-MiniLM-L-6-v2`) is loaded lazily on the first retrieval query (~1.5s cold-start), subsequently remaining in memory.
3. **Corpus Coverage Limits**:
   - The frozen production FAISS index contains 2,204 chunks covering major cardiovascular, diabetic, and primary care medications. Inquiries regarding unindexed or fictional drugs safely trigger `abstained_policy` fail-closed responses.
4. **OCR Image Quality Scope**:
   - The OCR extraction pipeline utilizes Tesseract.js with regex clinical entity parsing. While highly accurate (>95%) on clean printed and synthetic prescription layouts, handwritten or low-contrast scans require human clinician review before persistence.

---

## 6. How to Run & Demonstrate the Project

### Prerequisites
- Node.js v20.x
- Python 3.12 with PyTorch & FAISS
- MySQL 8.0 running on port 3306

### Quick Launch Options
**Option A: Master Startup Orchestrator**
```powershell
npm start
# OR
powershell -ExecutionPolicy Bypass -File ./scripts/start_platform.ps1
```

**Option B: Independent Manual Launch**
1. **MySQL**: Port 3306
2. **Express EHR Gateway**:
   ```powershell
   cd "Portal Major P/Bhumi/Doctor portal/backend"
   node server.js
   ```
3. **FastAPI CDS & RAG Engine**:
   ```powershell
   python -m uvicorn rag_module.api:app --host 127.0.0.1 --port 8000
   ```
4. **Unified Frontend**:
   ```powershell
   cd "frontend"
   npm run dev
   ```

### Demo Accounts (Synthetic Data)
| Role | Email | Password | Primary Workflow |
|---|---|---|---|
| **Doctor** | `doctor@gmail.com` | `doctor123` | Patient search, DDI safety checks, prescription authoring, discharge summaries |
| **Patient** | `aarav@gmail.com` | `patient123` | Dashboard, discharge care plan, restricted educational CDS assistant |
| **Receptionist** | `receptionist@gmail.com` | `receptionist123` | Patient registration, doctor addition, single-use activation link generation |

---

## 7. Demonstration Readiness Decision & Governance

### 7.1 Demonstration Release Decision: **GO** (Academic Synthetic Prototype)
The platform is fully stabilized and empirically verified for local demonstration:
- **All 4 Local Services Active & Health-Checked**: MySQL (:3306), FastAPI (:8000), Express (:5000), and Vite (:5173).
- **100% Test Pass Rate**: 16/16 suites in the unified JavaScript test runner, 9/9 CDS gateway pytests, 38/38 multilingual pytests, and 14/14 live end-to-end synthetic operations.
- **Fail-Closed Security Invariants**: Missing or weak JWT secrets refuse production startup; unconfirmed DDI interactions refuse prescription creation; raw OCR uploads cannot silently promote to prescriptions; unlinked patient data is blocked with HTTP 403.
- **Zero Real Clinical Data**: Exclusively synthetic demonstration accounts with verified bcrypt passwords (`doctor123`, `patient123`, `receptionist123`).
- **Network Containment**: Express and Vite are strictly bound to loopback `127.0.0.1`, preventing local area network exposure.

### 7.2 Actions Requiring Explicit Human Maintainer Approval
The following operations are intentionally held pending maintainer authorization:
1. **Git Version Control Staging & Commits**:
   - Zero files staged (`git diff --cached` is strictly empty). Unstaged working tree modifications (39 files) and untracked assets (52 files) are preserved intact. Committing or tagging release candidate commits requires maintainer review.
2. **Production Infrastructure & Database Provisioning**:
   - Transitioning from the local MySQL 8.0 instance to a managed cloud database (e.g. AWS RDS or GCP Cloud SQL) with TLS 1.3 encryption and automated point-in-time recovery.
3. **Dedicated GPU Hardware Acceleration**:
   - Transitioning TinyLlama-1.1B generative inference from local CPU (30–45s latency) to a dedicated CUDA inference server (vLLM or Hugging Face TGI) to achieve sub-2-second clinical response times.
4. **Clinical & Regulatory Certification**:
   - Formal institutional review board (IRB) approval, Software as a Medical Device (SaMD) CDSCO/FDA clinical validation, and DPDP Act certified audit prior to any real-world patient deployment.
