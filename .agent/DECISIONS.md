# ARCHITECTURAL DECISIONS & DESIGN RATIONALE

This document records the durable architectural decisions governing the healthcare platform and RAG intelligence layer.

---

## 1. Modular Source-Adapter Architecture
* **Decision**: Implement a decoupled `BaseSourceAdapter` and `SourceRegistry` pattern where each medical knowledge source possesses a dedicated ingestion adapter.
* **Rationale**: Medical data arrives in incompatible formats (DailyMed XML, openFDA JSON, MedQuAD XML/JSON, clinical PDF guidelines). Tightly coupling ingestion to the retrieval engine forces risky code rewrites whenever a new source is added.
* **Current Status**: **Implemented & Validated**. Decoupled adapters exist for MedQuAD, DailyMed, openFDA, and Clinical Guidelines.
* **Production Corpus Distinction**: The *currently active production corpus* contains **2,204 chunks** primarily sourced from DailyMed (2,176 chunks), ICMR (8 chunks), MoHFW (4 chunks), and MedlinePlus (16 chunks). The existence of an adapter (e.g. openFDA, MedQuAD) does not mean it is loaded into the production vector index unless indexed.
* **Tradeoff**: Introduces an abstraction layer and explicit normalization step before chunking.

---

## 2. Canonical Knowledge Document & Chunk Data Contracts
* **Decision**: Enforce strict `KnowledgeDocument` and `KnowledgeChunk` dataclasses with mandatory provenance fields (`source_id`, `document_id`, `publisher`, `source_url`, `document_type`, `medical_domain`, `section`, `content_hash`).
* **Rationale**: Clinical citations cannot rely on unstructured raw text. Preserving source attribution and section labels directly inside the chunk contract allows downstream filters, citation builders, and audit logs to verify evidence origins deterministically.
* **Current Status**: **Active & Validated** throughout the pipeline.
* **Tradeoff**: Requires all legacy datasets to be normalized into the standard schema.

---

## 3. Retaining Local FAISS Index (Avoiding Premature Cloud Vector DBs)
* **Decision**: Retain local in-memory/disk `faiss.IndexFlatIP` rather than adopting managed external vector databases (e.g., Pinecone, Qdrant, Milvus).
* **Rationale**: The production corpus (2,204 chunks) easily fits in memory. Local FAISS eliminates external cloud network latency, authentication dependencies, recurring API costs, and security exposure of clinical queries.
* **Current Status**: **Active & Validated** (exact cosine similarity with normalized embeddings, 384 dimensions).
* **Tradeoff**: Distributed horizontal sharding is deferred until the corpus scales beyond millions of vectors.

---

## 4. Dual-Index Hybrid Retrieval (BGE Dense + BM25 Lexical)
* **Decision**: Pair dense semantic vector search (`BAAI/bge-small-en`) with an exact lexical inverted index (`BM25Okapi`).
* **Rationale**: Dense embeddings excel at conceptual medical understanding (e.g., matching *"kidney damage"* to *"renal impairment"*), but frequently struggle with exact drug brand names, numerical dosages (e.g., *"10 mg"* vs *"40 mg"*), NDC codes, and acronyms. BM25 guarantees high-precision keyword retrieval for clinical entities.
* **Current Status**: **Active & Validated**.
* **Tradeoff**: Requires maintaining and serializing two distinct indexes.

---

## 5. Reciprocal Rank Fusion (RRF) for Hybrid Merging
* **Decision**: Combine ranked candidate lists using Reciprocal Rank Fusion ($k=60$) rather than raw score addition or arbitrary linear weighting.
* **Rationale**: Cosine similarity scores and BM25 scores have incompatible scales and distributions. RRF relies strictly on relative ordinal rank positions, making it robust against uncalibrated score variations across heterogeneous queries.
* **Current Status**: **Active & Validated**.
* **Tradeoff**: Does not account for extreme score margins between adjacent ranks.

---

## 6. Optional / Fallback-Safe Cross-Encoder Reranking
* **Decision**: Deploy `cross-encoder/ms-marco-MiniLM-L-6-v2` as a second-stage reranker with lazy-loading and automatic pass-through fallback.
* **Rationale**: Cross-encoder models compute deep token-level cross-attention across (query, chunk) pairs, substantially refining top-k precision. To optimize memory on local workstations, the model is lazy-loaded on the first inference request. If model weights fail to load, the system degrades gracefully to RRF pass-through ranking without crashing.
* **Current Status**: **Active & Verified**. Loads `cross-encoder/ms-marco-MiniLM-L-6-v2` on first query, computes relevance logits, and reorders candidates.
* **Tradeoff**: Slightly increases initial inference latency (~0.8s cold start) on first call.

---

## 7. Separation of RAG Evidence from Deterministic Safety Logic
* **Decision**: Treat RAG as an *evidence retrieval and context presentation engine*, while keeping prescription entity extraction and safety limits in deterministic rule-based modules.
* **Rationale**: LLMs are probabilistic and susceptible to subtle hallucinations. Critical prescription parameters (maximum daily dosage, contraindications) must not depend solely on unconstrained generative language generation.
* **Current Status**: **Active & Enforced**.
* **Tradeoff**: Requires separate pipelines for deterministic parsing and semantic search.

---

## 8. Deterministic Evidence Policy & Safe Abstention Boundary (V2.8)
* **Decision**: Enforce a deterministic `EvidencePolicyEngine` and typed `GroundingDecision` contract (`GROUNDED`, `WEAK_EVIDENCE`, `INSUFFICIENT_EVIDENCE`, `CONFLICTING_EVIDENCE`) rather than uncalibrated probabilistic confidence scores or direct generation pass-through.
* **Rationale**: Vector similarity scores reflect dense semantic proximity, NOT clinical truth or factual adequacy. In high-stakes healthcare AI, the system must deterministically abstain (`generation_allowed = False`) with machine-readable reason codes when retrieved evidence is absent, out-of-domain, or contradictory.
* **Current Status**: **Active & Validated** in `rag_module/safety/evidence_policy.py`.
* **Tradeoff**: Restricts ungrounded generative responses, intentionally refusing to answer queries that lack sufficient verified evidence.

---

## 9. Strict Provenance Audit & Zero Metadata Fabrication (V2.8)
* **Decision**: Mandate 9-field provenance validation (`source_id`, `source_name`, `publisher`, `document_id`, `chunk_id`, `title`, `section`, `medical_domain`, `source_url`) via `ProvenanceValidator` and strictly prohibit synthetic fabrication of missing clinical metadata.
* **Rationale**: Clinical citations must be legally and medically auditable. If a document lacks publisher or document identity, it must be flagged as `PARTIALLY_IDENTIFIED` or `INVALID` rather than having plausible fake identifiers generated by code.
* **Current Status**: **Active & Validated** in `rag_module/safety/provenance_validator.py`.
* **Tradeoff**: Legacy or incomplete data sources cannot be used until proper metadata adapters are authored.

---

## 10. Production Corpus Isolation & 236 Golden Regression Preservation (Phase 24/25)
* **Decision**: Isolate the expanded 2,204 production corpus (`data/normalized/expanded_production_chunks.json`) while permanently maintaining the 236-chunk golden baseline (`data/indices/index_v2.bin`, `meta_v2.json`, `bm25_index.pkl`) as an unalterable regression test fixture.
* **Rationale**: Scaling knowledge must never silently break known baseline behavior. Preserving the 236-chunk golden baseline with exact cryptographic hash locks guarantees backwards-compatible regression testing across all model and pipeline iterations.
* **Current Status**: **Active & Verified**.

---

## 11. Dual-Pipeline Evidence Policy & Safety Unification (Phase 25)
* **Decision**: Unify safety triage (`QuerySafetyEngine`) and deterministic evidence policy grounding (`EvidencePolicyEngine`) across both `RAGService` and `MedicalRAGPipeline`.
* **Rationale**: Both direct query execution (`rag_pipeline.query()`) and service-layer orchestration (`RAGService.retrieve()`) must enforce identical fail-closed abstention rules (`generation_allowed = False`) when unsupported entities (e.g. Cardioregulin, Zorblaxian fever) or out-of-domain queries are encountered.
* **Current Status**: **Active & Verified** (110 passed pytest tests).

---

## 12. Model & Index Cryptographic Hash Lock Manifest (Phase 25)
* **Decision**: Enforce an explicit machine-readable model and index manifest (`data/manifests/model_index_lock.json`) recording exact model ID (`BAAI/bge-small-en`), dimension (384), normalization (L2), query prefix, metric (inner product), and SHA-256 digests of all serialized index files.
* **Rationale**: Prevents silent runtime index corruption or incompatible embedding model substitutions.
* **Current Status**: **Active & Locked**.

---

## 13. Frontend Architecture, Modular Adapters & Browser E2E Integration (Phase 26)
* **Decision**: Architect the React frontend with decoupled API services (`ragApi.js`), clean modular boundaries (`frontend/src/modules/` for multilingual, registry, and OCR adapters), and first-class Clinical Decision Support (CDS) Assistant interfaces (`CDSAssistant.jsx`, `DrugChecker.jsx`).
* **Rationale**: Decoupling the UI presentation layer from the RAG retrieval core allows future modules (neural machine translation, document OCR, drug interaction calculators) to be integrated as clean adapters without modifying the underlying retrieval, reranking, or evidence policy core.
* **Current Status**: **Active & Verified** via real browser end-to-end testing and OpenAPI contract synchronization.
