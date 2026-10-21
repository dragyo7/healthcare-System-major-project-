# Testing and Reproducibility Guide — Unified CDSS Platform

> **Project**: Modular AI-Powered Multilingual Clinical Decision Support System (CDSS)
> **Target Audience**: Developers, Academic Evaluators, QA Engineers, Security Reviewers
> **Environment**: Windows / PowerShell (Cross-platform compatible)
> **Database Policy**: Primary database (`rag_healthcare`) protected; disposable test sandbox used for destructive tests.

---

## 1. Overview & Testing Philosophy

The testing framework for the CDSS platform is structured to ensure complete reproducibility, high empirical rigor, and total protection of application databases.

### Core Testing Invariants
1. **Zero Production Mutation**: Automated tests never mutate or delete baseline patient records in `rag_healthcare`.
2. **Explicit Opt-In for Destructive Testing**: Tests with destructive capability require `ALLOW_DESTRUCTIVE_DATABASE_TESTS=true` and refuse execution against `rag_healthcare` or non-disposable databases.
3. **Synthetic Fixtures**: All tests utilize synthetic fixtures generated dynamically (e.g., `synth_patient_<timestamp>@synthtest.local`) and clean up after execution.
4. **Decoupled Verification**: Fast deterministic checks (<1s) run separately from generative RAG inference checks (30–45s per query on CPU).

---

## 2. Prerequisites & Environment Setup

### Required Runtimes
- **Node.js**: v20.x or higher
- **Python**: 3.12.x
- **MySQL Server**: 8.0 running on `localhost:3306`

### Python Virtual Environment & Packages
```powershell
# Activate project virtual environment or global Python 3.12
python -m pip install -r requirements.txt
```
Key packages: `fastapi`, `uvicorn`, `torch`, `transformers`, `sentence-transformers`, `faiss-cpu`, `rank_bm25`, `pytest`.

### Node.js Backend Dependencies
```powershell
cd "Portal Major P/Bhumi/Doctor portal/backend"
npm ci
```

### Frontend Dependencies
```powershell
cd "frontend"
npm install
```

---

## 3. Service Startup Procedures

The platform requires three services running concurrently alongside MySQL:

```text
┌──────────────┐     ┌────────────────────────────────────────────────────────┐
│ Service      │     │ Startup Command                                        │
├──────────────┼─────┼────────────────────────────────────────────────────────┤
│ MySQL (3306) │     │ mysqld --console                                       │
│ Express(5000)│     │ cd "Portal Major P/Bhumi/Doctor portal/backend"; node server.js │
│ FastAPI(8000)│     │ python -m uvicorn rag_module.api:app --host 127.0.0.1 --port 8000 │
│ Frontend(5173│     │ cd "frontend"; npm run dev                             │
└──────────────┘     └────────────────────────────────────────────────────────┘
```

### Master Single-Command Startup
Alternatively, launch all services with automatic health checks via:
```powershell
npm start
# OR
powershell -ExecutionPolicy Bypass -File ./scripts/start_platform.ps1
```

---

## 4. Test Suites Execution

### 4.1 Master Test Suite (16 Automated Suites)
Runs the complete suite of integration, security, and multi-role end-to-end checks:
```powershell
node tests/run_all_tests.js
```
**Expected Outcome**: 16/16 suites passed (exit code 0).

Included test suites:
1. `tests/integration/test_route_authorization_matrix.js`: BOLA/IDOR security matrix.
2. `scratch/test_activation_and_role_mismatch.js`: Single-use account activation.
3. `scratch/test_receptionist_endpoints.js`: Front-desk doctor addition.
4. `scratch/test_phase3_express_bridge.js`: Gateway HTTP communication.
5. `scratch/test_portal_cds_responsibilities.js`: Mode segregation (`doctor` vs `patient`).
6. `scratch/test_prescription_ocr_pipeline.js`: Tesseract OCR & clinician review invariant.
7. `scratch/test_patient_and_discharge.js`: Patient discharge care & queries.
8. `scratch/test_doctor_portal_e2e.js`: Doctor clinical workflow & safety screening.
9. `scratch/test_full_system_multi_role_e2e.js`: Synthetic journey across all 3 roles.
10. `tests/test_adversarial_gateway_e2e.js`: Prompt injection, emergency triage, tampering.
11. `scratch/test_supabase_security_and_deployment.js`: Deployment security invariants.
12. `scratch/test_auth_and_tampering_security.js`: JWT tampering & role elevation.
13. `tests/integration/test_concurrent_prescription_idempotency.js`: Duplicate submission locks.
14. `tests/integration/test_pdf_ownership_and_lock_failure.js`: PDF download authorization.
15. `tests/test_jwt_security_configuration.js`: Fail-closed JWT production startup.
16. `tests/test_destructive_guard_rejection.js`: Destructive test containment invariants.

---

### 4.2 Python Pytest Suites

#### A. CDS Gateway & Safety Pipeline (9 Tests)
```powershell
python -m pytest cds_module/ -v
```
Verifies OpenAPI schema exposure, emergency triage interception (108/112), prompt injection blocking, patient context injection, unsupported entity abstention (`fail-closed`), deterministic DDI screening, and zero patient database leakage.

#### B. Multilingual Foundation Layer (38 Tests)
```powershell
python -m pytest multilingual_module/tests/ -v
```
Verifies:
- Language detection across English, Hindi, Marathi, Gujarati (`TestMultilingualDetection`, 9 tests).
- Canonical medical query representation (`TestCanonicalQueryRepresentation`, 10 tests).
- Localized emergency & safety templates (`TestSafetyTemplatesIntegrity`, 4 tests).
- End-to-end multilingual CDS orchestration (`TestEndToEndMultilingualCDS`, 8 tests).
- AnswerGroundingVerifier deterministic logic (`TestDeterministicVerifierSafety`, 7 tests).

#### C. Frozen RAG Core Regression (190 Tests)
```powershell
python -m pytest rag_module/tests/ -q
```
Verifies frozen FAISS index (2,204 chunks), BM25 retriever, RRF reciprocal rank fusion, Cross-Encoder reranker, and evidence policy engine.

---

### 4.3 Database Migration Replay (Disposable Sandbox)
To verify database migrations forward and reverse without touching `rag_healthcare`:
```powershell
node scratch/test_disposable_migration_replay.js
```
**Mechanism**:
- Dynamically creates database `cdss_disposable_audit_test`.
- Executes forward migrations `000` through `005`.
- Confirms 15 tables created and schema recorded.
- Executes rollback scripts `005_rollback` through `000_rollback`.
- Confirms tables dropped cleanly.
- Drops disposable database.

---

### 4.4 Destructive Integration Test (Guarded Execution)
The test `tests/integration/test_doctor_safety_and_alternatives_e2e.js` is strictly guarded.

**Negative Guard Test (Default Safe Mode)**:
```powershell
node tests/test_destructive_guard_rejection.js
```
Confirms that running the test without opt-in or against `rag_healthcare` immediately exits with code 1 and prints `SAFETY REFUSAL`.

**Authorized Disposable Execution (Only on Disposable Database)**:
```powershell
$env:ALLOW_DESTRUCTIVE_DATABASE_TESTS="true"
$env:DB_NAME="cdss_disposable_test"
node tests/integration/test_doctor_safety_and_alternatives_e2e.js
```

---

### 4.5 Production Frontend Build
```powershell
cd "frontend"
npm run build
```
Builds production bundle using Vite. Confirms 0 compile/bundling errors.

---

## 5. Troubleshooting & FAQ

### 1. `ECONNREFUSED 127.0.0.1:5000`
- **Cause**: Express backend is not running.
- **Fix**: Open a terminal, run `cd "Portal Major P/Bhumi/Doctor portal/backend"`, and execute `node server.js`.

### 2. `ECONNREFUSED 127.0.0.1:8000`
- **Cause**: FastAPI CDS Gateway is not running.
- **Fix**: Open a terminal and run `python -m uvicorn rag_module.api:app --host 127.0.0.1 --port 8000`.

### 3. Pytest Execution Hangs or Takes Long
- **Cause**: Generative inference using `TinyLlama-1.1B-Chat` on CPU averages 30–45 seconds per question.
- **Fix**: Run targeted fast unit tests using `-k "not TestEndToEndMultilingualCDS"` for sub-second verification.

### 4. `ER_BAD_DB_ERROR: Unknown database 'rag_healthcare'`
- **Cause**: MySQL database is not initialized.
- **Fix**: Run `node scripts/run_migrations.js` against local MySQL to initialize the schema.
