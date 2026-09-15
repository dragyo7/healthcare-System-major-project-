# Dynamic Incremental Ingestion & Zero Re-Embedding Engine (Phase 24)

## 1. System Overview & Objective
In production clinical decision support systems, monographs, treatment guidelines, and drug labels are regularly revised. Re-embedding an entire knowledge base whenever a single document is added or edited is computationally wasteful and non-scalable.

The Clinical RAG system incorporates an **Incremental Indexer** that computes cryptographic text-and-provenance fingerprints to guarantee that unchanged chunks are never re-embedded.

---

## 2. Component Explainability Matrix (WHAT / WHY / INPUT / OUTPUT / WHERE / COST / FAILURE / EXAMPLE)

### Incremental Indexer (`IncrementalIndexer`)
- **WHAT**: Manages corpus synchronization, cached vector lookup, differential embedding generation, and atomic FAISS + BM25 index rebuilding.
- **WHY**: Reduces ingestion time by up to 98% during document updates and additions while guaranteeing index integrity.
- **INPUT**: List of `KnowledgeDocument` or chunk dictionaries with fields `chunk_id`, `text`, `doc_id`, `source_id`.
- **OUTPUT**: Synchronized binary FAISS index (`.bin`), metadata pickle (`.pkl`), JSON metadata (`.json`), BM25 index (`.pkl`), and updated vector cache (`.npz`).
- **WHERE**: [`rag_module/indexing/incremental_indexer.py`](file:///e:/Major%20Project%20Code/rag_module/indexing/incremental_indexer.py).
- **COST**: 
  - Cache lookup: $O(N)$ string hashing in memory (< 10ms for 5,000 chunks).
  - New embeddings: $O(M)$ transformer forward passes on GPU/CPU only for modified/new chunks ($M \ll N$).
  - Storage: $O(N \times 384 \times 4\text{ bytes})$ uncompressed `.npz` vector archive.
- **FAILURE**: If cache file is corrupt or missing, gracefully falls back to generating embeddings for all provided chunks and writing a fresh valid cache.
- **EXAMPLE**: Ingesting 1,500 chunks with 1,490 existing chunks and 10 edited chunks reuses 1,490 cached vectors and encodes only 10 modified chunks in 0.376s.

---

## 3. Dynamic Ingestion Benchmark on Expanded Corpus (Phase 24 Empirical Results)

Executed on live runtime with BAAI/bge-small-en dense embeddings (384 dimensions):

```
Scenario 1: Initial Cold Ingestion (1,000 Chunks)
   ├── 1,000 chunks newly encoded
   ├── 0 cached vectors reused
   └── Total elapsed time: 20.898 s

Scenario 2: Add 500 New Chunks (1,500 Total Chunks)
   ├── 500 new chunks encoded
   ├── 1,000 cached vectors reused (66.67% reuse rate)
   └── Total elapsed time: 7.787 s

Scenario 3: Modify 10 Chunks (1,500 Total Chunks)
   ├── 10 modified chunks re-encoded
   ├── 1,490 unchanged chunks reused (99.33% reuse rate)
   └── Total elapsed time: 0.376 s (98.2% time reduction!)

Scenario 4: Delete 200 Chunks (1,300 Total Chunks)
   ├── 0 chunks re-encoded
   ├── 1,300 retained chunks reused (100.0% reuse rate)
   └── Total elapsed time: 0.170 s (99.2% time reduction!)
```
