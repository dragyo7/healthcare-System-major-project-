# TRUST MATRIX & COMPONENT VERIFICATION LEVELS

**System**: Healthcare Clinical Decision Support RAG Prototype  
**Auditor**: Senior Independent Forensic Auditor  
**Date**: September 15, 2026  

---

| Subsystem / Component | Trust Level | Concrete Proof Reference |
|---|---|---|
| **Source Authenticity** | **VERIFIED** | Direct URLs to DailyMed SPL, ICMR, MoHFW, NLM portals. |
| **Dataset Provenance** | **VERIFIED** | 236 documents $\to$ 236 chunks in `meta_v2.json` and `manifest.json`. |
| **Chunking Architecture** | **VERIFIED** | Intact clinical assertions, mean 30.53 words, zero sentence fragmentation. |
| **Embeddings** | **VERIFIED** | `BAAI/bge-small-en` (384D, unit normalized) exact vector match ($L_2 \le 10^{-6}$). |
| **FAISS Vector Index** | **VERIFIED** | `IndexFlatIP` (236 vectors, 384D, cosine distance via inner product). |
| **BM25 Lexical Index** | **VERIFIED** | `BM25Okapi` over 236 tokenized documents with zero-match fallback. |
| **Hybrid RRF** | **VERIFIED** | $k=60$ reciprocal rank fusion formula verified mathematically to 6 decimal places. |
| **Cross-Encoder Reranker**| **VERIFIED** | `cross-encoder/ms-marco-MiniLM-L-6-v2` lifts MRR from 0.850 to 0.875. |
| **Evidence Policy & Gating**| **VERIFIED** | Enforces provenance, minimum score floors, and conflict scanning. |
| **Entity Grounding Gate** | **VERIFIED** | Blocks non-existent entities (`Cardioregulin`, `UnknownDrugXYZ`) from generation. |
| **Context Isolation** | **VERIFIED** | Generator context filtered strictly by `accepted_chunk_ids`. |
| **Citation Attribution** | **VERIFIED** | Citations map 1:1 to accepted evidence chunks and official URLs. |
| **Generator (LLM)** | **VERIFIED WITH LIMITATION** | Local CPU TinyLlama-1.1B or Gemini API operates strictly over isolated context. |
| **`/rag/query` Endpoint** | **VERIFIED** | Full structural evidence, provenance status, and grounding reason codes returned. |
| **`/chat` Endpoint** | **VERIFIED** | Unified with RAGService, returns grounded synthesis or safe clinical abstention. |
| **Emergency Triage** | **VERIFIED** | Intercepts cardiac, stroke, and breathing emergencies prior to RAG execution. |
| **Out-of-Domain Guard** | **VERIFIED** | Blocks non-medical queries with `OUT_OF_DOMAIN` reason code. |
| **Failure Handling** | **VERIFIED** | Fails closed on missing or corrupted indexes without fabricating clinical text. |
| **API Contract & Swagger** | **VERIFIED** | Tested live against OpenAPI 2.8.0 specification and browser Swagger UI. |
| **Automated Test Suite** | **VERIFIED** | 110 passed, 2 skipped in `pytest rag_module/tests/` (60.63s). |
