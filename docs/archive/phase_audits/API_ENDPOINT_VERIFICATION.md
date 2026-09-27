# API ENDPOINT VERIFICATION MATRIX (PHASE 21)

This document provides the verified API contract, schemas, and live test outcomes for all endpoints on the running backend server (`http://127.0.0.1:8000`).

---

## 1. Endpoint Reference & Verification

### 1. GET `/health` & GET `/ready`
- **Method**: `GET`
- **Request**: No body
- **Expected Response**:
  ```json
  {
    "status": "healthy",
    "version": "2.8.0",
    "service_ready": true,
    "index_ready": true,
    "indexed_chunks_count": 236,
    "embedding_model": "BAAI/bge-small-en",
    "dense_ready": true,
    "bm25_ready": true,
    "hybrid_ready": true,
    "reranker_status": "fallback_pass_through"
  }
  ```
- **Live Status**: `200 OK`

---

### 2. POST `/rag/query`
- **Method**: `POST`
- **Request Schema**:
  ```json
  {
    "query": "string (min_length=1)",
    "mode": "dense | bm25 | hybrid | hybrid_rerank",
    "top_k": 5
  }
  ```
- **Response Fields to Inspect**:
  - `total_evidence`: count of candidate evidence chunks
  - `evidence`: ranked list of structured `EvidenceItem` objects with provenance URLs and monotonic scores
  - `grounding.status`: `grounded | weak_evidence | insufficient_evidence | conflicting_evidence`
  - `grounding.generation_allowed`: `true | false`
  - `grounding.accepted_chunk_ids`: list of chunk IDs authorized for context
  - `grounding.reason_codes`: e.g. `["EVIDENCE_SUFFICIENT"]` or `["UNSUPPORTED_ENTITY"]`
- **Live Status**: `200 OK`

---

### 3. POST `/chat`
- **Method**: `POST`
- **Request Schema**:
  ```json
  {
    "query": "string",
    "mode": "hybrid",
    "generate_answer": true,
    "top_k": 5
  }
  ```
- **Response Fields to Inspect**:
  - `answer`: grounded synthesis with clinical disclaimer or refusal message
  - `is_emergency`: boolean (triggers emergency triage)
  - `abstained`: boolean (true if insufficient evidence / unsupported entity)
  - `sources`: list of citation records with publisher, title, and URL
- **Live Status**: `200 OK`

---

### 4. POST `/debug/rag/trace` & POST `/rag/trace`
- **Method**: `POST`
- **Request Schema**:
  ```json
  {
    "query": "string",
    "top_k": 5
  }
  ```
- **Response Structure**:
  - `safety`: triage evaluation
  - `embedding`: model name, dimension (384), L2-norm
  - `dense_results`: FAISS cosine ranks and scores
  - `bm25_results`: BM25 lexical ranks and scores
  - `rrf_results`: Reciprocal rank fusion fused scores
  - `reranked_results`: Cross-encoder scores
  - `provenance`: publisher verification summary
  - `grounding`: status, accepted chunk IDs, reason codes
  - `final_answer`: generated response
  - `citations`: list of grounded citation links
- **Live Status**: `200 OK`
