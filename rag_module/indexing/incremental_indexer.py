"""
Incremental Indexing Engine with Content-Hash Caching.
Reuses existing vector embeddings for unchanged chunks, encoding ONLY new or modified chunks.
Supports synchronized FAISS and BM25 index updates.
"""
import os
import json
import time
import pickle
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional, Set
import faiss
import numpy as np

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.embeddings.bge_embedder import BGEEmbedder
from rag_module.retrieval.bm25_retriever import BM25Retriever


def compute_chunk_fingerprint(chunk: Dict[str, Any], model_name: str) -> str:
    """Computes deterministic SHA-256 fingerprint over chunk text, source, doc_id, and model name."""
    text = chunk.get("text", "").strip()
    source_id = chunk.get("source_id", "")
    doc_id = chunk.get("doc_id", "")
    chunk_id = chunk.get("chunk_id", "")
    meta_sec = str(chunk.get("metadata", {}).get("section", ""))
    
    payload = f"{text}|{source_id}|{doc_id}|{chunk_id}|{meta_sec}|{model_name}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class IncrementalIndexer:
    """
    Incremental Indexer that preserves embedding cache across updates.
    """
    def __init__(
        self,
        config: Optional[DEFAULT_CONFIG.__class__] = None,
        cache_dir: Optional[Path] = None
    ):
        self.config = config or DEFAULT_CONFIG
        self.cache_dir = cache_dir or self.config.FAISS_INDEX_DIR
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        self.cache_meta_path = self.cache_dir / "chunk_cache.json"
        self.vectors_cache_path = self.cache_dir / "embeddings_cache.npz"
        self.embedder = BGEEmbedder.get_instance(self.config.EMBEDDING_MODEL_NAME)
        
        # In-memory vector store mapping fingerprint -> 1D numpy array
        self._fingerprint_to_vec: Dict[str, np.ndarray] = {}
        self._load_cache()

    def _load_cache(self):
        """Loads cached fingerprints and embedding vectors if present on disk."""
        if self.cache_meta_path.exists() and self.vectors_cache_path.exists():
            try:
                with open(self.cache_meta_path, "r", encoding="utf-8") as f:
                    fp_list = json.load(f)
                npz = np.load(self.vectors_cache_path)
                matrix = npz["vectors"]
                if len(fp_list) == len(matrix):
                    self._fingerprint_to_vec = {fp: matrix[i] for i, fp in enumerate(fp_list)}
            except Exception as e:
                print(f"[IncrementalIndexer] Warning loading cache: {e}. Starting fresh cache.")
                self._fingerprint_to_vec = {}

    def _save_cache(self):
        """Persists fingerprint list and vector array to disk."""
        fp_list = list(self._fingerprint_to_vec.keys())
        if not fp_list:
            return
        matrix = np.vstack([self._fingerprint_to_vec[fp] for fp in fp_list])
        
        with open(self.cache_meta_path, "w", encoding="utf-8") as f:
            json.dump(fp_list, f)
            
        np.savez_compressed(self.vectors_cache_path, vectors=matrix)

    def sync_index(
        self,
        chunks: List[Dict[str, Any]],
        index_save_path: Optional[Path] = None,
        meta_save_path: Optional[Path] = None,
        meta_json_path: Optional[Path] = None,
        bm25_save_path: Optional[Path] = None
    ) -> Dict[str, Any]:
        """
        Synchronizes FAISS IndexFlatIP and BM25 index against target chunks.
        Computes embeddings only for chunks whose content fingerprint is missing from cache.
        """
        t0 = time.time()
        index_save_path = index_save_path or self.config.FAISS_INDEX_PATH
        meta_save_path = meta_save_path or self.config.METADATA_PATH
        meta_json_path = meta_json_path or self.config.METADATA_JSON_PATH
        bm25_save_path = bm25_save_path or self.config.BM25_INDEX_PATH
        
        model_name = self.config.EMBEDDING_MODEL_NAME
        
        # 1. Compute fingerprints for all incoming chunks
        chunk_fps = [compute_chunk_fingerprint(c, model_name) for c in chunks]
        
        # 2. Identify missing / modified chunks needing embedding
        missing_indices = [i for i, fp in enumerate(chunk_fps) if fp not in self._fingerprint_to_vec]
        reused_count = len(chunks) - len(missing_indices)
        encoded_count = len(missing_indices)
        
        if missing_indices:
            texts_to_encode = [chunks[i]["text"] for i in missing_indices]
            new_vectors = self.embedder.encode_documents(
                texts_to_encode,
                batch_size=self.config.EMBEDDING_BATCH_SIZE,
                show_progress_bar=False
            )
            for i_idx, vec in zip(missing_indices, new_vectors):
                self._fingerprint_to_vec[chunk_fps[i_idx]] = vec
                
        # 3. Assemble complete aligned vector matrix
        if chunks:
            all_vectors = np.vstack([self._fingerprint_to_vec[fp] for fp in chunk_fps])
            dimension = all_vectors.shape[1]
            
            # Build exact FAISS IndexFlatIP
            faiss_index = faiss.IndexFlatIP(dimension)
            faiss_index.add(all_vectors)
        else:
            faiss_index = faiss.IndexFlatIP(self.config.EMBEDDING_DIMENSION)
            
        # 4. Save FAISS index and metadata
        index_save_path.parent.mkdir(parents=True, exist_ok=True)
        faiss.write_index(faiss_index, str(index_save_path))
        
        with open(meta_save_path, "wb") as f:
            pickle.dump(chunks, f)
            
        if meta_json_path:
            meta_json_path.parent.mkdir(parents=True, exist_ok=True)
            with open(meta_json_path, "w", encoding="utf-8") as f:
                json.dump(chunks, f, indent=2, ensure_ascii=False)
                
        # 5. Save BM25 Lexical Index
        bm25 = BM25Retriever()
        bm25.fit(chunks)
        bm25.save(bm25_save_path)
        
        # 6. Save cache
        self._save_cache()
        
        duration = round(time.time() - t0, 3)
        stats = {
            "total_chunks": len(chunks),
            "reused_chunks": reused_count,
            "re_encoded_chunks": encoded_count,
            "vector_dimension": faiss_index.d,
            "total_cached_vectors": len(self._fingerprint_to_vec),
            "duration_seconds": duration
        }
        return stats
