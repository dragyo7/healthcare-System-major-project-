# RED FLAG REGISTER & FORENSIC ISSUE TRACKER

**System**: Healthcare Clinical Decision Support RAG Prototype  
**Auditor**: Independent Senior Forensic QA Engineer  
**Date**: September 15, 2026  

---

## 1. Resolved Red Flags

### RF-01: Dense Embedding Model Identifier Inconsistency
- **Subsystem**: Vector Embedding & Index Pipeline (`rag_module/embeddings/`, `rag_module/data/faiss_index/`)
- **Observation**: Earlier documentation claimed the dense bi-encoder was `sentence-transformers/all-MiniLM-L6-v2`.
- **Forensic Investigation**: Direct mathematical comparison of reconstructed vectors from `index_v2.bin` against re-encoded text showed an $L_2$ difference of **1.320** with MiniLM, but exact floating-point identity ($L_2 \le 10^{-6}$, $\text{Cos Sim} = 1.000000$) with `BAAI/bge-small-en`.
- **Root Cause**: Reranker model (`cross-encoder/ms-marco-MiniLM-L-6-v2`) was conflated in prose with the bi-encoder embedding model (`BAAI/bge-small-en`).
- **Resolution**: Updated all configuration references, manifests, and documentation to accurately state `BAAI/bge-small-en` (384D, unit normalized).
- **Status**: **RESOLVED & MATHEMATICALLY PROVEN**

---

### RF-02: Fictitious Entity Injection Vulnerability (Cardioregulin)
- **Subsystem**: Evidence Policy & Grounding Decision Engine (`rag_module/safety/evidence_policy.py`, `rag_module/api.py`)
- **Observation**: Queries mentioning non-existent drugs (`Cardioregulin`) with generic medical keywords (`dosage`, `severe heart failure`) matched indexed heart failure passages for Metoprolol and Lisinopril, passed global token-overlap checks, and caused the LLM to fabricate dosages for the fake drug.
- **Root Cause**: The lexical overlap check did not separate named clinical subject entities from general clinical vocabulary terms.
- **Resolution**: 
  1. Implemented clinical subject entity extraction and presence verification in `EvidencePolicyEngine.evaluate_evidence()`.
  2. Assigned `GroundingReasonCode.UNSUPPORTED_ENTITY` and forced `generation_allowed = False` when subject entities are absent from retrieved evidence.
  3. Routed `/chat` through `RAGService.retrieve()` to enforce deterministic evidence policy gating before generation.
- **Verification**: Retested on live `/rag/query` and `/chat` across 5 positive and negative controls. All fake drug queries are strictly refused with zero citations.
- **Status**: **RESOLVED & VERIFIED LIVE**

---

### RF-03: Score Monotonicity Inconsistency After Reranking
- **Subsystem**: Service Orchestration & Evidence Formatting (`rag_module/service.py`)
- **Observation**: Candidate chunks were sorted by cross-encoder score, but `EvidenceItem.score` retained pre-reranked `fused_score`, creating a display ordering anomaly where lower-ranked chunks appeared with higher numerical scores.
- **Root Cause**: `score` field was populated from `fused_score` rather than `rerank_score`.
- **Resolution**: Added `rerank_score` attribute to `EvidenceItem` and mapped `item.score` to `rerank_score` whenever the cross-encoder is active.
- **Status**: **RESOLVED & VERIFIED**

---

### RF-04: Generator Context Isolation Leakage Risk
- **Subsystem**: Context Builder & Evidence Policy Integration (`rag_module/service.py`)
- **Observation**: Context was previously sliced from top candidate chunks without explicitly filtering against verified chunk IDs.
- **Root Cause**: Lack of explicit accepted ID filtering in context formatting.
- **Resolution**: Added `accepted_chunk_ids: List[str]` to `GroundingDecision` and filtered context strictly by `accepted_chunk_ids`.
- **Status**: **RESOLVED & VERIFIED**

---

## 2. Documented Operational Caveats & Accepted Boundaries

| ID | Component | Operational Boundary / Limitation | Safe Handling Strategy |
|---|---|---|---|
| **AC-01** | Morphological Stemming | Exact and 5-character prefix matching is used for entity presence. Highly irregular plurals or obscure abbreviations might require exact dictionary match. | RxNorm dictionary normalization provides alias resolution for known clinical brand/generic concepts. |
| **AC-02** | Lexical Medical Synonyms | Questions using informal colloquialisms (e.g., "kidney issue" vs "renal impairment") may have lower lexical overlap and trigger conservative abstention. | Fail-closed behavior guarantees patient safety; clinicians/users are prompted to rephrase with standard clinical terms. |
