"""
Backward-Compatible Embedder and Indexer Interface.
Delegates to modern RAG V2 indexing modules.
"""
import sys
from pathlib import Path

# Ensure root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.chunking.semantic_chunker import SemanticChunker
from rag_module.indexing.faiss_indexer import FAISSIndexer


def chunk_text(text: str, chunk_size: int = 200, overlap: int = 20):
    """Legacy chunk_text function routed to modern bounded chunker."""
    chunker = SemanticChunker(chunk_size_words=chunk_size, overlap_words=overlap)
    dummy_doc = {"question": "", "answer": text}
    chunks = chunker.chunk_document(dummy_doc)
    return [c["text"] for c in chunks]


def build_index():
    """Builds and returns modern FAISS index and metadata."""
    indexer = FAISSIndexer()
    return indexer.build_from_corpus()


def save_index(index, metadata):
    pass


def load_index():
    return FAISSIndexer.load_index()


if __name__ == "__main__":
    idx, meta = build_index()
    print("FAISS index created successfully with total vectors:", idx.ntotal)