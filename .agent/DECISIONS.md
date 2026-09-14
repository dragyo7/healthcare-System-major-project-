# ARCHITECTURAL DECISIONS & DESIGN RATIONALE

This document records the durable architectural decisions governing the healthcare platform and RAG intelligence layer.

---

## 1. Modular Source-Adapter Architecture
* **Decision**: Implement a decoupled `BaseSourceAdapter` and `SourceRegistry` pattern where each medical knowledge source possesses a dedicated ingestion adapter.
* **Rationale**: Medical data arrives in incompatible formats (DailyMed XML, openFDA JSON, MedQuAD XML/JSON, clinical PDF guidelines). Tightly coupling ingestion to the retrieval engine forces risky code rewrites whenever a new source is added.
* **Current Status**: **Active & Validated** across MedQuAD, DailyMed, openFDA, and Guideline adapters.
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
* **Rationale**: The project corpus ($\sim 25,000$ chunks) easily fits in memory. Local FAISS eliminates external cloud network latency, authentication dependencies, recurring API costs, and security exposure of clinical queries.
* **Current Status**: **Active & Validated** (exact cosine similarity with normalized embeddings).
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
* **Decision**: Design the Cross-Encoder reranker (`BAAI/bge-reranker-small`) as a non-blocking optional component with automatic pass-through fallback.
* **Rationale**: Rerankers are computationally heavy on CPU and may fail to load in resource-constrained offline testing environments. If remote model weights are unavailable, the system must degrade gracefully without crashing.
* **Current Status**: **Active in Fallback Mode** (`FALLBACK / NOT EXECUTED`).
* **Tradeoff**: Loses minor potential precision boosts from deep cross-attention when weights are absent.

---

## 7. Separation of RAG Evidence from Deterministic Safety Logic
* **Decision**: Treat RAG as an *evidence retrieval and context presentation engine*, while keeping prescription entity extraction and safety limits in deterministic rule-based modules.
* **Rationale**: LLMs are probabilistic and susceptible to subtle hallucinations. Critical prescription parameters (maximum daily dosage, contraindications) must not depend solely on unconstrained generative language generation.
* **Current Status**: **Active & Enforced**.
* **Tradeoff**: Requires separate pipelines for deterministic parsing and semantic search.

---

## 8. Evidence-Based Benchmark Rigor & Grounding
* **Decision**: Mandate that all benchmark evaluations use unambiguous gold standard evidence mappings (`expected_document_id`, `expected_drug`, `expected_sections`) rather than loose keyword/topic substring heuristics.
* **Rationale**: Forensic audit V2.2 proved that loose keyword heuristics artificially inflated early benchmark recall to 100%. Rigorous medical evaluation requires exact section-level and document-level attribution.
* **Current Status**: **Active & Validated** in `pharmacology_benchmark.json`.
* **Tradeoff**: Benchmark construction requires detailed clinical curation.

---

## 9. Deterministic Evidence Policy & Safe Abstention Boundary (V2.8)
* **Decision**: Enforce a deterministic `EvidencePolicyEngine` and typed `GroundingDecision` contract (`GROUNDED`, `WEAK_EVIDENCE`, `INSUFFICIENT_EVIDENCE`, `CONFLICTING_EVIDENCE`) rather than uncalibrated probabilistic confidence scores or direct generation pass-through.
* **Rationale**: Vector similarity scores reflect dense semantic proximity, NOT clinical truth or factual adequacy. In high-stakes healthcare AI, the system must deterministically abstain (`generation_allowed = False`) with machine-readable reason codes when retrieved evidence is absent, out-of-domain, or contradictory.
* **Current Status**: **Active & Validated** in `rag_module/safety/evidence_policy.py`.
* **Tradeoff**: Restricts ungrounded generative responses, intentionally refusing to answer queries that lack sufficient verified evidence.

---

## 10. Strict Provenance Audit & Zero Metadata Fabrication (V2.8)
* **Decision**: Mandate 9-field provenance validation (`source_id`, `source_name`, `publisher`, `document_id`, `chunk_id`, `title`, `section`, `medical_domain`, `source_url`) via `ProvenanceValidator` and strictly prohibit synthetic fabrication of missing clinical metadata.
* **Rationale**: Clinical citations must be legally and medically auditable. If a document lacks publisher or document identity, it must be flagged as `PARTIALLY_IDENTIFIED` or `INVALID` rather than having plausible fake identifiers generated by code.
* **Current Status**: **Active & Validated** in `rag_module/safety/provenance_validator.py`.
* **Tradeoff**: Legacy or incomplete data sources cannot be used until proper metadata adapters are authored.
