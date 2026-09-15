"""
Script: build_and_lock_indices.py
Purpose:
1. Archives and hashes the Golden 236 regression baseline into data/indices/golden_236/ and data/manifests/golden_baseline_manifest.json.
2. Builds the complete FAISS IndexFlatIP (384D) and BM25Okapi inverted index for all 2,204 production chunks from data/normalized/expanded_production_chunks.json.
3. Saves production index artifacts to data/indices/production/ and deploys them to rag_module/data/faiss_index/ for active API runtime.
4. Generates data/manifests/production_index_manifest.json and updates data/manifests/model_index_lock.json with full cryptographic SHA-256 hashes.
"""

import sys
import json
import shutil
import hashlib
import pickle
from pathlib import Path
from datetime import datetime, timezone
import numpy as np
import faiss

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.embeddings.bge_embedder import BGEEmbedder
from rag_module.retrieval.bm25_retriever import BM25Retriever


def compute_sha256(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def main():
    print("======================================================================")
    print("PHASE 25: BUILDING & LOCKING PRODUCTION INDEX (2,204 CHUNKS)")
    print("======================================================================")

    data_dir = ROOT_DIR / "data"
    indices_dir = data_dir / "indices"
    golden_dir = indices_dir / "golden_236"
    prod_dir = indices_dir / "production"
    manifests_dir = data_dir / "manifests"
    runtime_idx_dir = ROOT_DIR / "rag_module" / "data" / "faiss_index"

    golden_dir.mkdir(parents=True, exist_ok=True)
    prod_dir.mkdir(parents=True, exist_ok=True)
    manifests_dir.mkdir(parents=True, exist_ok=True)
    runtime_idx_dir.mkdir(parents=True, exist_ok=True)

    # --- Step 1: Archive Golden 236 Baseline ---
    print("\n[Step 1] Archiving Golden 236 Baseline to data/indices/golden_236/...")
    golden_files = ["index_v2.bin", "meta_v2.json", "meta_v2.pkl", "bm25_index.pkl"]
    golden_hashes = {}

    for fname in golden_files:
        src = runtime_idx_dir / fname
        dst = golden_dir / fname
        if src.exists():
            shutil.copy2(src, dst)
            h = compute_sha256(dst)
            golden_hashes[fname] = h
            print(f"  {fname}: {h}")

    golden_manifest = {
        "corpus_name": "golden_236_regression_baseline",
        "description": "Frozen 236-chunk golden baseline for backwards-compatible regression testing.",
        "vector_count": 236,
        "embedding_model": "BAAI/bge-small-en",
        "embedding_dimension": 384,
        "max_context_window_tokens": 512,
        "query_prefix": "Represent this sentence for searching relevant passages: ",
        "similarity_metric": "METRIC_INNER_PRODUCT (Cosine similarity with L2-normalized vectors)",
        "hashes": golden_hashes,
        "locked_at": datetime.now(timezone.utc).isoformat()
    }
    with open(manifests_dir / "golden_baseline_manifest.json", "w", encoding="utf-8") as f:
        json.dump(golden_manifest, f, indent=2)
    print("  Saved: data/manifests/golden_baseline_manifest.json")

    # --- Step 2: Load 2,204 Normalized Production Chunks ---
    print("\n[Step 2] Loading 2,204 Normalized Production Chunks...")
    norm_chunks_file = data_dir / "normalized" / "expanded_production_chunks.json"
    if not norm_chunks_file.exists():
        raise FileNotFoundError(f"Missing {norm_chunks_file}")

    with open(norm_chunks_file, "r", encoding="utf-8") as f:
        chunks = json.load(f)

    total_chunks = len(chunks)
    print(f"  Loaded {total_chunks} canonical knowledge chunks.")

    # --- Step 3: Compute Dense Embeddings (384D, Normalized) ---
    print("\n[Step 3] Computing Dense Embeddings with BAAI/bge-small-en...")
    embedder = BGEEmbedder.get_instance(DEFAULT_CONFIG.EMBEDDING_MODEL_NAME)
    chunk_texts = [c["text"] for c in chunks]
    embeddings = embedder.encode_documents(chunk_texts, batch_size=64, show_progress_bar=True)
    embeddings = np.ascontiguousarray(embeddings, dtype=np.float32)

    dim = embeddings.shape[1]
    print(f"  Embeddings computed: Shape={embeddings.shape}, dtype={embeddings.dtype}")
    assert dim == 384, f"Expected 384 dimensions, got {dim}"
    assert len(embeddings) == total_chunks, f"Vector count mismatch: {len(embeddings)} vs {total_chunks}"

    # --- Step 4: Build FAISS IndexFlatIP ---
    print("\n[Step 4] Building FAISS IndexFlatIP (384D)...")
    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)
    assert index.ntotal == total_chunks, f"Index count mismatch: {index.ntotal} vs {total_chunks}"
    print(f"  FAISS Index created with {index.ntotal} vectors.")

    # --- Step 5: Build BM25Okapi Lexical Index ---
    print("\n[Step 5] Building BM25Okapi Lexical Inverted Index...")
    bm25_retriever = BM25Retriever()
    bm25_retriever.fit(chunks)
    print(f"  BM25 index built with {bm25_retriever.corpus_size} documents.")

    # --- Step 6: Save Production Artifacts ---
    print("\n[Step 6] Saving Production Artifacts to data/indices/production/ and rag_module/data/faiss_index/...")
    # Write to data/indices/production/
    faiss.write_index(index, str(prod_dir / "index_v2.bin"))
    with open(prod_dir / "meta_v2.json", "w", encoding="utf-8") as f:
        json.dump(chunks, f, indent=2)
    with open(prod_dir / "meta_v2.pkl", "wb") as f:
        pickle.dump(chunks, f, protocol=pickle.HIGHEST_PROTOCOL)
    bm25_retriever.save(prod_dir / "bm25_index.pkl")

    # Deploy to rag_module/data/faiss_index/ for active API runtime
    faiss.write_index(index, str(runtime_idx_dir / "index_v2.bin"))
    with open(runtime_idx_dir / "meta_v2.json", "w", encoding="utf-8") as f:
        json.dump(chunks, f, indent=2)
    with open(runtime_idx_dir / "meta_v2.pkl", "wb") as f:
        pickle.dump(chunks, f, protocol=pickle.HIGHEST_PROTOCOL)
    bm25_retriever.save(runtime_idx_dir / "bm25_index.pkl")

    print("  Artifacts successfully serialized to both production archive and live runtime.")

    # --- Step 7: Compute Production Hashes and Write Manifest ---
    print("\n[Step 7] Generating Production Index Manifest & Lock...")
    prod_hashes = {}
    for fname in golden_files:
        prod_hashes[fname] = compute_sha256(prod_dir / fname)
        print(f"  {fname}: {prod_hashes[fname]}")

    prod_manifest = {
        "corpus_name": "expanded_production_2204",
        "description": "Expanded authentic 2,204-chunk clinical production knowledge base (DailyMed 2,176, ICMR 8, MoHFW 4, MedlinePlus 16).",
        "vector_count": total_chunks,
        "embedding_model": "BAAI/bge-small-en",
        "embedding_dimension": 384,
        "max_context_window_tokens": 512,
        "query_prefix": "Represent this sentence for searching relevant passages: ",
        "similarity_metric": "METRIC_INNER_PRODUCT (Cosine similarity with L2-normalized vectors)",
        "source_distribution": {
            "DailyMed": 2176,
            "ICMR": 8,
            "MoHFW_STG": 4,
            "MedlinePlus": 16
        },
        "hashes": prod_hashes,
        "locked_at": datetime.now(timezone.utc).isoformat()
    }
    with open(manifests_dir / "production_index_manifest.json", "w", encoding="utf-8") as f:
        json.dump(prod_manifest, f, indent=2)
    print("  Saved: data/manifests/production_index_manifest.json")

    # Update combined model_index_lock.json
    combined_lock = {
        "active_production_manifest": prod_manifest,
        "golden_regression_manifest": golden_manifest,
        "specification": {
            "dense_model": "BAAI/bge-small-en",
            "dense_dimension": 384,
            "transformer_max_seq_length_tokens": 512,
            "dense_normalization": "L2 Unit Normalization",
            "query_prefix": "Represent this sentence for searching relevant passages: ",
            "similarity_metric": "METRIC_INNER_PRODUCT",
            "cross_encoder_model": "cross-encoder/ms-marco-MiniLM-L-6-v2",
            "lexical_algorithm": "BM25Okapi (rank_bm25)",
            "hybrid_fusion": "Reciprocal Rank Fusion (RRF k=60)"
        }
    }
    with open(manifests_dir / "model_index_lock.json", "w", encoding="utf-8") as f:
        json.dump(combined_lock, f, indent=2)
    print("  Saved: data/manifests/model_index_lock.json")

    print("\n======================================================================")
    print("SUCCESS: 2,204 Production Index & Manifests Built & Locked!")
    print("======================================================================")


if __name__ == "__main__":
    main()
