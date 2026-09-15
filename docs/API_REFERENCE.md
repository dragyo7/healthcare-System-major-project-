# API REFERENCE — HEALTHCARE MEDICAL RAG INTELLIGENCE

**Version**: `2.8.0`  
**Host**: `http://127.0.0.1:8000`  
**Interactive Documentation**: `http://127.0.0.1:8000/docs`  
**OpenAPI Specification**: `http://127.0.0.1:8000/openapi.json`

---

## 1. System Endpoints

### 1.1 `GET /health` / `GET /rag/health`
Returns system status, index statistics, active models, and readiness.

#### Response (`200 OK`):
```json
{
  "status": "healthy",
  "version": "2.8.0",
  "service_ready": true,
  "indexed_chunks_count": 236,
  "vector_index_size": 236,
  "bm25_corpus_size": 236,
  "models": {
    "embedding": "BAAI/bge-small-en",
    "embedding_dim": 384,
    "reranker": "cross-encoder/ms-marco-MiniLM-L-6-v2",
    "generator": "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
  },
  "safety_guardrails_enabled": true,
  "emergency_triage_enabled": true
}
```

---

### 1.2 `GET /ready` / `GET /rag/ready`
Lightweight readiness probe for container orchestrators and frontend boot checks.

#### Response (`200 OK`):
```json
{
  "status": "ready",
  "ready": true
}
```

---

## 2. Evidence Retrieval Endpoints

### 2.1 `POST /rag/query`
Canonical evidence retrieval and policy evaluation endpoint.

#### Request Body:
```json
{
  "query": "What are the contraindications for Metformin?",
  "mode": "hybrid",
  "top_k": 3,
  "source_filter": ["DailyMed", "ICMR"]
}
```

#### Request Fields:
- `query` (string, required, length 1-2000): Clinical question or drug name.
- `mode` (string, optional, default `"hybrid"`): `"dense"`, `"bm25"`, `"hybrid"`, `"hybrid_rerank"`.
- `top_k` (int, optional, default `5`, range `1-100`): Candidate chunks to return.
- `source_filter` (list of strings, optional): Filter by source (e.g. `["DailyMed"]`, `["ICMR"]`).
- `domain_filter` (list of strings, optional): Filter by domain (e.g. `["pharmacology"]`).
- `section_filter` (list of strings, optional): Filter by section (e.g. `["Contraindications"]`).

#### Response Body (`200 OK`):
```json
{
  "query": "What are the contraindications for Metformin?",
  "retrieval_mode": "hybrid",
  "total_evidence": 3,
  "evidence": [
    {
      "chunk_id": "dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_contraindications-c0",
      "document_id": "dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b",
      "title": "METFORMIN HYDROCHLORIDE tablet - CONTRAINDICATIONS",
      "section": "Contraindications",
      "source_id": "DailyMed",
      "source_name": "DailyMed FDA Structured Product Labels",
      "publisher": "U.S. National Library of Medicine",
      "source_url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4b2c1256-42d4-4a4b-8e2a-0a8870fb381b",
      "text": "Metformin hydrochloride tablets are contraindicated in patients with: Severe renal impairment (eGFR below 30 mL/min/1.73 m2). Known hypersensitivity to metformin hydrochloride. Acute or chronic metabolic acidosis...",
      "score": 0.01639,
      "dense_score": 0.8123,
      "bm25_score": 14.821
    }
  ],
  "context_text": "[1] (DailyMed FDA Structured Product Labels - METFORMIN HYDROCHLORIDE tablet...)...",
  "grounding": {
    "status": "grounded",
    "generation_allowed": true,
    "evidence_count": 3,
    "usable_evidence_count": 3,
    "accepted_chunk_ids": [
      "dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_contraindications-c0",
      "dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_boxed_warning-c0",
      "icmr_icmr_t2dm_2020_first_line-c0"
    ],
    "provenance_valid": true,
    "top_evidence_rank": 1,
    "evidence_sources": ["DailyMed", "ICMR"],
    "evidence_documents": ["dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b", "icmr_t2dm_2020"],
    "evidence_sections": ["Boxed Warning", "Contraindications", "First Line Management"],
    "reason_codes": ["EVIDENCE_SUFFICIENT"],
    "warnings": [],
    "conflict_detected": false,
    "conflict_summary": null,
    "policy_latency_ms": 1.25
  },
  "citations": [
    {
      "source_index": 1,
      "title": "METFORMIN HYDROCHLORIDE tablet - CONTRAINDICATIONS",
      "source_name": "DailyMed FDA Structured Product Labels",
      "publisher": "U.S. National Library of Medicine",
      "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4b2c1256-42d4-4a4b-8e2a-0a8870fb381b",
      "chunk_id": "dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_contraindications-c0",
      "qtype": "Contraindications",
      "score": 0.01639
    }
  ],
  "latency_ms": 28.4
}
```

---

### 2.2 `POST /retrieve`
Backward-compatible evidence retrieval endpoint returning identical `RAGQueryResponse` payload.

---

## 3. Conversational Clinical Chat

### 3.1 `POST /chat`
Conversational clinical decision-support endpoint.

#### Request Body:
```json
{
  "message": "What are the contraindications for Metformin?",
  "mode": "hybrid",
  "top_k": 3,
  "generate_answer": true
}
```

#### Response Body (`200 OK`):
```json
{
  "question": "What are the contraindications for Metformin?",
  "answer": "Based on FDA DailyMed official product labeling, Metformin hydrochloride is strictly contraindicated in patients with severe renal impairment (eGFR < 30 mL/min/1.73 m²), known hypersensitivity to metformin, and acute or chronic metabolic acidosis (including diabetic ketoacidosis).\n\n*Clinical Disclaimer: This healthcare AI assistant is an educational Major Project prototype...*",
  "is_emergency": false,
  "abstained": false,
  "sources": [
    {
      "source_index": 1,
      "title": "METFORMIN HYDROCHLORIDE tablet - CONTRAINDICATIONS",
      "source_name": "DailyMed FDA Structured Product Labels",
      "publisher": "U.S. National Library of Medicine",
      "url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4b2c1256-42d4-4a4b-8e2a-0a8870fb381b",
      "chunk_id": "dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_contraindications-c0",
      "qtype": "Contraindications",
      "score": 0.01639
    }
  ],
  "retrieved_chunks_count": 3,
  "pipeline_mode": "hybrid"
}
```

---

## 4. Diagnostic Trace Endpoint

### 4.1 `POST /rag/trace` / `POST /debug/rag/trace`
Forensic diagnostic pipeline tracer.

#### Request Body:
```json
{
  "query": "What are the boxed warnings for Lisinopril?",
  "top_k": 3
}
```

#### Response Body (`200 OK`):
```json
{
  "query": "What are the boxed warnings for Lisinopril?",
  "safety": {
    "is_emergency": false,
    "risk_category": "informational",
    "emergency_protocol": null
  },
  "embedding": {
    "model": "BAAI/bge-small-en",
    "dimension": 384,
    "normalized": true,
    "l2_norm": 1.0000
  },
  "dense_results": [
    {
      "rank": 1,
      "chunk_id": "dailymed_7823f03b-18a8-48b6-9bb2-16a7f0521e29_boxed_warning-c0",
      "title": "LISINOPRIL tablet - BOXED WARNING",
      "section": "Boxed Warning",
      "source_id": "DailyMed",
      "dense_score": 0.8842
    }
  ],
  "bm25_results": [
    {
      "rank": 1,
      "chunk_id": "dailymed_7823f03b-18a8-48b6-9bb2-16a7f0521e29_boxed_warning-c0",
      "bm25_score": 18.24
    }
  ],
  "rrf_results": [
    {
      "rank": 1,
      "chunk_id": "dailymed_7823f03b-18a8-48b6-9bb2-16a7f0521e29_boxed_warning-c0",
      "fused_score": 0.0328,
      "dense_rank": 1,
      "bm25_rank": 1
    }
  ],
  "reranked_results": [
    {
      "rank": 1,
      "chunk_id": "dailymed_7823f03b-18a8-48b6-9bb2-16a7f0521e29_boxed_warning-c0",
      "rerank_score": 6.8421
    }
  ],
  "grounding": {
    "status": "grounded",
    "generation_allowed": true,
    "accepted_chunk_ids": ["dailymed_7823f03b-18a8-48b6-9bb2-16a7f0521e29_boxed_warning-c0"]
  },
  "final_answer": "...",
  "citations": [...]
}
```
