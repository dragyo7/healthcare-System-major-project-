"""
Hybrid Retriever combining Dense (FAISS) and Lexical (BM25) Retrieval
using Reciprocal Rank Fusion (RRF).
"""
from typing import List, Dict, Any, Tuple, Optional
from collections import defaultdict

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.retrieval.dense_retriever import DenseRetriever
from rag_module.retrieval.bm25_retriever import BM25Retriever


class HybridRetriever:
    """
    Fuses dense semantic retrieval with BM25 keyword matching via RRF.
    """
    def __init__(
        self,
        dense_retriever: DenseRetriever,
        bm25_retriever: BM25Retriever,
        config: Optional[DEFAULT_CONFIG.__class__] = None
    ):
        self.dense_retriever = dense_retriever
        self.bm25_retriever = bm25_retriever
        self.config = config or DEFAULT_CONFIG
        self.metadata = dense_retriever.metadata

    def search(
        self,
        query: str,
        dense_k: int = DEFAULT_CONFIG.DENSE_CANDIDATE_K,
        bm25_k: int = DEFAULT_CONFIG.BM25_CANDIDATE_K,
        final_k: int = DEFAULT_CONFIG.FINAL_TOP_K,
        dense_weight: float = 1.0,
        bm25_weight: float = 1.0,
        rrf_k: int = DEFAULT_CONFIG.HYBRID_RRF_K,
        source_filter: Optional[List[str]] = None,
        domain_filter: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Executes hybrid retrieval:
        1. Query dense index -> ranked list of (idx, dense_score)
        2. Query BM25 index -> ranked list of (idx, bm25_score)
        3. Reciprocal Rank Fusion -> fused scores
        4. Returns top candidate chunks with enriched score metadata
        """
        if not query:
            return []

        # 1. Retrieve candidates from both systems with optional source/domain filtering
        dense_kwargs = {}
        if source_filter is not None:
            dense_kwargs["source_filter"] = source_filter
        if domain_filter is not None:
            dense_kwargs["domain_filter"] = domain_filter

        try:
            dense_results = self.dense_retriever.search(query, top_k=dense_k, **dense_kwargs)
        except TypeError:
            dense_results = self.dense_retriever.search(query, top_k=dense_k)

        bm25_kwargs = {}
        if source_filter is not None:
            bm25_kwargs["source_filter"] = source_filter
        if domain_filter is not None:
            bm25_kwargs["domain_filter"] = domain_filter

        try:
            bm25_results = self.bm25_retriever.search(query, top_k=bm25_k, **bm25_kwargs)
        except TypeError:
            bm25_results = self.bm25_retriever.search(query, top_k=bm25_k)

        # 2. Compute Reciprocal Rank Fusion (RRF) scores
        rrf_scores = defaultdict(float)
        score_details = defaultdict(dict)

        # Process Dense ranks
        for rank, (idx, score) in enumerate(dense_results, start=1):
            rrf_scores[idx] += dense_weight * (1.0 / (rrf_k + rank))
            score_details[idx]["dense_rank"] = rank
            score_details[idx]["dense_score"] = round(score, 4)

        # Process BM25 ranks
        for rank, (idx, score) in enumerate(bm25_results, start=1):
            rrf_scores[idx] += bm25_weight * (1.0 / (rrf_k + rank))
            score_details[idx]["bm25_rank"] = rank
            score_details[idx]["bm25_score"] = round(score, 4)

        # 3. Sort by fused RRF score
        sorted_candidates = sorted(
            rrf_scores.items(),
            key=lambda item: item[1],
            reverse=True
        )[:final_k]

        # 4. Construct enriched candidate chunks
        retrieved_chunks = []
        for idx, fused_score in sorted_candidates:
            chunk = dict(self.metadata[idx])
            chunk["fused_score"] = round(fused_score, 6)
            chunk["dense_score"] = score_details[idx].get("dense_score", 0.0)
            chunk["bm25_score"] = score_details[idx].get("bm25_score", 0.0)
            chunk["dense_rank"] = score_details[idx].get("dense_rank", None)
            chunk["bm25_rank"] = score_details[idx].get("bm25_rank", None)
            retrieved_chunks.append(chunk)

        return retrieved_chunks
