import os
import sys
sys.path.insert(0, os.path.abspath("."))

from rag_module.service import get_rag_service

service = get_rag_service()
print("=== HYBRID RETRIEVAL & RERANKING AUDIT ===")
print("Service ready:", service.is_ready())

query = "What are the indications and usage of Metformin?"
print(f"\nQuery: '{query}'")

# 1. Dense search
dense_hits = service.dense_retriever.search(query, top_k=3)
print("\n[Dense Hits (Top 3)]:")
for r, (idx, score) in enumerate(dense_hits, 1):
    c = service.dense_retriever.metadata[idx]
    print(f"  {r}. [{c.get('chunk_id')[:30]}...] Score={score:.4f} | Title={c.get('title')}")

# 2. BM25 search
bm25_hits = service.bm25_retriever.search(query, top_k=3)
print("\n[BM25 Hits (Top 3)]:")
for r, (idx, score) in enumerate(bm25_hits, 1):
    c = service.bm25_retriever.metadata[idx]
    print(f"  {r}. [{c.get('chunk_id')[:30]}...] Score={score:.4f} | Title={c.get('title')}")

# 3. Hybrid RRF Search
hybrid_chunks = service.hybrid_retriever.search(query, final_k=3)
print("\n[Hybrid RRF Hits (k=60) (Top 3)]:")
for r, c in enumerate(hybrid_chunks, 1):
    print(f"  {r}. [{c.get('chunk_id')[:30]}...] FusedScore={c.get('fused_score'):.5f} | DenseRank={c.get('dense_rank')} | BM25Rank={c.get('bm25_rank')} | Title={c.get('title')}")

# 4. Cross-Encoder Reranker
reranked = service.reranker.rerank(query, hybrid_chunks, top_k=2)
print("\n[Cross-Encoder Reranked (Top 2)]:")
for r, c in enumerate(reranked, 1):
    print(f"  {r}. [{c.get('chunk_id')[:30]}...] RerankScore={c.get('rerank_score'):.4f} | Title={c.get('title')}")
