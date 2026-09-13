"""
FAISS Vector Indexer and Metadata Management.
Builds, serializes, and loads exact Inner-Product (Cosine) vector indexes.
"""
import os
import json
import pickle
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
import faiss
import numpy as np
from tqdm import tqdm

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.chunking.semantic_chunker import SemanticChunker
from rag_module.embeddings.bge_embedder import BGEEmbedder


class FAISSIndexer:
    """
    Manages FAISS IndexFlatIP lifecycle with rich metadata synchronization.
    """
    def __init__(self, config: Optional[DEFAULT_CONFIG.__class__] = None):
        self.config = config or DEFAULT_CONFIG
        self.chunker = SemanticChunker(
            chunk_size_words=self.config.CHUNK_SIZE_WORDS,
            overlap_words=self.config.CHUNK_OVERLAP_WORDS,
            min_chunk_char_len=self.config.MIN_CHUNK_CHAR_LEN
        )
        self.embedder = BGEEmbedder.get_instance(self.config.EMBEDDING_MODEL_NAME)

    def build_from_corpus(
        self,
        corpus_path: Optional[Path] = None,
        index_save_path: Optional[Path] = None,
        meta_save_path: Optional[Path] = None,
        meta_json_path: Optional[Path] = None
    ) -> Tuple[faiss.Index, List[Dict[str, Any]]]:
        """
        Loads clean corpus, chunks documents, computes embeddings, and builds FAISS index.
        """
        corpus_path = corpus_path or self.config.CLEAN_CORPUS_V2_PATH
        index_save_path = index_save_path or self.config.FAISS_INDEX_PATH
        meta_save_path = meta_save_path or self.config.METADATA_PATH
        meta_json_path = meta_json_path or self.config.METADATA_JSON_PATH

        if not corpus_path.exists():
            raise FileNotFoundError(f"Corpus not found at: {corpus_path}")

        print(f"Loading corpus from: {corpus_path}")
        with open(corpus_path, "r", encoding="utf-8") as f:
            corpus = json.load(f)

        print(f"Chunking {len(corpus)} medical documents...")
        all_chunks = self.chunker.chunk_corpus(corpus)
        print(f"Generated {len(all_chunks)} semantic chunks.")

        chunk_texts = [c["text"] for c in all_chunks]

        print("Encoding chunk embeddings with BGE (normalized)...")
        embeddings = self.embedder.encode_documents(
            chunk_texts,
            batch_size=self.config.EMBEDDING_BATCH_SIZE,
            show_progress_bar=True
        )

        dimension = embeddings.shape[1]
        print(f"Building FAISS IndexFlatIP (dim={dimension}, total={len(embeddings)})...")
        
        # IndexFlatIP calculates inner product: <q, d> = cos(theta) for normalized vectors
        index = faiss.IndexFlatIP(dimension)
        index.add(embeddings)

        # Save artifacts
        index_save_path.parent.mkdir(parents=True, exist_ok=True)
        print(f"Writing index to: {index_save_path}")
        faiss.write_index(index, str(index_save_path))

        print(f"Writing metadata to: {meta_save_path}")
        with open(meta_save_path, "wb") as f:
            pickle.dump(all_chunks, f)

        print(f"Writing JSON metadata to: {meta_json_path}")
        with open(meta_json_path, "w", encoding="utf-8") as f:
            json.dump(all_chunks, f, indent=2, ensure_ascii=False)

        print(f"Index built successfully: {index.ntotal} vectors stored.")
        return index, all_chunks

    def build_from_chunks(
        self,
        chunks: List[Dict[str, Any]],
        index_save_path: Optional[Path] = None,
        meta_save_path: Optional[Path] = None,
        meta_json_path: Optional[Path] = None
    ) -> Tuple[faiss.Index, List[Dict[str, Any]]]:
        """
        Builds FAISS index directly from pre-computed chunks list.
        """
        index_save_path = index_save_path or self.config.FAISS_INDEX_PATH
        meta_save_path = meta_save_path or self.config.METADATA_PATH
        meta_json_path = meta_json_path or self.config.METADATA_JSON_PATH

        print(f"Building FAISS index directly from {len(chunks)} pre-computed chunks...")
        chunk_texts = [c["text"] for c in chunks]

        print("Encoding chunk embeddings with BGE (normalized)...")
        embeddings = self.embedder.encode_documents(
            chunk_texts,
            batch_size=self.config.EMBEDDING_BATCH_SIZE,
            show_progress_bar=True
        )

        dimension = embeddings.shape[1]
        print(f"Building FAISS IndexFlatIP (dim={dimension}, total={len(embeddings)})...")
        index = faiss.IndexFlatIP(dimension)
        index.add(embeddings)

        # Save artifacts
        index_save_path.parent.mkdir(parents=True, exist_ok=True)
        print(f"Writing index to: {index_save_path}")
        faiss.write_index(index, str(index_save_path))

        print(f"Writing metadata to: {meta_save_path}")
        with open(meta_save_path, "wb") as f:
            pickle.dump(chunks, f)

        if meta_json_path:
            meta_json_path.parent.mkdir(parents=True, exist_ok=True)
            print(f"Writing JSON metadata to: {meta_json_path}")
            with open(meta_json_path, "w", encoding="utf-8") as f:
                json.dump(chunks, f, indent=2, ensure_ascii=False)

        print(f"Index built successfully: {index.ntotal} vectors stored.")
        return index, chunks

    @staticmethod
    def load_index(
        index_path: Optional[Path] = None,
        meta_path: Optional[Path] = None
    ) -> Tuple[faiss.Index, List[Dict[str, Any]]]:
        """
        Loads pre-built FAISS index and metadata from disk.
        """
        index_path = index_path or DEFAULT_CONFIG.FAISS_INDEX_PATH
        meta_path = meta_path or DEFAULT_CONFIG.METADATA_PATH

        if not index_path.exists():
            raise FileNotFoundError(f"FAISS index file not found at: {index_path}")
        if not meta_path.exists():
            raise FileNotFoundError(f"Metadata file not found at: {meta_path}")

        index = faiss.read_index(str(index_path))
        with open(meta_path, "rb") as f:
            metadata = pickle.load(f)

        return index, metadata


if __name__ == "__main__":
    indexer = FAISSIndexer()
    indexer.build_from_corpus()
