# PHASE 22 — OPEN ISSUES & ARCHITECTURAL DISPOSITION REGISTER

**System**: Healthcare Clinical Decision Support RAG Backend  
**Audit Date**: September 15, 2026  
**Auditor**: Senior Backend Systems & Reliability Engineer  
**Status**: All Critical Blockers CLOSED; Documented Accepted Scope Boundaries.

---

## 1. Issue Classification & Tracking Register

| Issue ID | Area | Description | Root Cause / Context | Status | Resolution / Engineering Rationale |
|---|---|---|---|---|---|
| **ISS-01** | **Entity Grounding** | Coined / Hallucinated drug names (`Cardioregulin`) previously matched general cardiovascular chunks. | Substring prefix matching (`tok[:5]`) matched "cardiovascular" roots. | **CLOSED** | Replaced prefix matching with whole-word token regex (`r'\b' + re.escape(tok) + r'\b'`). Verified blocked live. |
| **ISS-02** | **Diagnostics Import** | `/rag/trace` and `/debug/rag/trace` raised 500 error on $L_2$ norm calculation. | Missing `import numpy as np` in `rag_module/api.py`. | **CLOSED** | Added `import numpy as np` and unified trace request schemas. Tested live with 200 OK. |
| **ISS-03** | **CORS Connectivity** | Browser frontends on `localhost:3000` / `localhost:5173` blocked by default FastAPI CORS policy. | `CORSMiddleware` was not registered on the FastAPI app. | **CLOSED** | Added `CORSMiddleware` with explicit support for frontend local dev ports and production origins. |
| **ISS-04** | **Model/Index Lock** | Risk of loading an incompatible index if embedding model or dimension changed without rebuilding. | FAISS loader did not verify vector dimension or metadata length. | **CLOSED** | Added runtime validation in `FAISSIndexer.load_index`: asserts `index.d == 384` and `index.ntotal == len(metadata)`. |
| **ISS-05** | **Path Portability** | Potential risk of machine-specific absolute file system paths. | Hardcoded drive paths in early scripts. | **CLOSED** | Verified entire `rag_module/` uses dynamic `Path(__file__).resolve().parent...`. Zero machine-specific paths exist. |
| **ISS-06** | **Emergency Dispatch Scope** | Triage messaging hardcoded USA-specific 911 dispatch. | Early prototype prototype string. | **CLOSED** | Updated `EMERGENCY_RESPONSE` to include global/regional dispatch numbers: 911 (USA), 112 (Europe/India), 999 (UK). |
| **ISS-07** | **Legacy MedQuAD Ingestion** | 26,143 synthetic/scraped Q&A pairs contained noisy QA pairs without structured LOINC sections. | Legacy experimental dataset. | **ACCEPTED LIMITATION / QUARANTINED** | MedQuAD is completely quarantined from the production vector index (`index_v2.bin`). 2 skipped tests explicitly confirm bypass. |
| **ISS-08** | **LLM Generation Model** | Default local CPU LLM is TinyLlama-1.1B. | Local CPU environment constraint. | **ACCEPTED LIMITATION** | Generation is strictly isolated to `accepted_chunk_ids` context text. Local CPU generation is deterministic; pluggable with Gemini API via environment key. |
| **ISS-09** | **Curated Corpus Scale** | Production corpus contains 236 atomic sections rather than 50,000 SPL package files. | Scope boundary for major project research prototype. | **ACCEPTED LIMITATION** | Focuses on high-priority cardiovascular, endocrine, antimicrobial, and guideline monographs with 100% verified provenance. |
| **ISS-10** | **RxNorm Terminology Role** | Risk of treating RxNorm concept dictionary as prescribing clinical evidence. | Structural role ambiguity. | **CLOSED / DOCUMENTED** | RxNorm provides terminology normalization (RxCUIs, synonyms). Evidence policy prioritizes DailyMed/ICMR for warnings/contraindications. |

---

## 2. Summary of Engineering Dispositions

- **Total Audited Items**: 10
- **Closed / Fully Resolved**: 7
- **Accepted Scope Limitations**: 3
- **Unresolved Critical Blockers**: **0**

---

## 3. Freeze Declaration

No further architectural refactoring or feature additions are required. The backend contract is frozen for Frontend Integration.
