"""
Dense Semantic Retriever using FAISS and BGE Embeddings.
Executes vector similarity search with query instruction formatting,
cosine similarity scoring, and candidate filtering.
"""
from typing import List, Dict, Any, Tuple, Optional
import faiss
import numpy as np

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.embeddings.bge_embedder import BGEEmbedder
from rag_module.indexing.faiss_indexer import FAISSIndexer


class DenseRetriever:
    """
    Retrieves nearest semantic neighbors from FAISS index.
    """
    def __init__(
        self,
        index: Optional[faiss.Index] = None,
        metadata: Optional[List[Dict[str, Any]]] = None,
        config: Optional[DEFAULT_CONFIG.__class__] = None
    ):
        self.config = config or DEFAULT_CONFIG
        self.embedder = BGEEmbedder.get_instance(self.config.EMBEDDING_MODEL_NAME)
        
        if index is not None and metadata is not None:
            self.index = index
            self.metadata = metadata
        else:
            self.index, self.metadata = FAISSIndexer.load_index(
                self.config.FAISS_INDEX_PATH,
                self.config.METADATA_PATH
            )

    def search(
        self,
        query: str,
        top_k: int = DEFAULT_CONFIG.DENSE_CANDIDATE_K,
        source_filter: Optional[List[str]] = None,
        domain_filter: Optional[List[str]] = None
    ) -> List[Tuple[int, float]]:
        """
        Encodes query and retrieves top_k candidate chunks.
        Supports optional post-filtering by source_id and medical_domain.
        Returns list of (chunk_idx, cosine_similarity_score).
        """
        if not query or self.index.ntotal == 0:
            return []

        # Encode query with BGE prefix and normalization
        query_vec = self.embedder.encode_query(query)

        # If filtering is requested, query a larger candidate pool to ensure top_k matches
        search_k = min(self.index.ntotal, max(top_k * 4, 100)) if (source_filter or domain_filter) else min(self.index.ntotal, top_k)

        # Search FAISS index
        scores, indices = self.index.search(query_vec, search_k)

        source_set = {s.lower() for s in source_filter} if source_filter else None
        domain_set = {d.lower() for d in domain_filter} if domain_filter else None
        medquad_subsources = {'medquad_generic', 'cancergov', 'niddk', 'cdc', 'gard', 'ninds', 'nhlbi', 'ghr', 'seniorhealth', 'medquad'}

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(self.metadata):
                continue
            meta = self.metadata[idx]
            if source_set:
                doc_source = str(meta.get("source_id", "")).lower()
                is_match = doc_source in source_set
                if not is_match and any(s in ["medquad", "medquad_nih"] for s in source_set):
                    is_match = doc_source in medquad_subsources
                if not is_match:
                    continue
            if domain_set and str(meta.get("medical_domain", "")).lower() not in domain_set:
                continue
            # For IndexFlatIP with normalized vectors, score is cosine similarity in [-1, 1]
            results.append((int(idx), float(score)))
            if len(results) >= top_k:
                break

        return results

    def get_chunk(self, idx: int) -> Dict[str, Any]:
        """Retrieves metadata for a chunk index."""
        return self.metadata[idx]
