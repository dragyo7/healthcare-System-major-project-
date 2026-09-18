# AGENTS.md — Developer & AI Agent Operations Manual

> **Authoritative Root Guide for Developers and AI Coding Agents**  
> **Project**: Modular AI-Powered Clinical Decision Support (CDS) System (4th-Year Major Project)  
> **Repository Branch**: `feature/rag-v2-foundation`  
> **RAG Frozen Baseline Commit**: `fd2cac7`  

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
(Evidence RAG v2.9.1)       (Drug Safety Engine)       (Prescription Parser)
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
* **`rag_module/`**: Production RAG intelligence engine.
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
  * `data/faiss_index/`: Production FAISS index (`index_v2.bin`, `meta_v2.pkl`) with 2,204 chunks.
  * `data/rules/medication_interactions/`: Verified drug-drug interaction and adverse effect JSON rules.
* **`docs/`**: Active architectural documentation and archived historical audit records (`docs/archive/`).

---

## 3. What is FROZEN (DO NOT MODIFY)

The RAG backend evaluation state is **HARD FROZEN** at commit `fd2cac7`.

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

> **Rule for Agents**: Do not attempt to improve RAG evaluation scores or relax grounding thresholds. Build **around** the frozen RAG engine.

---

## 4. What is Currently Being Developed?

The current focus is **CDS Platform Module Integration**:
1. **Unified API Gateway**: Wiring `drug_module` and `prescription_module` endpoints alongside `rag_module` into a unified backend interface or client-side orchestration.
2. **Frontend CDS Assistant Enhancement**: Connecting the frontend `CDSAssistant.jsx` and `DrugChecker.jsx` to live drug interaction checking and prescription extraction.
3. **Prescription-to-Safety Flow**: Allowing a clinician to paste a prescription, parse the drugs, screen them for drug interactions (`drug_module`), and cross-reference clinical guidelines (`rag_module`).

---

## 5. How to Run the System

### A. Run RAG Backend API
```powershell
python -m uvicorn rag_module.api:app --host 127.0.0.1 --port 8000 --reload
```
* Interactive Docs (Swagger): `http://127.0.0.1:8000/docs`
* ReDoc: `http://127.0.0.1:8000/redoc`
* Health Endpoint: `http://127.0.0.1:8000/health`

### B. Run Frontend
```powershell
cd frontend
npm run dev
```
* Web Portal: `http://localhost:5173`

### C. Run Drug Safety Engine (Standalone)
```powershell
python -m uvicorn drug_module.api:app --host 127.0.0.1 --port 8001
```

### D. Run Prescription Module (Standalone)
```powershell
python -m uvicorn prescription_module.api:app --host 127.0.0.1 --port 8002
```

---

## 6. How to Test

### Run Full RAG Regression Test Suite
```powershell
python -m pytest rag_module/tests/ -v
```
* **Expected Result**: 156 passed, 2 skipped (offline fixtures), 0 failed.

### Run Frontend Build Check
```powershell
cd frontend
npm run build
```
* **Expected Result**: Clean production build in `< 10s`.

---

## 7. Known Limitations (Documented, Not Bugs)

1. **Lazy Loading Cold-Start**:
   * The Cross-Encoder reranker is loaded into GPU/CPU memory on the first inference request.
   * `GET /health` reports `reranker_status = "fallback_pass_through"` prior to the first query, then dynamically changes to `"available"`. This is intentional PyTorch memory management.
2. **Compact Generator Capacity (`TinyLlama-1.1B-Chat`)**:
   * Local 1.1B generator occasionally generates conversational preambles or anaphora drift.
   * The `AnswerGroundingVerifier` intercepts these fail-closed, withholding unverified answers safely.
3. **Corpus Coverage**:
   * The production corpus contains 2,204 chunks covering major cardiovascular, diabetic, and primary care medications. Unindexed entities (e.g., Atorvastatin) correctly trigger policy abstentions (`abstained_policy`).

---

## 8. Development Roadmap (Next Tasks in Priority Order)

1. **Task 1: Unified CDS Gateway Endpoint**
   * Expose a consolidated endpoint (e.g. `POST /cds/evaluate` or mounting `drug_module` routers into `rag_module/api.py`) allowing frontend clients to query RAG, drug interactions, and prescription analysis from one service.
2. **Task 2: Frontend Drug Checker Live Integration**
   * Wire `frontend/src/pages/Patient/DrugChecker.jsx` to call the verified `drug_module` interaction engine (`/check-interaction` and `/check-side-effects`).
3. **Task 3: Prescription-to-Safety Workflow in CDS Assistant**
   * Add a "Prescription Analysis" tab/card in `CDSAssistant.jsx` that takes free-text prescriptions, extracts medication lists, runs interaction checks, and allows 1-click evidence lookup in RAG.
4. **Task 4: Patient Context Store / Mock EHR Integration**
   * Provide a lightweight patient state store (allergies, current medications, renal function) to feed into the CDS evaluation pipeline.
