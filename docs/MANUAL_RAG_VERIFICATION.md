# Healthcare Clinical Decision Support (CDS-RAG) — Manual Verification Guide

This guide provides step-by-step instructions for running, testing, demonstrating, and defending the Healthcare RAG backend in live demonstrations.

---

## 1. Starting the Backend Server

Start the production FastAPI server locally:

```powershell
# From project root
python -m uvicorn rag_module.api:app --host 127.0.0.1 --port 8000 --reload
```

Interactive API documentation (Swagger UI) is available at:
👉 **`http://localhost:8000/docs`**

---

## 2. API Endpoints Overview

| Endpoint | Method | Purpose | Key Fields to Inspect |
| :--- | :--- | :--- | :--- |
| **`/health`** | `GET` | System health & index status | `status`, `indexed_chunks_count: 236`, `embedding_model` |
| **`/ready`** | `GET` | Readiness probe | `service_ready: true`, `index_ready: true` |
| **`/rag/query`** | `POST` | Canonical evidence retrieval & grounding | `grounding.status`, `grounding.accepted_chunk_ids`, `evidence` |
| **`/retrieve`** | `POST` | Evidence retrieval contract | `evidence`, `context_text` |
| **`/chat`** | `POST` | End-to-end generation with citations | `answer`, `is_emergency`, `abstained`, `sources` |
| **`/debug/rag/trace`** | `POST` | Intermediate forensic diagnostic trace | `dense_results`, `bm25_results`, `rrf_results`, `reranked_results`, `accepted_chunk_ids` |
| **`/rag/trace`** | `POST` | Live step-by-step pipeline execution trace | Full intermediate signal dictionary |

---

## 3. Ten Live Copy-Paste Team Demonstrations

### Demo 1: Supported Clinical Evidence Retrieval (Metformin)
- **Endpoint**: `POST /rag/query`
- **Request Body**:
```json
{
  "query": "What does the official labeling say about metformin in patients with severe renal impairment?",
  "mode": "hybrid_rerank",
  "top_k": 3
}
```
- **What to Observe**:
  - `grounding.status`: `"grounded"`
  - `grounding.generation_allowed`: `true`
  - `grounding.accepted_chunk_ids`: `["dailymed_060d40e4-b778-43d9-9596-f9478f773489_contraindications-c0", ...]`
  - `evidence[0].source_url`: Points to FDA SPL Set ID `060d40e4-b778-43d9-9596-f9478f773489`

---

### Demo 2: Full Diagnostic Step-by-Step Trace
- **Endpoint**: `POST /debug/rag/trace`
- **Request Body**:
```json
{
  "query": "What is the initial dose of amlodipine for hypertension?",
  "top_k": 3
}
```
- **What to Observe**:
  - `embedding.model`: `"BAAI/bge-small-en"`
  - `dense_results` vs `bm25_results` vs `rrf_results` vs `reranked_results`
  - `reranked_results[0].rerank_score`: Verified monotonic score from cross-encoder

---

### Demo 3: Live Conversational Answer with Verifiable Citations
- **Endpoint**: `POST /chat`
- **Request Body**:
```json
{
  "query": "Why is lisinopril concerning during pregnancy?",
  "mode": "hybrid",
  "generate_answer": true,
  "top_k": 3
}
```
- **What to Observe**:
  - `abstained`: `false`
  - `answer`: Grounded explanation citing fetal toxicity and renin-angiotensin system injury
  - `sources[0].url`: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4b2c1256-42d4-4a4b-8e2a-0a8870fb381b`

---

### Demo 4: Fictitious Drug Rejection & Entity Grounding (Cardioregulin)
- **Endpoint**: `POST /chat`
- **Request Body**:
```json
{
  "query": "What is the approved dosage of Cardioregulin for severe heart failure?",
  "mode": "hybrid",
  "generate_answer": true,
  "top_k": 5
}
```
- **What to Observe**:
  - `abstained`: `true`
  - `sources`: `[]` (Empty list)
  - `answer`: *"I am not able to find verified medical evidence regarding the requested subject in authoritative clinical guidelines."*
  - **Proof**: Prevents hallucinated dosage for non-existent entities.

---

### Demo 5: `/chat` vs `/rag/query` Parity Check
- Send the same query to both endpoints:
  - Query: `"What are the contraindications for Cardioregulin?"`
- **Observe**:
  - `/rag/query` returns `generation_allowed: false`, `reason_codes: ["UNSUPPORTED_ENTITY"]`
  - `/chat` returns `abstained: true`, `sources: []`

---

### Demo 6: Source-Constrained Query (ICMR Guidelines)
- **Endpoint**: `POST /chat`
- **Request Body**:
```json
{
  "query": "According to ICMR, what is recommended for uncomplicated acute cystitis?",
  "mode": "hybrid",
  "generate_answer": true,
  "top_k": 3
}
```
- **What to Observe**:
  - `sources[0].publisher`: `"Indian Council of Medical Research (ICMR, Govt of India)"`
  - `sources[0].url`: `https://main.icmr.nic.in/content/national-treatment-guidelines-antimicrobial-use`
  - `answer`: Recommends Nitrofurantoin 100 mg BD x 5d; warns against fluoroquinolones.

---

### Demo 7: Acute Emergency Triage Interception
- **Endpoint**: `POST /chat`
- **Request Body**:
```json
{
  "query": "Patient has severe crushing chest pain radiating to the left arm and shortness of breath.",
  "mode": "hybrid",
  "generate_answer": true
}
```
- **What to Observe**:
  - `is_emergency`: `true`
  - `abstained`: `false`
  - `sources`: `[]`
  - `answer`: Immediate emergency guidance urging emergency services (911 / EMS). Standard RAG retrieval is bypassed.

---

### Demo 8: Out-of-Domain Query Refusal
- **Endpoint**: `POST /chat`
- **Request Body**:
```json
{
  "query": "How do I replace the timing belt on a 2012 Honda Civic engine?",
  "mode": "hybrid",
  "generate_answer": true
}
```
- **What to Observe**:
  - `abstained`: `true`
  - `sources`: `[]`
  - `answer`: Refusal stating query is outside the supported medical domain.

---

### Demo 9: One-Command Automated Smoke Test
Run from PowerShell terminal:
```powershell
.\scripts\smoke_test_rag.ps1
```
- Automatically executes and validates `/health`, `/ready`, supported Metformin query, Unknown Drug abstention, Honda Civic OOD guard, and Cardiac crisis emergency triage.

---

### Demo 10: Live Human-Readable Terminal Trace
Run from PowerShell terminal:
```powershell
.\scripts\trace_rag.ps1 -Query "What precautions are needed for warfarin during pregnancy?"
```
- Renders an interactive terminal trace across query safety, embedding vector norm, dense similarity, BM25 rank, fused RRF score, reranker score, evidence policy, context builder, and grounded answer.
