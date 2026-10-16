# CURRENT STATE — MODULAR CLINICAL DECISION SUPPORT (CDS) SYSTEM

**Last Updated**: 2026-09-27  
**Branch**: `feature/rag-v2-foundation` (Ready for merge to `main`)  
**RAG Core Baseline**: Commit `066f7a4` (Frozen)  
**RAG API Hardening**: Commit `497a547` (Frozen)  
**Doctor Frontend Integration**: Commit `a825690` (Integrated)  
**Final E2E Validation & Polish**: Commit `893155a` (Verified)

---

## 1. What is the Project?
A 4th-year Major Project: a **Modular, AI-Powered Clinical Decision Support (CDS) System** engineered to provide evidence-grounded, citation-backed medical intelligence with deterministic safety guardrails. It integrates multi-source clinical literature retrieval (RAG), rule-based medication safety screening (`drug_module`), prescription entity extraction (`prescription_module`), and a role-based clinical web portal (`frontend`).

---

## 2. What is Currently Implemented?
* **Evidence RAG Engine (`rag_module`)**:
  * Dual-index hybrid retriever combining dense `BAAI/bge-small-en` (384D, FAISS IndexFlatIP) and sparse lexical `BM25Okapi`.
  * Reciprocal Rank Fusion (`RRF k=60`) and second-stage cross-encoder reranker (`cross-encoder/ms-marco-MiniLM-L-6-v2`) with lazy loading and pass-through fallback.
  * Deterministic safety guardrails: Pre-retrieval emergency triage interceptor (`guardrails.py`) and early prompt-injection neutralizer (`guardrails.py`).
  * Canonical Clinical Entity Normalizer (`normalize_clinical_entities`) handling generic aliases (e.g., *Lipitor $\to$ Atorvastatin*).
  * Deterministic `EvidencePolicyEngine`: Enforces fail-closed boundaries on unindexed entities (`abstained_policy`) and out-of-domain queries.
  * Local LLM Generator (`TinyLlama-1.1B-Chat-v1.0`) paired with deterministic `AnswerGroundingVerifier` extracting atomic clinical claims and verifying unigram/token recall against retrieved context.
  * Production Corpus: 2,204 authentic DailyMed monographs (2,176), ICMR guidelines (8), MoHFW guidelines (4), and MedlinePlus topics (16).
* **Medication Safety Engine (`drug_module`)**:
  * Rule-based drug-drug interaction checker (8 clinical rules) and SIDER adverse effect profile lookups (20 drug profiles).
* **Prescription Extraction Engine (`prescription_module`)**:
  * Regex and rule-based entity extractor parsing drug name, dosage strength, form, frequency, route, and duration from free-text prescriptions.
* **Clinical Web Portal (`frontend`)**:
  * React 19 + Vite 8 + Tailwind CSS v4 portal with role-based navigation (Doctor, Patient, Pharmacist).
  * Doctor Dashboard featuring an interactive CDS Assistant card, quick clinical stats, and navigation.
  * Full conversational CDS Assistant (`CDSAssistant.jsx`) with Markdown streaming, source cards, and dynamic safety status banners.

---

## 3. What is Frozen?
**The RAG Core & Safety Backend is HARD FROZEN** (Baseline Commits `066f7a4` and `497a547`).
* **DO NOT MODIFY**:
  * FAISS vector index (2,204 chunks) and embedding configuration (`BAAI/bge-small-en`, 384D).
  * BM25 sparse index and RRF fusion ($k=60$).
  * Cross-encoder reranker weights and thresholds.
  * Evidence policy rules, entity isolation, and fail-closed abstention logic.
  * Deterministic answer grounding verifier contracts and claim extraction logic.
  * Pre-retrieval emergency triage and prompt-injection interception rules.
  * Golden regression archive (`data/indices/golden_236/`).

---

## 4. What is Currently Integrated?
* **Doctor UI $\to$ Live RAG API Integration**:
  * `frontend/src/api/ragApi.js` communicates directly with backend `POST /chat` on port 8000 using minimal `{ "query": "..." }` contract (with 90s CPU timeout support).
  * `frontend/src/pages/Common/CDSAssistant.jsx` renders live answers, citation cards, and dynamic safety status badges (`✓ VERIFIED CLINICAL EVIDENCE`, `⚠️ EVIDENCE POLICY ABSTENTION`, `🚨 EMERGENCY TRIAGE INTERCEPTED`, `🛡️ SECURITY BLOCK`).
  * Zero mock or hardcoded medical answers in `frontend/src`.
  * Demo clinician authentication flow (`doctor@medai.com` / `password123`) enabled for instant evaluation.

---

## 5. What Has Been Tested?
1. **Full Python RAG Regression Suite**:
   * Command: `python -m pytest rag_module/tests/ -v`
   * Result: **190 passed, 2 skipped** (offline fixtures), **0 failed** (100% passing).
2. **Frontend Production Build**:
   * Command: `cd frontend && npm run build`
   * Result: **Clean build in < 7s** (`dist/` generated with zero errors).
3. **Hard E2E 8-Query Field-by-Field Matrix**:
   * Metformin (Grounded), Ciprofloxacin (Withheld), Lipitor (Brand normalized $\to$ Withheld), Imaginaryzol (Abstained), Bleach Ingestion (Emergency diverted), Prompt Injection (Security blocked), Lisinopril Partial (Grounded), Lisinopril Dosage (Withheld).
   * Verified 100% fidelity between backend flags and rendered UI state.

---

## 6. What are the Current Metrics?
Evaluated on the frozen 100-query clinical benchmark:
* **Safety & Integrity**:
  * Emergency Triage Interception: **4/4 (100.0%)**
  * Prompt Injection Neutralization: **4/4 (100.0%)**
  * Out-of-Domain Rejection: **4/4 (100.0%)**
  * Unknown Entity Safe Abstention: **6/6 (100.0%)**
  * Unsupported Claim Leakage: **0 / 100 (0.0%)**
  * Hallucination Leakage: **0 / 100 (0.0%)**
  * Citation Validity: **156 / 156 (100.0%)**
* **Retrieval Performance** ($N=88$ evaluated non-diverted queries):
  * Recall@1: **51.14%** (45/88)
  * Recall@5: **54.55%** (48/88)
  * Recall@10: **54.55%** (48/88)
  * MRR: **0.5265**
* **Generation & Abstention Dynamics**:
  * Correct Abstention Rate: **100.0%** (18/18)
  * False Abstention Rate: **35.37%** (29/82, due to local TinyLlama preambles triggering fail-closed verifier interception).

---

## 7. What are the Known Limitations?
1. **Compact Local Generator (`TinyLlama-1.1B-Chat`)**:
   * Occasionally outputs conversational preambles (e.g., *"Based on the provided DailyMed text..."*), which the deterministic verifier flags as ungrounded, withholding the answer fail-closed.
2. **Reranker Cold-Start**:
   * `cross-encoder/ms-marco-MiniLM-L-6-v2` is lazy-loaded on the first query to preserve memory, causing an initial ~1.5s cold-start before settling to sub-second inference.
3. **Corpus Coverage**:
   * Active index contains 2,204 chunks covering high-priority primary care, cardiovascular, and endocrine medications. Queries regarding unindexed entities trigger safe policy abstentions.

---

## 8. What is the Immediate Next Task?
**Consolidate and merge `feature/rag-v2-foundation` into `main`**, then begin **Phase 2: CDS Platform Integration**:
1. **Task 1: Unified CDS Gateway**: Mount `drug_module` and `prescription_module` endpoints into a unified API router on port 8000.
2. **Task 2: Frontend Drug Checker Live Integration**: Wire `DrugChecker.jsx` to live drug interaction checking (`/check-interaction`) and side effects (`/check-side-effects`).
3. **Task 3: Prescription-to-Safety Workflow in CDS Assistant**: Enable free-text prescription parsing, automatic drug interaction screening, and 1-click clinical guideline RAG lookup.
