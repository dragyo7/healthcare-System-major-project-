# Modular AI-Powered Multilingual Clinical Decision Support (CDS) System

[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![Node 20](https://img.shields.io/badge/Node-20.x-green.svg)](https://nodejs.org/)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Vite 8](https://img.shields.io/badge/Vite-8.0-646cff.svg)](https://vitejs.dev/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0%2B-ee4c2c.svg)](https://pytorch.org/)
[![FAISS](https://img.shields.io/badge/FAISS-1.7%2B-008080.svg)](https://github.com/facebookresearch/faiss)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![Express](https://img.shields.io/badge/Express-4.19-lightgrey.svg)](https://expressjs.com/)
[![MySQL 8](https://img.shields.io/badge/MySQL-8.0-orange.svg)](https://www.mysql.com/)

A modular, evidence-grounded **Clinical Decision Support (CDS) System** engineered for healthcare professionals, front-desk staff, and patients. Built as a 4th-Year Major Project, the platform combines deterministic rule engines with an evidence-bound Retrieval-Augmented Generation (RAG) intelligence layer, enforcing strict fail-closed safety, server-side RBAC, and authentic source attribution.

---

## 1. System Architecture

```text
                                  PORTAL WORKSTATIONS
               ┌───────────────────────────┼───────────────────────────┐
               ▼                           ▼                           ▼
         Doctor Portal            Receptionist Portal            Patient Portal
       (Vite on Port 5173)        (Vite on Port 5174)         (Vite on Port 5175)
               │                           │                           │
               └───────────────────────────┼───────────────────────────┘
                                           │ (Browser REST Calls)
                                           ▼
                                 EXPRESS EHR & CDS GATEWAY
                             (Node.js / Express on Port 5000)
                             • Unified Central Portal Hub (/)
                             • Server-Side RBAC & BOLA Guards
                             • PII Stripping Boundary (Zero identifiers to CDS)
                             • Upload Security & Magic-Byte Validation
                                           │
                ┌──────────────────────────┴──────────────────────────┐
                │ (Internal TCP)                                      │ (Loopback HTTP)
                ▼                                                     ▼
         MySQL DATABASE                                      FASTAPI CDS ENGINE
   (Port 3306 - rag_healthcare)                            (Port 8000 - 127.0.0.1)
   • 13 Normalized Tables                                  • Frozen RAG V2.10 Core
   • Bcrypt Hashed Passwords                               • Multilingual Canonicalizer (en, hi, mr, gu)
   • Single-Use Activation Tokens                          • Deterministic Drug Safety & Side Effects
   [STRICTLY PRIVATE / INTERNAL]                           [STRICTLY PRIVATE / INTERNAL]
```

---

## 2. Key Portals & Role Workflows

1. **Doctor Portal (`http://localhost:5173`)**:
   - Comprehensive EHR patient dossier and vitals viewer.
   - Evidence-grounded conversational Clinical CDS with citations.
   - Prescription OCR pipeline: untrusted image upload with mandatory clinician confirmation (`pending_review` invariant).
   - Inpatient hospital discharge creation and follow-up care scheduling.
2. **Receptionist Portal (`http://localhost:5174`)**:
   - Patient intake, demographic registration, and queue scheduling.
   - Single-use cryptographic account activation token provisioning (`account_activations`).
   - Strict administrative boundary: clinical CDS, discharge creation, and prescription confirmation are inaccessible.
3. **Patient Portal (`http://localhost:5175`)**:
   - Self-registration via the "Create Account" tab or staff-provisioned activation via `/activate`.
   - Access to personal health records, appointments, and active prescriptions.
   - **Post-Discharge Care Screen**: Displays physician summary, critical warning signs, and an **embedded Post-Discharge Clinical Assistant**.
   - **Dedicated Post-Discharge Chat Assistant**: Conversational guidance restricted to the patient's authorized discharge context across English, Hindi, Marathi, and Gujarati.
4. **Central Portal Hub (`http://localhost:5000/`)**:
   - Single launchpad providing direct links to all three workstations with real-time service health indicators.

---

## 3. Quick Start: One-Command Lifecycle

### Starting the Platform
```powershell
.\start_demo.ps1
```
- Validates Node.js, Python, and MySQL prerequisites.
- Starts FastAPI (port 8000), Express Gateway (port 5000), Doctor Portal (port 5173), Receptionist Portal (port 5174), and Patient Portal (port 5175).
- Automatically opens the Central Hub at `http://localhost:5000/`.
- Tracks spawned PIDs in `.runtime/pids.json` and writes service logs to `.runtime/logs/`.

### Stopping the Platform
```powershell
.\stop_demo.ps1
```
- Gracefully terminates only the processes tracked in `.runtime/pids.json`.
- **Leaves MySQL running** to protect database integrity.

---

## 4. Default Synthetic Demonstration Accounts

All demo credentials use secure bcrypt hashing (`$2b$10$`) and strict server-side role validation:

| Portal | URL | Demo Email | Role | Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Doctor** | `http://localhost:5173` | `doctor@gmail.com` | `doctor` | Full Clinical CDS, OCR Review, Discharges |
| **Receptionist**| `http://localhost:5174` | `receptionist@gmail.com` | `receptionist` | Patient Registration, Appointments, Token Provisioning |
| **Patient** | `http://localhost:5175` | `aarav@gmail.com` | `patient` | Personal Records, Post-Discharge Care & Chat |
| **Patient Self-Reg**| `http://localhost:5175` | *Self-Register* | `patient` | New Account Creation ("Create Account" tab) |
| **Patient Activation**| `http://localhost:5175/activate` | *Staff Token* | `patient` | Single-use Token Redemption & Password Setup |

---

## 5. Frozen Medical RAG Invariant (V2.10)

The core medical intelligence engine is **hard-frozen** at commit `497a547`:
- **Corpus**: 2,204 production chunks (`DailyMed`, `ICMR`, `DrugBank`).
- **Dense Retriever**: `BAAI/bge-small-en` (384-dimensional dense vectors).
- **Sparse Retriever**: BM25 lexical ranker over sanitized tokenized chunks.
- **Reranker**: `cross-encoder/ms-marco-MiniLM-L-6-v2`.
- **Generator**: `TinyLlama-1.1B-Chat-v1.0`.
- **Grounding Verifier**: Deterministic proposition-level `AnswerGroundingVerifier` enforcing strict fail-closed safety (`withheld_verification_failure`).

---

## 6. Authoritative Documentation Index

- [`docs/PROJECT_AUDIT_AND_REMEDIATION_REPORT.md`](file:///E:/Major%20Project%20Code/docs/PROJECT_AUDIT_AND_REMEDIATION_REPORT.md): Authoritative implementation audit, remediation record, and claim-to-evidence ledger.
- [`docs/FINAL_VERIFICATION_REPORT.md`](file:///E:/Major%20Project%20Code/docs/FINAL_VERIFICATION_REPORT.md): Authoritative final release gate evaluation, security audit, and verification record.
- [`docs/SECURITY.md`](file:///E:/Major%20Project%20Code/docs/SECURITY.md): Authoritative security architecture, threat model, RBAC matrix, rate limiting, and BOLA defenses.
- [`docs/TESTING.md`](file:///E:/Major%20Project%20Code/docs/TESTING.md): Canonical test commands, tiers, and verification evidence.
- [`docs/DEVELOPMENT.md`](file:///E:/Major%20Project%20Code/docs/DEVELOPMENT.md): Local development setup, migrations, and runbook.
- [`docs/DEPLOYMENT.md`](file:///E:/Major%20Project%20Code/docs/DEPLOYMENT.md): Staging, public cloud, and clinical deployment requirements and blockers.
- [`docs/ARCHITECTURE.md`](file:///E:/Major%20Project%20Code/docs/ARCHITECTURE.md): Architectural topology and module specifications.
- [`docs/CURRENT_STATE.md`](file:///E:/Major%20Project%20Code/docs/CURRENT_STATE.md): Canonical state inventory and baseline references.
- [`docs/MULTILINGUAL_ARCHITECTURE.md`](file:///E:/Major%20Project%20Code/docs/MULTILINGUAL_ARCHITECTURE.md): Deterministic Indic language normalization and canonical mapping.
- [`docs/ANDROID_WEB_INTEGRATION.md`](file:///E:/Major%20Project%20Code/docs/ANDROID_WEB_INTEGRATION.md): Capacitor Android wrapper architecture, parity matrix, and APK build runbook.
- [`docs/DATA_PROVENANCE_AND_INTEGRITY.md`](file:///E:/Major%20Project%20Code/docs/DATA_PROVENANCE_AND_INTEGRITY.md): Clinical knowledge corpus provenance, chunk accounting (2,204 chunks), and frozen SHA-256 integrity hashes.
