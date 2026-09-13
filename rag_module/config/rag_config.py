"""
Centralized Configuration for RAG Module V2.
Path-robust, environment-aware configuration dataclass.
"""
from dataclasses import dataclass, field
from pathlib import Path
import os


@dataclass
class RAGConfig:
    # Base Directories (Resolved dynamically to eliminate working-directory dependency)
    BASE_DIR: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent)
    DATA_DIR: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent / "rag_module" / "data")
    
    # Raw Data Sources
    RAW_DATA_DIR: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent / "rag_module" / "data" / "medquad")
    MEDQUAD_DIR: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent / "rag_module" / "data" / "medquad")
    ARTIFACTS_DIR: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent / "rag_module" / "data" / "artifacts")
    CLEAN_CORPUS_V1_PATH: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent / "rag_module" / "data" / "clean_corpus.json")
    CLEAN_CORPUS_V2_PATH: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent / "rag_module" / "data" / "clean_corpus_v2.json")
    
    # Vector Index & Metadata Paths
    FAISS_INDEX_DIR: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent / "rag_module" / "data" / "faiss_index")
    FAISS_INDEX_PATH: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent / "rag_module" / "data" / "faiss_index" / "index_v2.bin")
    METADATA_PATH: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent / "rag_module" / "data" / "faiss_index" / "meta_v2.pkl")
    METADATA_JSON_PATH: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent / "rag_module" / "data" / "faiss_index" / "meta_v2.json")
    BM25_INDEX_PATH: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent / "rag_module" / "data" / "faiss_index" / "bm25_index.pkl")
    
    # Chunking Parameters
    CHUNK_SIZE_WORDS: int = 250
    CHUNK_OVERLAP_WORDS: int = 35
    MIN_CHUNK_CHAR_LEN: int = 40
    
    # Embedding Model
    EMBEDDING_MODEL_NAME: str = "BAAI/bge-small-en"
    EMBEDDING_DIMENSION: int = 384
    QUERY_INSTRUCTION_PREFIX: str = "Represent this sentence for searching relevant passages: "
    NORMALIZE_EMBEDDINGS: bool = True
    EMBEDDING_BATCH_SIZE: int = 32
    
    # Retrieval Parameters
    DENSE_CANDIDATE_K: int = 20
    BM25_CANDIDATE_K: int = 20
    HYBRID_RRF_K: int = 60
    FINAL_TOP_K: int = 3
    SIMILARITY_THRESHOLD: float = 0.55  # Minimum cosine similarity for acceptance
    
    # Reranker Model
    RERANKER_MODEL_NAME: str = "BAAI/bge-reranker-small"
    USE_RERANKER: bool = True
    
    # LLM Generation Parameters
    GENERATOR_MODEL_NAME: str = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
    MAX_NEW_TOKENS: int = 200
    TEMPERATURE: float = 0.2
    TOP_P: float = 0.9
    REPETITION_PENALTY: float = 1.15
    MAX_CONTEXT_TOKENS: int = 1500
    
    # Safety & Guardrails
    ENABLE_SAFETY_GUARDRAILS: bool = True
    ENABLE_EMERGENCY_TRIAGE: bool = True
    ENABLE_ABSTENTION: bool = True


# Global default instance
DEFAULT_CONFIG = RAGConfig()
