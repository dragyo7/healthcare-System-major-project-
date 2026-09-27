"""
Cross-Encoder Second-Stage Reranker Module.
Computes deep token-level cross-attention between query and retrieved candidate passages.
"""
from typing import List, Dict, Any, Optional
from rag_module.config.rag_config import DEFAULT_CONFIG


class CrossEncoderReranker:
    """
    Reranks candidate passages using a cross-encoder model.
    """
    def __init__(
        self,
        model_name: str = DEFAULT_CONFIG.RERANKER_MODEL_NAME,
        use_reranker: bool = DEFAULT_CONFIG.USE_RERANKER
    ):
        self.model_name = model_name
        self.use_reranker = use_reranker
        self._model = None

    def _get_model(self):
        """Lazy-load the cross-encoder model."""
        if self._model is None and self.use_reranker:
            try:
                from sentence_transformers import CrossEncoder
                print(f"Loading Cross-Encoder Reranker: {self.model_name}...")
                self._model = CrossEncoder(self.model_name)
            except Exception as e:
                print(f"Warning: Could not load CrossEncoder ({e}). Falling back to pass-through ranking.")
                self.use_reranker = False
        return self._model

    def rerank(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        top_k: int = DEFAULT_CONFIG.FINAL_TOP_K
    ) -> List[Dict[str, Any]]:
        """
        Reranks candidate chunks by cross-encoder relevance score.
        Returns top_k re-ordered chunks.
        """
        if not candidates or not query:
            return []

        if not self.use_reranker:
            return candidates[:top_k]

        model = self._get_model()
        if model is None:
            return candidates[:top_k]

        # Prepare (query, passage) pairs
        pairs = [[query, c["text"]] for c in candidates]

        try:
            scores = model.predict(pairs)
            
            # Attach reranker scores
            scored_candidates = []
            for chunk, score in zip(candidates, scores):
                chunk_copy = dict(chunk)
                chunk_copy["rerank_score"] = float(score)
                scored_candidates.append(chunk_copy)

            # Sort descending by cross-encoder score
            scored_candidates.sort(key=lambda x: x["rerank_score"], reverse=True)
            return scored_candidates[:top_k]
            
        except Exception as e:
            print(f"Warning: Reranking failed ({e}). Returning original order.")
            return candidates[:top_k]
