# AGENTS.md — Developer & AI Agent Operations Manual

> **Authoritative Root Guide for Developers and AI Coding Agents**
> **Project**: Modular AI-Powered Clinical Decision Support (CDS) System (4th-Year Major Project)
> **Repository Branch**: `main` (Merged Baseline `cbee83a`, Hardened `5a03d85`)
> **RAG Frozen Baseline Commit**: `497a547` (Hardened V2.10)
> **Frontend Integration Baseline Commit**: `893155a` (Verified E2E)

---

## 1. What is this Project?

This project is a **Modular Clinical Decision Support (CDS) System** designed to assist healthcare professionals and patients with:
1. **Evidence-Grounded Medical Intelligence (RAG)**: Multi-source, citation-backed answers with strict fail-closed safety.
2. **Medication Safety & Interaction Engine (`drug_module`)**: Multi-drug interaction screening and adverse effect lookups based on verified clinical guidelines (DrugBank, SIDER).
3. **Prescription Parsing & Extraction (`prescription_module`)**: Free-text clinical prescription extraction (drug, dose, route, frequency, duration).
4. **Clinical Web Portal (`frontend`)**: React + Vite interface with role-based navigation, clinical dashboard, drug checker, and an interactive CDS Assistant.

---

## 2. Project Architecture & Module Locations

```text
                                  FRONTEND
                      (React + Vite on port 5173)
                                     │
                                     ▼
                               API / GATEWAY
                      (FastAPI /api on port 8000)
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          ▼                          ▼                          ▼
     rag_module                 drug_module            prescription_module
(Evidence RAG v2.10)        (Drug Safety Engine)       (Prescription Parser)
   • FAISS (2,204 chunks)      • 8 Interaction Rules       • Entity Extraction
   • BM25 Lexical Search       • 20 SIDER Drug Profiles    • Regex Rule Engine
   • RRF Fusion (k=60)         • Severity Classification   • Structured Dosing
   • Cross-Encoder Rerank
   • Verifier (Fail-Closed)
          └──────────────────────────┬──────────────────────────┘
                                     ▼
                               CLINICAL DATA
                (data/ — FAISS indices, DailyMed, Rules)
```

### Module Layout
* **`rag_module/`**: Production RAG intelligence engine (Frozen v2.10).
  * Entry point: `rag_module/api.py` (`app = FastAPI(version="2.9.1")`)
  * Pipeline orchestrator: `rag_module/rag_pipeline.py` (`MedicalRAGPipeline`)
  * Service layer: `rag_module/service.py` (`RAGService`)
  * Retrieval: `rag_module/retrieval/` (`dense_retriever.py`, `bm25_retriever.py`, `hybrid_retriever.py`)
  * Reranking: `rag_module/reranking/cross_encoder_reranker.py` (`cross-encoder/ms-marco-MiniLM-L-6-v2`)
  * Safety: `rag_module/safety/` (`guardrails.py`, `evidence_policy.py`, `grounding_verifier.py`)
  * Generation: `rag_module/generation/generator_v2.py` (`TinyLlama-1.1B-Chat-v1.0`)
* **`drug_module/`**: Medication safety and interaction engine.
  * Entry point: `drug_module/api.py` (FastAPI app on port 8001 or integrated via gateway)
  * Data loader: `drug_module/data_loader.py` (loads verified DrugBank and SIDER rules from `data/rules/medication_interactions/`)
  * Interaction engine: `drug_module/interaction_engine.py`
  * Side effect engine: `drug_module/side_effect_engine.py`
* **`prescription_module/`**: Prescription information extraction engine.
  * Entry point: `prescription_module/api.py` (FastAPI app on port 8002)
  * Extraction: `prescription_module/extractor.py` and `regex_rules.py`
* **`frontend/`**: Patient & Doctor clinical portal.
  * Entry point: `frontend/src/App.jsx` and `AppRoutes.jsx`
  * API integration client: `frontend/src/api/ragApi.js`
  * CDS Assistant component: `frontend/src/pages/Common/CDSAssistant.jsx`
  * Drug checker component: `frontend/src/pages/Patient/DrugChecker.jsx`
* **`data/`**: Production vector indices, metadata, and clinical interaction rules.
  * `data/faiss_index/` & `rag_module/data/faiss_index/`: Production FAISS index (`index_v2.bin`, `meta_v2.pkl`) with 2,204 chunks.
  * `data/rules/medication_interactions/`: Verified drug-drug interaction and adverse effect JSON rules.
* **`docs/`**: Active architectural documentation and archived historical audit records (`docs/archive/`).

---

## 3. What is FROZEN (DO NOT MODIFY)

The RAG backend evaluation state is **HARD FROZEN** at commit `497a547`.

**DO NOT MODIFY OR REDESIGN:**
* FAISS index structure (`2,204` production chunks)
* Embedding model (`BAAI/bge-small-en`, 384 dimensions)
* BM25 sparse lexical retriever
* Reciprocal Rank Fusion (RRF, `k=60`)
* Cross-Encoder second-stage reranker (`cross-encoder/ms-marco-MiniLM-L-6-v2`)
* `EvidencePolicyEngine` and dynamic entity isolation rules
* `AnswerGroundingVerifier` contract and proposition extraction rules
* Grounding thresholds and fail-closed safety behavior
* Emergency triage interception logic
* Prompt-injection defense logic

> **Rule for Agents**: Do not attempt to alter RAG evaluation scores or relax grounding thresholds. Build **around** the frozen RAG engine.

---

## 4. Current Status & Phase Progress

* **Phase 0 (RAG Core Freeze)**: **COMPLETE & HARD FROZEN** (Commit `497a547`, 2,204 chunks, 190 pass).
* **Phase 1 (CDS Gateway & Security Boundary)**: **COMPLETE & VERIFIED** (`/cds/evaluate`, `/cds/screen-prescription`, 9/9 pass).
* **Phase 2 (Doctor Portal E2E Integration)**: **COMPLETE & VERIFIED** (Express Bridge 7/7 pass, Portal Responsibilities 25/25 pass, Doctor E2E 26/26 pass, Browser E2E verified).
* **Phase 3 (Multilingual Foundation)**: **COMPLETE & VERIFIED** (en, hi, mr, 16/16 pass).
* **Phase 4 (Secure Receptionist Integration)**: **COMPLETE & VERIFIED** (Ketki Receptionist UI adapted on port 5174, Express routes verified, 9/9 pass).
* **Phase 5 (Patient Self-Service Portal)**: **COMPLETE & VERIFIED** (Patient UI on port 5175, Express endpoints verified, 14/14 pass).
* **Phase 6 (Post-Discharge Care & Follow-Up)**: **COMPLETE & VERIFIED** (Discharges migration 002, Doctor discharge creation, Patient discharge viewing, Restricted educational CDS).
* **Phase 7 (Prescription Image OCR Pipeline)**: **COMPLETE & VERIFIED** (OCR jobs migration 003, Multer magic-byte validation, offline Tesseract.js, Regex entity extraction, Clinician review invariant, 12/12 pass).
* **Phase 8 (Full-System Multi-Role Synthetic Journey)**: **COMPLETE & VERIFIED** (End-to-end multi-role lifecycle, negative security matrix, 20/20 pass).
* **Phase 9 (Secure Role Selection, Account Lifecycle & RBAC)**: **COMPLETE & VERIFIED** (Migration 004, 3-role entry selector, no universal passwords, cryptographic single-use activation, 12/12 pass, browser E2E verified).

---

## 5. How to Run the System

### A. Run MySQL Server (Port 3306)
```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" --datadir=".../scratch/mysql_data" --port=3306 --console
```

### B. Run Express EHR Backend with OCR (Port 5000)
```powershell
cd "Portal Major P/Bhumi/Doctor portal/backend"
node server.js
```

### C. Run FastAPI CDS Gateway & Frozen RAG (Port 8000)
```powershell
python -m uvicorn rag_module.api:app --host 127.0.0.1 --port 8000
```
* Interactive Docs (Swagger): `http://127.0.0.1:8000/docs`
* Health Endpoint: `http://127.0.0.1:8000/health`
* CDS Endpoint: `http://127.0.0.1:8000/cds/evaluate`

### D. Run Unified Healthcare Web Application (Port 5173)
```powershell
cd "frontend"
npm run dev
```
* Primary Web Application Entry URL: `http://localhost:5173`
* Unified Login: `http://localhost:5173/login`
* Single-Use Account Activation: `http://localhost:5173/activate`

### E. One-Command Master Startup Orchestrator
```powershell
# Run from repository root
npm start
# OR
powershell -ExecutionPolicy Bypass -File ./scripts/start_platform.ps1
```
Automatically verifies, starts, and health-checks MySQL (3306), FastAPI CDS Gateway (8000), Express EHR Backend (5000), and Unified Frontend (5173).

---


## 6. How to Test (Full Regression Suite)

1. **RAG Core Regression (190 passed, 2 skipped, 0 failed)**:
   ```powershell
   python -m pytest rag_module/tests/ -q
   ```
2. **CDS Gateway Suite (9/9 passed)**:
   ```powershell
   python -m pytest cds_module/ -v
   ```
3. **Express -> FastAPI Bridge Suite (7/7 passed)**:
   ```powershell
   node scratch/test_phase3_express_bridge.js
   ```
4. **Portal CDS Responsibilities Suite (25/25 passed)**:
   ```powershell
   node scratch/test_portal_cds_responsibilities.js
   ```
5. **Doctor Portal Automated E2E Suite (26/26 passed)**:
   ```powershell
   node scratch/test_doctor_portal_e2e.js
   ```
6. **Multilingual Foundation Suite (16/16 passed)**:
   ```powershell
   python -m pytest multilingual_module/tests/ -v
   ```
7. **Receptionist Endpoints Suite (9/9 passed)**:
   ```powershell
   node scratch/test_receptionist_endpoints.js
   ```
8. **Patient & Discharge Care Suite (14/14 passed)**:
   ```powershell
   node scratch/test_patient_and_discharge.js
   ```
9. **Prescription OCR Pipeline Suite (12/12 passed)**:
   ```powershell
   node scratch/test_prescription_ocr_pipeline.js
   ```
10. **Full-System Multi-Role Synthetic Journey (20/20 passed)**:
    ```powershell
    node scratch/test_full_system_multi_role_e2e.js
    ```
11. **Account Activation & RBAC Suite (12/12 passed)**:
    ```powershell
    node scratch/test_activation_and_role_mismatch.js
    ```
12. **Frontend Production Build Checks (0 errors across all 4 frontends)**:
    ```powershell
    cd "Portal Major P/Bhumi/Doctor portal/frontend"; npm run build
    cd "Portal Major P/Ketki/receptionist_frontend"; npm run build
    cd "Portal Major P/patient_frontend"; npm run build
    cd "frontend"; npm run build
    ```

---

## 7. Known Limitations (Documented, Not Bugs)

1. **Lazy Loading Cold-Start**:
   * The Cross-Encoder reranker is loaded into GPU/CPU memory on the first inference request (~1.5s cold-start), then dynamically switches to `"available"`.
2. **Compact Generator Capacity (`TinyLlama-1.1B-Chat`)**:
   * Local 1.1B generator occasionally generates conversational preambles or anaphora drift. The `AnswerGroundingVerifier` intercepts these fail-closed, withholding unverified answers safely.
3. **Corpus Coverage**:
   * The production corpus contains 2,204 chunks covering major cardiovascular, diabetic, and primary care medications. Unindexed entities correctly trigger policy abstentions (`abstained_policy`).

---

## 8. Milestone History

* `066f7a4`: **RAG Core Freeze** — Frozen RAG V2.10 backend with verified emergency safety and 100-query benchmark.
* `497a547`: **RAG API Hardening** — Hardened `/chat` contract, fixed Lipitor generic normalization, and prompt-injection early block.
* `218b718`: **Pre-Frontend Checkpoint** — Checkpoint commit before frontend integration.
* `a825690`: **Frontend Integration** — Integrated Doctor Dashboard and conversational assistant with live RAG `/chat`.
* `893155a`: **E2E Validation & Polish** — Polished 8-query demo pills, removed hardcoded emergency numbers, verified E2E fidelity.
* `58a2bcd`: **State Consolidation** — Consolidated documentation and baseline freeze.
* `7b0867b`: **Unified Platform Merge** — Integrated Frozen RAG V2.10, CDS Gateway, verified Doctor Portal, and Multilingual Foundation.

---

## 9. Authoritative Documentation Index

* [`FINAL_GOAL.md`](file:///E:/Major%20Project%20Code/FINAL_GOAL.md): Authoritative product completion contract & acceptance criteria.
* [`PROJECT_STATUS.md`](file:///E:/Major%20Project%20Code/PROJECT_STATUS.md): Living reality snapshot (verified vs reported functionality, test results).
* [`DECISIONS.md`](file:///E:/Major%20Project%20Code/DECISIONS.md): Canonical engineering decisions log (DEC-001 through DEC-013).
* [`FLOW.md`](file:///E:/Major%20Project%20Code/FLOW.md): Function-by-function execution and data-flow map.
* [`docs/CURRENT_STATE.md`](file:///E:/Major%20Project%20Code/docs/CURRENT_STATE.md): Canonical state inventory and subsystem architecture.
* [`docs/DO_NOT_BREAK.md`](file:///E:/Major%20Project%20Code/docs/DO_NOT_BREAK.md): Non-negotiable architectural invariants & freeze rules.
* [`docs/ROADMAP.md`](file:///E:/Major%20Project%20Code/docs/ROADMAP.md): Multi-phase roadmap and verified milestones.

---

## 10. Mandatory AI Agent Operating Contract

Every future AI coding assistant working in this repository MUST strictly abide by these operating rules:

1. **Read Canonical Documents First**: Before proposing or executing meaningful code modifications, you MUST read `FINAL_GOAL.md`, `PROJECT_STATUS.md`, `DECISIONS.md`, and the relevant call path in `FLOW.md`.
2. **Establish Reality from Source Code**: Never trust an old summary over current source code. Always inspect actual files, routes, and tests.
3. **Protect the Frozen RAG Baseline**: Do NOT modify the FAISS index, embedding models, BM25, reranker, or grounding thresholds without explicit before-and-after benchmark evaluation and user authorization.
4. **Synchronize Decisions and Flow Maps**: Every meaningful code modification MUST update `DECISIONS.md` (recording context, decision, alternatives, trade-offs) and `FLOW.md` (updating the execution path and "Current Change" section) in the same commit.
5. **Mandatory User Quiz Gate**: Before implementing any meaningful code change, explain the execution path, trade-offs, and failure risks to the user, and test their understanding with targeted questions. Only proceed once the user demonstrates understanding.
6. **No Fabricated Claims**: Distinguish between Verified, Reported, Partially Verified, and Unverified results. Never invent credentials, endpoints, or benchmark metrics.
7. **No Unrequested Git Pushes**: Never execute `git push` without the user's explicit request.

