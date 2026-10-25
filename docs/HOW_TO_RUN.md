# HOW TO RUN — Comprehensive System Runbook & Operator Guide

> **Project**: Modular AI-Powered Clinical Decision Support (CDS) System
> **Target Environment**: Windows 10/11 (PowerShell 5.1 / PowerShell 7+)
> **Baseline Commit**: `497a547` (RAG v2.10 Frozen Baseline)
> **Active Verification Branch**: `codex/presentation-stabilization`
> **Last Verified**: 2026-10-25

---

## 1. Prerequisites and Version Requirements

Before starting the platform, ensure that the following runtime environments and software packages are installed on your host system:

| Dependency | Minimum Version | Verified Version | Notes / Validation Command |
|---|---|---|---|
| **Operating System** | Windows 10 64-bit | Windows 11 Enterprise | Native PowerShell support |
| **Python** | 3.11.x | 3.12.10 | `python --version` |
| **Node.js** | 18.x LTS | 20.x / 22.x | `node --version` |
| **npm** | 9.x | 10.x | `npm --version` |
| **MySQL Server** | 8.0.x | 8.0.36 | `mysqld --version` (runs on default port 3306) |
| **PowerShell** | 5.1 | 7.x / 5.1 Desktop | `$PSVersionTable.PSVersion` |

---

## 2. Automated Diagnostic Doctor Check (Step 0)

Before starting services or executing tests, run the comprehensive environment diagnostic:

```powershell
# From the repository root:
powershell -ExecutionPolicy Bypass -File ./scripts/doctor.ps1
```

This diagnostic probe verifies 14 pre-flight readiness criteria:
- **Runtimes & CLI Tools**: Node.js (>= 18), Python (>= 3.9), Git.
- **Port Bindings**: Port 3306 (MySQL), Port 8000 (FastAPI), Port 5000/5001 (Express), Port 5173 (Vite).
- **Clinical Artifacts**: Production FAISS Vector Index (`index_v2.bin`, `meta_v2.pkl` with 2,204 chunks), Synthea FHIR R4 Archive SHA-256 validation (`6D3C5433BCAE4791BC5C30469D1445B430FB4894D5C13BDA15FEE0584BBD7778`), and DrugBank interaction rules.
- **Live HTTP Health Probes**: FastAPI `/health`, Express Dev `/health`, and Express Test `/health`.

---

## 3. Repository Layout & Architecture

The system consists of three decoupled layers communicating over localhost REST interfaces:

```text
E:\Major Project Code\
├── rag_module/                    # FastAPI CDS Gateway & Frozen DailyMed RAG Engine (Port 8000)
│   ├── api.py                     # Entry point (app = FastAPI)
│   ├── rag_pipeline.py            # FAISS + BM25 + RRF + Cross-Encoder + TinyLlama pipeline
│   ├── safety/                    # Guardrails, EvidencePolicy, AnswerGroundingVerifier
│   └── data/faiss_index/          # 2,204 chunks, index_v2.bin (BAAI/bge-small-en)
├── cds_module/                    # CDS orchestration endpoints (/cds/evaluate, /cds/screen-prescription)
├── drug_module/                   # Medication safety, DDI engine, SIDER adverse effect lookup
├── prescription_module/           # Prescription regex parser, entity extraction
├── multilingual_module/           # Multilingual translation & formatting (en, hi, mr, gu)
├── Portal Major P/                # Healthcare Portals (Doctor, Receptionist, Patient)
│   └── Bhumi/Doctor portal/
│       └── backend/               # Express EHR Backend & OCR Pipeline (Port 5000 / 5001)
│           ├── server.js          # Entry point
│           ├── src/controllers/   # doctorController, patientController, receptionistController
│           └── src/middleware/    # authMiddleware, databaseSafetyGuard.js
├── frontend/                      # Unified React 18 + Vite Clinical Portal (Port 5173)
│   ├── src/                       # Components, Pages, State Context, API clients
│   └── package.json
├── data/                          # Production indices, clinical rules, and Synthea archive
│   ├── faiss_index/               # 2,204 chunks production index
│   ├── synthea/                   # synthea_sample_data_fhir_r4_nov2021.zip
│   └── rules/                     # DrugBank & SIDER interaction rules
└── audit_evidence/                # Verification reports, screenshots, Synthea manifests
```

---

## 4. Environment Variables Configuration

Copy the example environment template or configure the environment variables as shown below. 

> [!CAUTION]
> **Never embed real production credentials or API keys directly in source code or version control.**

### Express EHR Backend `.env`
Path: `Portal Major P/Bhumi/Doctor portal/backend/.env`

```env
# Database Configuration
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=<your_mysql_password>
DB_NAME=rag_healthcare_test

# Server Ports
PORT=5000

# Security and Cryptography
JWT_SECRET=demo_secure_jwt_secret_do_not_use_in_prod_32chars!

# External Service Gateways
FASTAPI_CDS_URL=http://127.0.0.1:8000
FASTAPI_URL=http://127.0.0.1:8000

# Database Safety Invariants
ALLOW_DESTRUCTIVE_DATABASE_TESTS=false
```

### Python RAG & CDS Backend Environment
Set in your PowerShell session or `.env` file at root:

```powershell
$env:DB_HOST = "127.0.0.1"
$env:DB_PORT = "3306"
$env:DB_USER = "root"
$env:DB_PASSWORD = "<your_mysql_password>"
$env:DB_NAME = "rag_healthcare_test"
$env:FASTAPI_HOST = "127.0.0.1"
$env:FASTAPI_PORT = "8000"
```

---

## 5. Database Setup & Safe Migration Order

The platform enforces strict isolation between:
1. `rag_healthcare`: Primary production database (Protected by `databaseSafetyGuard.js`).
2. `rag_healthcare_test`: Isolated verification and demonstration database.

### Step 5.1: Start MySQL Server
If MySQL is not already running as a Windows service, launch it via PowerShell:

```powershell
# In PowerShell (run as Administrator if needed):
Start-Service MySQL80
# OR if running standalone binary:
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" --console
```

Verify port 3306 is listening:
```powershell
Get-NetTCPConnection -LocalPort 3306 -State Listen
```

### Step 5.2: Prepare the Isolated Test Database
Execute the schema creation and migrations against `rag_healthcare_test`:

```powershell
cd "E:\Major Project Code"

# Create schema and baseline tables
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS rag_healthcare_test;"

# Apply migration scripts in strict sequential order:
mysql -u root -p rag_healthcare_test < "Portal Major P\Bhumi\Doctor portal\backend\src\migrations\001_initial_schema.sql"
mysql -u root -p rag_healthcare_test < "Portal Major P\Bhumi\Doctor portal\backend\src\migrations\002_create_discharges.sql"
mysql -u root -p rag_healthcare_test < "Portal Major P\Bhumi\Doctor portal\backend\src\migrations\003_create_prescription_ocr_jobs.sql"
mysql -u root -p rag_healthcare_test < "Portal Major P\Bhumi\Doctor portal\backend\src\migrations\004_account_activation_and_roles.sql"
mysql -u root -p rag_healthcare_test < "migrations\010_create_password_resets.sql"
mysql -u root -p rag_healthcare_test < "migrations\011_enhance_appointment_intervals_and_audit.sql"

# Standardize and clean doctor directory (deterministic referential integrity):
node scratch/clean_doctor_directory.js
```
```

---

## 5. Safe Synthea FHIR R4 Cohort Ingestion

The platform features an idempotent, audited Synthea importer that loads real synthetic patients into `rag_healthcare_test` without inventing clinician approvals, fake discharge plans, or unverified blood groups.

### Step 5.1: Verify Synthea Source Archive
Locate the Synthea FHIR R4 bundle ZIP archive:
```powershell
Test-Path "C:\Users\ABHYUDAYA\OneDrive\Desktop\synthea_sample_data_fhir_r4_nov2021.zip"
# Expected output: True
```

### Step 5.2: Run Importer in Dry-Run Mode (Safe Preview)
```powershell
cd "E:\Major Project Code"
python scratch/import_synthea_cohort.py `
  --archive "C:\Users\ABHYUDAYA\OneDrive\Desktop\synthea_sample_data_fhir_r4_nov2021.zip" `
  --dry-run `
  --db-name rag_healthcare_test `
  --db-password <your_mysql_password>
```

### Step 5.3: Run Importer in Live Mode (Transactional)
```powershell
python scratch/import_synthea_cohort.py `
  --archive "C:\Users\ABHYUDAYA\OneDrive\Desktop\synthea_sample_data_fhir_r4_nov2021.zip" `
  --live `
  --db-name rag_healthcare_test `
  --db-password <your_mysql_password>
```

### Step 5.4: Verify Ingestion Integrity
Verify that all 5 cohort patients, active conditions, allergies, and observation records map accurately:
```powershell
python scratch/verify_synthea_import.py `
  --manifest "audit_evidence\synthea_cohort_manifest.json" `
  --db-name rag_healthcare_test `
  --db-password <your_mysql_password>
```
*Expected Result*: `Cohort verification: 5/5 patients cleanly verified. 0 discrepancies.`

---

## 6. How to Start the Services

Open three separate PowerShell terminal windows or run the startup scripts.

### Terminal 1: FastAPI CDS Gateway & Frozen RAG v2.10 (Port 8000)
```powershell
cd "E:\Major Project Code"
python -m uvicorn rag_module.api:app --host 127.0.0.1 --port 8000
```
* **Interactive OpenAPI Docs**: `http://127.0.0.1:8000/docs`
* **Health Check**:
  ```powershell
  Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Method Get | ConvertTo-Json
  ```
  Expected Response:
  ```json
  {
    "status": "healthy",
    "version": "2.9.1",
    "service_ready": true,
    "index_ready": true,
    "indexed_chunks_count": 2204,
    "embedding_model": "BAAI/bge-small-en",
    "dense_ready": true,
    "bm25_ready": true,
    "hybrid_ready": true,
    "reranker_status": "fallback_pass_through"
  }
  ```

### Terminal 2: Express EHR Backend & OCR Pipeline (Port 5000)
```powershell
cd "E:\Major Project Code\Portal Major P\Bhumi\Doctor portal\backend"
$env:PORT = "5000"
$env:DB_NAME = "rag_healthcare_test"
$env:DB_PASSWORD = "<your_mysql_password>"
node server.js
```
* **Health Check**:
  ```powershell
  Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/health" -Method Get | ConvertTo-Json
  ```
  Expected Response:
  ```json
  {
    "status": "healthy",
    "services": {
      "database": "connected",
      "database_name": "rag_healthcare_test",
      "express_gateway": "active",
      "cds_bridge": "active"
    },
    "indexed_chunks_count": 2204,
    "version": "2.10"
  }
  ```

### Terminal 3: Unified Clinical Web Application (Port 5173)
```powershell
cd "E:\Major Project Code\frontend"
npm run dev
```
* **Application URL**: `http://localhost:5173`
* **Login URL**: `http://localhost:5173/login`

---

## 7. Verified Demo Accounts & Credentials

The platform uses role-based authentication. Test using these verified demonstration credentials:

| Role | Account Email | Password | Context & Invariants |
|---|---|---|---|
| **Doctor** | `doctor@gmail.com` | `doctor123` | Full clinical privileges, prescription authoring, safety override, discharge authoring. |
| **Receptionist** | `receptionist@gmail.com` | `receptionist123` | Patient registration, appointment scheduling, queue management. |
| **Patient (Aarav Patil)** | `patient@gmail.com` | `patient123` | **Patient ID 1**. Has authorized post-discharge plan (`Amlodipine 5mg`, wound care). Verifies grounded recovery assistant. |
| **Patient (Synthea Terrilyn)** | `synthea.terrilyn.murphy@demo.local` | `patient123` | **Patient ID 149**. Real Synthea imported record. 10 documented allergies (Aspirin, Latex), 25 conditions. **Zero discharge plan**. Verifies honest absence disclosure. |
| **Patient (Synthea Trinh)** | `synthea.trinh.sanford@demo.local` | `patient123` | **Patient ID 150**. Documented Penicillin allergy. |
| **Patient (Synthea Brain)** | `synthea.brain.wuckert@demo.local` | `patient123` | **Patient ID 151**. Documented Bactrim (Sulfamethoxazole/Trimethoprim) allergy. |

---

## 8. Full Automated Regression Test Commands

Run the full verification suite directly from Windows PowerShell.

### 8.1: Master E2E 10-Scenario Clinical Safety & CDS Suite
Tests Patient A discharge grounding, Patient B honest absence, Cross-Patient BOLA 403 isolation, DailyMed reference routing, DDI and allergy hard stops:
```powershell
cd "E:\Major Project Code"
node scratch/verify_e2e_10_scenarios.js
```
*Expected: 10 / 10 PASSED (100%)*

### 8.2: Comprehensive Drug-Drug Interaction Benchmark
Evaluates 15 true positives, 5 negative controls, duplicate ingredients, allergy contraindications, and unknown entity abstentions:
```powershell
python scripts/evaluate_ddi_comprehensive.py
```
*Expected: 29 / 29 PASSED (100% Sensitivity, 100% Specificity)*

### 8.3: FastAPI CDS Gateway Pytest Suite
```powershell
python -m pytest cds_module/ -v
```
*Expected: 11 / 11 PASSED (100%)*

### 8.4: Honest Post-Discharge Intent & Absence Unit Tests
```powershell
python -m unittest scratch/test_priority1_honest_discharge.py
```
*Expected: 6 / 6 PASSED (100%)*

### 8.5: Unified Prescription Safety Gate & Override Audit
```powershell
$env:ALLOW_DESTRUCTIVE_DATABASE_TESTS = "true"
$env:DB_NAME = "rag_healthcare_test"
$env:TEST_EXPRESS_PORT = "5001"
$env:ALLOW_DEFAULT_DEV_PORT = "true"
node scratch/test_priority2_unified_prescription_gate.js
```
*Expected: 11 / 11 PASSED (100%)*

### 8.6: Adversarial Allergy Bypass Protection Test
Verifies direct HTTP submission and OCR confirmation cannot bypass documented allergy hard stops:
```powershell
$env:ALLOW_DESTRUCTIVE_DATABASE_TESTS = "true"
$env:DB_NAME = "rag_healthcare_test"
$env:TEST_EXPRESS_PORT = "5001"
$env:ALLOW_DEFAULT_DEV_PORT = "true"
node scratch/test_adversarial_allergy_bypass.js
```
*Expected: 3 / 3 PASSED (100%)*

### 8.7: Prescription Image OCR & Verification Pipeline
```powershell
$env:ALLOW_DESTRUCTIVE_DATABASE_TESTS = "true"
$env:DB_NAME = "rag_healthcare_test"
$env:TEST_EXPRESS_PORT = "5001"
$env:ALLOW_DEFAULT_DEV_PORT = "true"
node scratch/test_prescription_ocr_pipeline.js
```
*Expected: 12 / 12 PASSED (100%)*

### 8.8: Patient Credential Security & Password Policy Audit
```powershell
$env:ALLOW_DESTRUCTIVE_DATABASE_TESTS = "true"
$env:DB_NAME = "rag_healthcare_test"
$env:TEST_EXPRESS_PORT = "5001"
$env:ALLOW_DEFAULT_DEV_PORT = "true"
node scratch/test_patient_credential_security_audit.js
```
*Expected: 7 / 7 PASSED (100%)*

### 8.9: Multilingual Clinical Safety Suite (en, hi, mr, gu)
```powershell
node scratch/test_multilingual_independent_audit.js
```
*Expected: 12 / 12 PASSED (100% across all 4 languages)*

### 8.10: Frontend Production Build Validation
```powershell
cd "E:\Major Project Code\frontend"
npm run build
```
*Expected: 0 errors (2,253 modules transformed in ~2.1s)*

### 8.11: Password Reset Lifecycle & Cryptographic Token Suite
Verifies account recovery anti-enumeration, single-use SHA-256 tokens, expiry, and replay prevention:
```powershell
node scratch/test_password_reset_flow.js
```
*Expected: 21 / 21 PASSED (100%)*

### 8.12: Supabase Security Boundary & Deployment Readiness Suite
Verifies zero service-role keys exposed, client role sanitization, BOLA isolation, and DNS reality:
```powershell
node scratch/test_supabase_security_and_deployment.js
```
*Expected: 35 / 35 PASSED (100%)*

### 8.13: Antigravity Browser Agent Verification (26 End-to-End States)
Verifies visual correctness across light/dark themes, doctor roster, Synthea dossiers, allergy stops, DDI alerts, PDFs, grounded discharge, Hindi UI, and mobile viewports:
```powershell
node scratch/package_final_release_gate_evidence.js
```
*Expected: 26 / 26 PASSED (Manifest saved to `audit_evidence/final_release_gate_20261025/evidence_manifest.json`)*

---

## 9. Troubleshooting & Common Operational Errors

### 9.1: Port Already in Use (e.g., Port 8000, 5000, or 5173)
If a previous background process is still bound to the port:
```powershell
# Identify process using port 8000:
$portInfo = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($portInfo) {
    Stop-Process -Id $portInfo.OwningProcess -Force
    Write-Host "Process terminated on port 8000."
}
```

### 9.2: Database Safety Refusal (`databaseSafetyGuard.js`)
If an automated test fails with:
`SAFETY REFUSAL: Destructive test blocked! Database must be rag_healthcare_test...`
Ensure the safety guard environment flags are explicitly defined before running:
```powershell
$env:ALLOW_DESTRUCTIVE_DATABASE_TESTS = "true"
$env:DB_NAME = "rag_healthcare_test"
$env:TEST_EXPRESS_PORT = "5001"
$env:ALLOW_DEFAULT_DEV_PORT = "true"
```

### 9.3: Cross-Encoder Lazy Loading Latency
On the very first request to `/cds/evaluate`, the Cross-Encoder model (`cross-encoder/ms-marco-MiniLM-L-6-v2`) loads into CPU/GPU memory, taking approximately 1.5 seconds. Subsequent requests execute in < 45ms.

### 9.4: Synthea Importer `FileNotFoundError`
Ensure you pass the full absolute path or properly formatted path to the ZIP archive:
```powershell
python scratch/import_synthea_cohort.py --archive "C:\Users\ABHYUDAYA\OneDrive\Desktop\synthea_sample_data_fhir_r4_nov2021.zip" --dry-run
```

---

## 10. Graceful Platform Shutdown

To stop all platform components cleanly:
```powershell
# Stop Node.js processes (Express and Vite)
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force

# Stop Python backend processes (FastAPI / Uvicorn)
Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*uvicorn*" } | Stop-Process -Force

Write-Host "Platform services stopped cleanly."
```
