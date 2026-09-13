"""
BGE Dense Embedding Engine.
Handles BAAI/bge-small-en model lifecycle, query instruction formatting,
batch document encoding, and strict unit normalization.
"""
from typing import List, Union, Optional
import numpy as np
from sentence_transformers import SentenceTransformer
from rag_module.config.rag_config import DEFAULT_CONFIG


class BGEEmbedder:
    """
    Thread-safe lazy-loading dense embedder for BAAI/bge models.
    """
    _instance: Optional["BGEEmbedder"] = None
    _model: Optional[SentenceTransformer] = None

    def __init__(self, model_name: str = DEFAULT_CONFIG.EMBEDDING_MODEL_NAME):
        self.model_name = model_name
        self.query_prefix = DEFAULT_CONFIG.QUERY_INSTRUCTION_PREFIX
        self.dimension = DEFAULT_CONFIG.EMBEDDING_DIMENSION
        self.normalize = DEFAULT_CONFIG.NORMALIZE_EMBEDDINGS

    @classmethod
    def get_instance(cls, model_name: str = DEFAULT_CONFIG.EMBEDDING_MODEL_NAME) -> "BGEEmbedder":
        """Singleton accessor to prevent redundant model copies in memory."""
        if cls._instance is None:
            cls._instance = cls(model_name=model_name)
        return cls._instance

    def _get_model(self) -> SentenceTransformer:
        """Lazy-load the underlying transformer model on first use."""
        if self._model is None:
            print(f"Loading embedding model: {self.model_name}...")
            self._model = SentenceTransformer(self.model_name)
        return self._model

    def encode_query(self, query: str) -> np.ndarray:
        """
        Encodes a single search query.
        Applies BGE query instruction prefix and enforces unit normalization.
        Returns 2D float32 array of shape (1, dimension).
        """
        model = self._get_model()
        formatted_query = f"{self.query_prefix}{query.strip()}"
        
        embedding = model.encode(
            [formatted_query],
            normalize_embeddings=self.normalize,
            show_progress_bar=False
        )
        return np.array(embedding, dtype=np.float32)

    def encode_documents(
        self,
        documents: List[str],
        batch_size: int = DEFAULT_CONFIG.EMBEDDING_BATCH_SIZE,
        show_progress_bar: bool = True
    ) -> np.ndarray:
        """
        Batch encodes document passages without query instruction prefix.
        Enforces unit normalization.
        Returns 2D float32 array of shape (num_docs, dimension).
        """
        if not documents:
            return np.empty((0, self.dimension), dtype=np.float32)

        model = self._get_model()
        embeddings = model.encode(
            documents,
            batch_size=batch_size,
            normalize_embeddings=self.normalize,
            show_progress_bar=show_progress_bar
        )
        return np.array(embeddings, dtype=np.float32)
