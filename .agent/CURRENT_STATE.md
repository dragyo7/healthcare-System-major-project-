# CURRENT STATE — MODULAR CLINICAL DECISION SUPPORT (CDS) PLATFORM

## 1. Executive Status

* **Repository**: `https://github.com/dragyo7/healthcare-System-major-project-`
* **Current Branch**: `feature/rag-v2-foundation`
* **RAG Backend Status**: **FROZEN at `fd2cac7` (v2.9.1)**.
  * Backend & API regression tests: **VERIFIED** (156 passed, 2 skipped, 0 failed).
  * Fail-closed safety, hybrid retrieval, cross-encoder reranker, and grounding verifier: **FROZEN & VERIFIED**.
  * Active Runtime Corpus: **2,204 Authentic Production Chunks** (`GET /health` reports `indexed_chunks_count: 2204`).
  * Archived Regression Baseline: **236 Golden Baseline Chunks** (`data/indices/golden_236/`).
* **Frontend Status**: **BUILD VERIFIED (Browser E2E Pending)**.
  * Stack: React 19 + Vite 8 + Tailwind CSS v4 (`http://127.0.0.1:5173`).
  * Production Build: Verified (`npm run build` passes cleanly).
  * API Integration: Implemented via `frontend/src/api/ragApi.js` connecting to FastAPI endpoints.
  * Browser E2E Status: **Pending** (UI components implemented and build passes; true browser-level E2E session not yet recorded).
* **Platform Integration Status**: **IN PROGRESS**.
  * Standalone engines exist for Drug Safety (`drug_module`) and Prescription Parsing (`prescription_module`).
  * Unified CDS API gateway and end-to-end orchestration are the active development targets.

---

## 2. Feature & Component Implementation Matrix

| Component / Layer | Implementation File | Verification Status | Forensic Evidence / Invariant |
| :--- | :--- | :--- | :--- |
| **CDS Assistant UI** | `frontend/src/pages/Common/CDSAssistant.jsx` | **IMPLEMENTED (Browser E2E Pending)** | Interactive clinical query interface with grounded markdown synthesis, provenance badges, citations, emergency alerts, and diagnostic trace drawer. |
| **RAG API Client** | `frontend/src/api/ragApi.js` | **VERIFIED (Build & Contract)** | Strongly-typed client covering `/health`, `/ready`, `/chat`, `/rag/query`, and `/rag/trace` with 35s timeout and error interceptors. |
| **Drug Checker UI** | `frontend/src/pages/Patient/DrugChecker.jsx` | **IMPLEMENTED (Browser E2E Pending)** | Monograph lookup interface for drug interactions, boxed warnings, and contraindications. |
| **Modular Boundaries** | `frontend/src/modules/` | **VERIFIED (Code Structure)** | Clean adapter structure established for `multilingual/translationAdapter.js`, `knowledgeBases/registryAdapter.js`, and `multimodal/ocrAdapter.js`. |
| **Production Knowledge Base** | `data/normalized/expanded_production_chunks.json` | **VERIFIED (100%)** | 2,204 authentic chunks (DailyMed: 2,176, ICMR: 8, MoHFW: 4, MedlinePlus: 16). 0 empty, 0 duplicate, 0 synthetic chunks in production. |
| **Active Production Index** | `data/indices/production/` & `rag_module/data/faiss_index/` | **VERIFIED & ACTIVE** | FAISS IndexFlatIP (2,204 vectors, 384D). BM25 index and metadata active. |
| **Golden 236 Baseline Archive**| `data/indices/golden_236/` | **VERIFIED & ARCHIVED**| 236-chunk golden regression baseline preserved. |
| **Provenance Validator** | `rag_module/safety/provenance_validator.py` | **VERIFIED (100%)** | 2,204 / 2,204 production chunks pass complete cryptographic & metadata lineage audit (`invalid = 0`). |
| **Model Specification Lock** | `data/manifests/model_index_lock.json` | **VERIFIED & LOCKED** | Dense Model: `BAAI/bge-small-en` (Embedding Dimension: 384, Max Context Window: 512 tokens, L2-normalized, Inner Product similarity). |
| **Cross-Encoder Reranker** | `rag_module/reranking/cross_encoder_reranker.py` | **VERIFIED & LOCKED** | `cross-encoder/ms-marco-MiniLM-L-6-v2` lazy-loaded on first inference request with pass-through fallback. |
| **Evidence Policy Engine** | `rag_module/safety/evidence_policy.py` | **VERIFIED (Frozen)** | Deterministic grounding evaluator generating auditable `GroundingDecision` contracts with boundary-safe clinical entity verification. |
| **Entity Grounding & Abstention** | `rag_module/safety/evidence_policy.py` | **VERIFIED (Frozen)** | Enforces fail-closed abstention (`generation_allowed = False`) on unsupported clinical entities and out-of-domain queries. |
| **Emergency Guardrail** | `rag_module/safety/guardrails.py` | **VERIFIED (Frozen)** | Deterministic pre-retrieval triage for acute life-threatening symptoms (chest pain, stroke, breathing crises). 100% interception with Indian helplines (112, 108, 102). |
| **Prompt Injection Defense** | `rag_module/safety/guardrails.py` | **VERIFIED (Frozen)** | Sanitizes control characters and delimiters; retrieved text treated strictly as passive data/evidence, never instructions. |
| **FastAPI Backend & API Contract** | `rag_module/api.py` | **VERIFIED (Frozen)** | Exposes `/chat`, `/rag/query`, `/retrieve`, `/debug/rag/trace`, `/health`, `/ready`. OpenAPI 3.1.0 verified. |
| **RAG Regression Test Suite** | `rag_module/tests/` | **VERIFIED** | **156 passed, 2 skipped, 0 failed** in ~112s. |

---

## 3. Production Corpus Characterization & Integrity

* **Total Active Production Chunks**: 2,204
* **Source Distribution**:
  * **DailyMed (FDA SPL Monographs)**: 2,176 chunks (98.73%)
  * **ICMR (Clinical Management Guidelines)**: 8 chunks (0.36%)
  * **MoHFW (Standard Treatment Guidelines)**: 4 chunks (0.18%)
  * **MedlinePlus (Health Topics)**: 16 chunks (0.73%)
* **Data Hygiene**:
  * Empty chunks: 0
  * Missing URLs / publishers: 0
  * Exact duplicates: 0
  * Normalized duplicates: 0
  * Quarantined chunks: 0
  * Synthetic chunks in production: 0
* **Ingestion Adapters vs Active Corpus**:
  * Ingestion adapters exist in `rag_module/ingestion/adapters/` for DailyMed, MedQuAD, openFDA, and Clinical Guidelines.
  * Only indexed and validated chunks reside in the active vector index (currently 2,204 chunks). Adapters are decoupled ingestion pipelines, not necessarily loaded into production retrieval.

---

## 4. Current Development Sequence

The active engineering path follows this progression:

```text
RAG v2.9.1 (FROZEN at fd2cac7)
    ↓
Frontend RAG integration (Build verified, browser E2E pending)
    ↓
Unified public API surface (Gateway aggregating RAG, Drug Safety, Prescription)
    ↓
Drug Safety integration (Live interaction checks & SIDER adverse effects)
    ↓
Prescription integration (Free-text extraction to structured dosing)
    ↓
CDS orchestration (Prescription → Interaction screen → RAG evidence verification)
    ↓
Patient / EHR context layer (Allergies, conditions, renal function if required)
```
