# CANONICAL TESTING GUIDE & TEST TIERS

> **Authoritative Regression Suite & Test Execution Reference**  
> **Project**: Modular AI-Powered Multilingual Clinical Decision Support System (CDSS)  
> **Last Verified**: 2026-10-12  

---

## 1. Test Tiers Overview

The system enforces a tiered testing pyramid:
1. **Tier 1 — Core Intelligence & RAG Regression**: Evaluates retrieval, reciprocal rank fusion, cross-encoder reranking, and fail-closed grounding verification on the frozen V2.10 core.
2. **Tier 2 — Multilingual & Language Normalization**: Validates language detection, Devanagari/Gujarati numeral normalization, and canonical English translation mapping.
3. **Tier 3 — Gateway & Boundary Security**: Validates reverse-proxy routing, PII stripping, request limits, and security headers.
4. **Tier 4 — RBAC, BOLA & Account Lifecycle**: Tests password hashing, single-use activation tokens, cross-patient authorization isolation, and self-registration.
5. **Tier 5 — Clinical Portals & E2E Workflows**: End-to-end multi-role lifecycle journeys across Doctor, Receptionist, and Patient portals.
6. **Tier 6 — Database & Disaster Recovery**: Tests isolated schema/data backup and restore parity.

---

## 2. Canonical Test Commands

### 2.1 Tier 1: Frozen RAG Core Regression (190 Passed, 2 Skipped)
```powershell
python -m pytest rag_module/tests/ -q
```
- **Scope**: Hybrid retrieval, BM25, FAISS, reranking, TinyLlama generator, and proposition verifier.
- **Invariants**: Must pass with 0 failures and exactly 2 documented skips.

### 2.2 Tier 2: Multilingual Foundation (20/20 Passed)
```powershell
python -m pytest multilingual_module/tests/ -v
```
- **Scope**: Language identification (`en`, `hi`, `mr`, `gu`), Devanagari/Gujarati numerals, and canonical query generation.

### 2.3 Tier 3: CDS Gateway & Security Boundary (9/9 Passed)
```powershell
python -m pytest cds_module/ -v
```
- **Scope**: `/cds/evaluate`, `/cds/screen-prescription`, PII sanitization boundary, fail-closed safety.

### 2.4 Tier 4: Account Lifecycle, Signup & RBAC (27/27 Passed)
```powershell
# Account activation, token expiry, and role mismatch
node scratch/test_activation_and_role_mismatch.js

# Patient self-registration, login loop resolution, and profile bootstrap
node scratch/test_patient_signup_and_loop.js
```
- **Scope**: Bcrypt hashing, single-use SHA-256 tokens, duplicate email rejection, role-forcing.

### 2.5 Tier 5: Role & Portal Responsibilities
```powershell
# Express Gateway Bridge (7/7 Passed)
node scratch/test_phase3_express_bridge.js

# Portal Responsibilities Matrix (25/25 Passed)
node scratch/test_portal_cds_responsibilities.js

# Doctor Portal E2E (26/26 Passed)
node scratch/test_doctor_portal_e2e.js

# Receptionist Endpoints (9/9 Passed)
node scratch/test_receptionist_endpoints.js

# Patient Portal & Post-Discharge Care (14/14 Passed)
node scratch/test_patient_and_discharge.js

# Prescription OCR Pipeline (12/12 Passed)
node scratch/test_prescription_ocr_pipeline.js

# Full-System Multi-Role Synthetic Journey (20/20 Passed)
node scratch/test_full_system_multi_role_e2e.js
```

### 2.6 Tier 6: Database Backup & Recovery Test (1/1 Passed)
```powershell
node scratch/test_backup_and_recovery.js
```
- **Scope**: Dumps active database using `mysqldump`, restores into isolated disposable database, verifies 100% table count and row parity.

### 2.7 Frontend Production Build Verification (4/4 Passed)
```powershell
cd "Portal Major P/Bhumi/Doctor portal/frontend"; npm run build
cd "Portal Major P/Ketki/receptionist_frontend"; npm run build
cd "Portal Major P/patient_frontend"; npm run build
cd "frontend"; npm run build
```
- **Scope**: Vite production bundle compilation with zero JSX/CSS errors.

---

## 3. Test Discipline & Rules
1. **Never mock real routes when integration tests are available.**
2. **Never alter verifier thresholds to force a test to pass.**
3. **Use only synthetic records and disposable test accounts.**
4. **Always verify that `rag_healthcare` database is listening on port 3306 before executing integration suites.**
