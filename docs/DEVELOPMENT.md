# LOCAL DEVELOPMENT & OPERATIONAL RUNBOOK

> **Developer Setup, Migration Management & Safe Synthetic Seeding**  
> **Project**: Modular AI-Powered Multilingual Clinical Decision Support System (CDSS)  
> **Repository Root**: `E:\Major Project Code`  

---

## 1. Prerequisites

- **Node.js**: `v20.x` or higher
- **Python**: `3.12.x` (64-bit) with virtual environment support
- **MySQL Server**: `8.0.x` listening on port `3306`
- **PowerShell**: `7.x` or Windows PowerShell `5.1+`

---

## 2. Environment Configuration

1. **Express Gateway Environment (`Portal Major P/Bhumi/Doctor portal/backend/.env`)**:
   ```ini
   PORT=5000
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=YOUR_LOCAL_PASSWORD
   DB_NAME=rag_healthcare
   JWT_SECRET=your_secure_development_jwt_secret
   FASTAPI_CDS_URL=http://127.0.0.1:8000
   ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5000
   ```

2. **Repository Root Environment (`.env`)**:
   - Mirrors backend configuration for CLI tools and scratch test suites.

---

## 3. Database Schema & Migrations

All migrations target the `rag_healthcare` database located in `migrations/`:
- `001_initial_schema.sql`: Core tables (`users`, `doctors`, `patients`, `appointments`, `prescriptions`, `medical_history`).
- `002_create_discharges.sql`: Hospital discharge summaries and post-discharge follow-up care instructions.
- `003_create_prescription_ocr_jobs.sql`: Prescription image upload staging, candidate extraction, and clinician review tracking.
- `004_create_account_activations.sql`: Cryptographic patient activation tokens and password setup.

### Safety Invariant
Never run destructive rollbacks (`001_rollback.sql`) against an active database.

---

## 4. Single-Command Lifecycle

### Starting the Platform
```powershell
.\start_demo.ps1
```
- Automatically checks prerequisites.
- Starts FastAPI CDS (port 8000), Express Gateway (port 5000), Doctor Portal (port 5173), Receptionist Portal (port 5174), and Patient Portal (port 5175).
- Opens the Central Hub at `http://localhost:5000/`.
- Tracks process IDs in `.runtime/pids.json` and writes logs to `.runtime/logs/`.

### Stopping the Platform
```powershell
.\stop_demo.ps1
```
- Terminates only tracked launcher processes.
- **Leaves MySQL running** to prevent database corruption.

---

## 5. Portal Endpoints & Default Roles

- **Central Hub**: `http://localhost:5000/`
- **Doctor Portal**: `http://localhost:5173`
  - Synthetic Doctor: `doctor@gmail.com`
- **Receptionist Portal**: `http://localhost:5174`
  - Synthetic Receptionist: `receptionist@gmail.com`
- **Patient Portal**: `http://localhost:5175`
  - Self-Registration: Accessible via "Create Account" tab on `http://localhost:5175`.
  - Canonical Test Patient: `aarav@gmail.com` [credentials redacted]
  - Patient Account Activation: `http://localhost:5175/activate`

---

## 6. Safe Synthetic Data Cleanup

To remove transient timestamped test accounts while preserving canonical users:
```powershell
node scratch/cleanup_transient_test_records.js
```
This script creates a full backup to `scratch/pre_cleanup_backup.sql` before pruning transient records in an atomic SQL transaction.
