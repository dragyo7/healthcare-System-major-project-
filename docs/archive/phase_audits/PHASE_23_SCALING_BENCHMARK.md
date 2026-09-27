# PHASE 23 — SCALING BENCHMARK REPORT
**Healthcare Clinical Decision Support (CDS) RAG System**  
**Execution Timestamp**: 2026-09-15T09:10:00Z  
**Audit Artifact Source**: [`audit_evidence/phase_23_scaling_benchmark.json`](file:///e:/Major%20Project%20Code/audit_evidence/phase_23_scaling_benchmark.json)

---

## 1. Executive Summary & Objective

Phase 23 evaluated the empirical scalability, retrieval quality, memory footprint, and latency profile of the Clinical Decision Support RAG system across expanding corpus tiers on the actual Python/FAISS runtime.

### Key Conclusions:
1. **Recall@5 remains 100% across all corpus tiers** (from 236 to 5,000 chunks).
2. **Mean Reciprocal Rank (MRR)** remains consistently high ($\mathbf{0.6050 \to 0.6242}$).
3. **Retrieval Latency (p50)** is essentially constant ($\mathbf{84.1\text{ ms} \to 67.6\text{ ms}}$) because FAISS index scan time is $< 3\text{ ms}$ and the Cross-Encoder operates over a fixed top-$K$ budget ($K=10$).
4. **Index Disk Footprint** scales strictly linearly ($O(N \cdot d)$): 354 KB at 236 chunks to 7.50 MB at 5,000 chunks.

---

## 2. Multi-Scale Empirical Metrics Table

| Benchmark Tier | Corpus Size ($N$) | FAISS Index Size | Metadata JSON Size | BM25 Size | Build Time | Recall@1 | Recall@3 | Recall@5 | MRR | Latency p50 | Latency p95 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Tier 1 (Golden Baseline)** | **236** | 354.0 KB | 303.7 KB | 344.5 KB | 0.036 s | 45.0% | 60.0% | **100.0%** | **0.6050** | 84.11 ms | 532.50 ms |
| **Tier 2 (Extended Authentic)** | **311** | 466.5 KB | 369.1 KB | 397.5 KB | 5.318 s | 45.0% | 60.0% | **100.0%** | **0.6050** | 70.68 ms | 438.85 ms |
| **Tier 3 (Scale 1,000)** | **1,000** | 1.50 MB | 1.20 MB | 797.0 KB | 12.999 s | 55.0% | 55.0% | **100.0%** | **0.6425** | 63.33 ms | 457.24 ms |
| **Tier 4 (Scale 5,000)** | **5,000** | 7.50 MB | 6.04 MB | 3.15 MB | 59.701 s | 50.0% | 60.0% | **100.0%** | **0.6242** | 67.59 ms | 457.10 ms |

---

## 3. Computational Breakdown & Bottleneck Profiling

Where does compute time actually occur?

```
User Query Input
   │
   ├── Dense Query Embedding (BAAI/bge-small-en): ~18 ms (CPU transformer forward pass)
   │
   ├── FAISS Dense Search (IndexFlatIP): ~1.2 ms (Matrix multiplication in C++)
   │
   ├── BM25 Okapi Lexical Search: ~0.8 ms (Inverted index lookup)
   │
   ├── Reciprocal Rank Fusion (k=60): ~0.04 ms (Dictionary sorting)
   │
   ├── Cross-Encoder Reranking (10 pairs): ~45–60 ms (MiniLM-L-6-v2 cross-attention)
   │
   └── Evidence Policy Verification: ~0.1 ms (Regex + provenance verification)
   │
   └── Total Warm Retrieval Pipeline: ~65–85 ms
```

### Observations:
- **Index Search vs Reranking**: Searching the 5,000-vector FAISS index takes $< 2.5\text{ ms}$, representing $< 3\%$ of total latency. The Cross-Encoder reranker represents $\sim 70\%$ of retrieval latency.
- **Constant Latency with Respect to Corpus Size**: Because RRF passes a fixed top-$K$ ($K=10$) candidate pool to the reranker regardless of whether the corpus has 200 or 20,000 chunks, query latency does not increase with corpus size.
- **Cold Start vs Warm Runtime**: The first query takes $\sim 450\text{ ms}$ due to PyTorch model weight cache loading into CPU memory; subsequent warm queries execute consistently at $\sim 65–85\text{ ms}$.
