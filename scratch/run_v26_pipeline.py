"""
Optimized Ingestion and Index Rebuild Script for RAG V2.6-A.
Runs multi-source ingestion (MedQuAD, DailyMed 200+, OpenFDA), generates source artifacts,
combines corpora, and builds both DailyMed-isolated and Unified FAISS/BM25 indexes with embedding caching.
"""
import sys
import os
import json
import time
import pickle
from pathlib import Path
import numpy as np
import faiss
import torch

# Optimize CPU threads for PyTorch
if hasattr(torch, "set_num_threads"):
    torch.set_num_threads(os.cpu_count() or 8)

BASE_DIR = Path(r"e:\Major Project Code")
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.ingestion.orchestrator import IngestionOrchestrator
from rag_module.retrieval.bm25_retriever import BM25Retriever
from rag_module.indexing.faiss_indexer import FAISSIndexer
from rag_module.embeddings.bge_embedder import BGEEmbedder
from rag_module.knowledge.source_registry import SourceRegistry


def build_faiss_with_cache(
    chunks,
    index_save_path,
    meta_save_path,
    meta_json_path,
    cache_meta_path=None,
    cache_index_path=None
):
    embedder = BGEEmbedder.get_instance()
    
    # Load cache if available
    cached_vecs = {}
    if cache_meta_path and cache_index_path and Path(cache_meta_path).exists() and Path(cache_index_path).exists():
        try:
            print(f"Loading embedding cache from: {cache_index_path}")
            idx = faiss.read_index(str(cache_index_path))
            with open(cache_meta_path, "rb") as f:
                cached_meta = pickle.load(f)
            if idx.ntotal == len(cached_meta):
                reconstructed = idx.reconstruct_n(0, idx.ntotal)
                for i, meta in enumerate(cached_meta):
                    c_id = meta.get("chunk_id") or meta.get("id")
                    h_val = meta.get("hash") or meta.get("content_hash")
                    if c_id:
                        cached_vecs[c_id] = reconstructed[i]
                    if h_val:
                        cached_vecs[h_val] = reconstructed[i]
                print(f"Loaded {len(cached_vecs)} cached embedding vectors.")
        except Exception as e:
            print(f"Cache load warning (will re-encode): {e}")

    # Identify which chunks need encoding
    all_embeddings = [None] * len(chunks)
    needed_indices = []
    needed_texts = []

    for i, c in enumerate(chunks):
        c_id = c.get("chunk_id") or c.get("id")
        h_val = c.get("hash") or c.get("content_hash")
        
        if c_id in cached_vecs:
            all_embeddings[i] = cached_vecs[c_id]
        elif h_val in cached_vecs:
            all_embeddings[i] = cached_vecs[h_val]
        else:
            needed_indices.append(i)
            needed_texts.append(c["text"])

    print(f"Embedding resolution: {len(chunks) - len(needed_indices)} from cache, {len(needed_indices)} newly encoded.")

    if needed_texts:
        print(f"Encoding {len(needed_texts)} new chunk texts (batch_size=128)...")
        t_enc = time.time()
        new_vecs = embedder.encode_documents(needed_texts, batch_size=128, show_progress_bar=True)
        print(f"Encoded {len(needed_texts)} vectors in {time.time() - t_enc:.2f}s.")
        for idx, vec in zip(needed_indices, new_vecs):
            all_embeddings[idx] = vec

    embeddings_matrix = np.array(all_embeddings, dtype=np.float32)
    dimension = embeddings_matrix.shape[1]
    print(f"Building FAISS IndexFlatIP (dim={dimension}, total={len(embeddings_matrix)})...")
    
    index = faiss.IndexFlatIP(dimension)
    index.add(embeddings_matrix)

    # Save artifacts
    Path(index_save_path).parent.mkdir(parents=True, exist_ok=True)
    faiss.write_index(index, str(index_save_path))
    print(f"Wrote FAISS index: {index_save_path}")

    with open(meta_save_path, "wb") as f:
        pickle.dump(chunks, f)
    print(f"Wrote metadata pkl: {meta_save_path}")

    if meta_json_path:
        with open(meta_json_path, "w", encoding="utf-8") as f:
            json.dump(chunks, f, indent=2, ensure_ascii=False)
        print(f"Wrote metadata json: {meta_json_path}")

    return index, chunks


def main():
    print("=" * 70)
    print("RAG V2.6-A: MULTI-SOURCE INGESTION & INDEX REBUILD")
    print("=" * 70)
    total_start = time.time()

    artifacts_root = BASE_DIR / "rag_module" / "data" / "artifacts"
    artifacts_root.mkdir(parents=True, exist_ok=True)

    orchestrator = IngestionOrchestrator(artifacts_root=artifacts_root)

    # ----------------------------------------------------
    # 1. Ingest MedQuAD
    # ----------------------------------------------------
    print("\n[Step 1/5] Ingesting MedQuAD Knowledge Base...")
    medquad_res = orchestrator.ingest_source("MedQuAD")
    print(f"MedQuAD Ingested: {len(medquad_res.documents)} docs, {len(medquad_res.chunks)} chunks.")

    # ----------------------------------------------------
    # 2. Ingest DailyMed 200+
    # ----------------------------------------------------
    print("\n[Step 2/5] Ingesting DailyMed 200+ Drug Monographs...")
    dailymed_raw_path = BASE_DIR / "rag_module" / "data" / "dailymed_raw.json"
    dailymed_res = orchestrator.ingest_source(
        source_id="DailyMed",
        custom_source_data=dailymed_raw_path
    )
    print(f"DailyMed Ingested: {len(dailymed_res.documents)} docs, {len(dailymed_res.chunks)} chunks.")

    # ----------------------------------------------------
    # 3. Ingest OpenFDA (Pilot / Reference)
    # ----------------------------------------------------
    print("\n[Step 3/5] Ingesting OpenFDA Safety Data...")
    openfda_raw_path = BASE_DIR / "rag_module" / "data" / "openfda_raw.json"
    openfda_data = []
    if openfda_raw_path.exists():
        with open(openfda_raw_path, "r", encoding="utf-8") as f:
            openfda_data = json.load(f)
    openfda_res = orchestrator.ingest_source(
        source_id="openFDA",
        custom_source_data=openfda_data
    )
    print(f"OpenFDA Ingested: {len(openfda_res.documents)} docs, {len(openfda_res.chunks)} chunks.")

    # ----------------------------------------------------
    # 4. Combine into Unified Corpus
    # ----------------------------------------------------
    print("\n[Step 4/5] Combining Sources into Unified Corpus...")
    combined_res = orchestrator.combine_sources([medquad_res, dailymed_res, openfda_res])
    print(f"Combined Corpus: {len(combined_res.documents)} docs, {len(combined_res.chunks)} chunks.")

    # ----------------------------------------------------
    # 5. Build Indexes
    # ----------------------------------------------------
    print("\n[Step 5/5] Building FAISS and BM25 Indexes...")

    # A. DailyMed Isolated Indexes
    print("\n--- Building DailyMed Isolated Indexes ---")
    dailymed_art_dir = artifacts_root / "dailymed"
    dailymed_bm25 = BM25Retriever()
    dailymed_bm25.fit(dailymed_res.chunks)
    dailymed_bm25_path = dailymed_art_dir / "bm25_index.pkl"
    dailymed_bm25.save(dailymed_bm25_path)
    print(f"Saved DailyMed BM25 index: {dailymed_bm25_path}")

    dailymed_faiss_path = dailymed_art_dir / "index.bin"
    dailymed_meta_path = dailymed_art_dir / "metadata.pkl"
    dailymed_meta_json = dailymed_art_dir / "metadata.json"
    
    build_faiss_with_cache(
        chunks=dailymed_res.chunks,
        index_save_path=dailymed_faiss_path,
        meta_save_path=dailymed_meta_path,
        meta_json_path=dailymed_meta_json
    )
    print(f"Saved DailyMed FAISS index: {dailymed_faiss_path}")

    # B. Unified (Combined) Main Production Indexes
    print("\n--- Building Combined Unified Production Indexes ---")
    prod_faiss_dir = BASE_DIR / "rag_module" / "data" / "faiss_index"
    prod_faiss_dir.mkdir(parents=True, exist_ok=True)

    # BM25 Combined
    combined_bm25 = BM25Retriever()
    combined_bm25.fit(combined_res.chunks)
    combined_bm25_path = prod_faiss_dir / "bm25_index.pkl"
    combined_bm25.save(combined_bm25_path)
    print(f"Saved Unified Production BM25 index: {combined_bm25_path}")

    # Also save in artifacts/combined/
    combined_art_dir = artifacts_root / "combined"
    combined_bm25.save(combined_art_dir / "bm25_index.pkl")

    # FAISS Combined with cache
    prod_faiss_bin = prod_faiss_dir / "index_v2.bin"
    prod_faiss_meta = prod_faiss_dir / "meta_v2.pkl"
    prod_faiss_json = prod_faiss_dir / "meta_v2.json"
    
    # We use the previous prod index or dailymed index as cache
    build_faiss_with_cache(
        chunks=combined_res.chunks,
        index_save_path=prod_faiss_bin,
        meta_save_path=prod_faiss_meta,
        meta_json_path=prod_faiss_json,
        cache_meta_path=dailymed_meta_path,
        cache_index_path=dailymed_faiss_path
    )
    print(f"Saved Unified Production FAISS index: {prod_faiss_bin}")

    # Also copy / save to artifacts/combined/
    import shutil
    shutil.copyfile(prod_faiss_bin, combined_art_dir / "index.bin")
    shutil.copyfile(prod_faiss_meta, combined_art_dir / "metadata.pkl")
    shutil.copyfile(prod_faiss_json, combined_art_dir / "metadata.json")
    print(f"Copied Unified FAISS index and metadata to: {combined_art_dir}")

    total_duration = time.time() - total_start
    print("\n" + "=" * 70)
    print(f"PIPELINE COMPLETE in {total_duration:.2f} seconds!")
    print(f"Total Documents: {len(combined_res.documents)}")
    print(f"Total Chunks:    {len(combined_res.chunks)}")
    print("=" * 70)


if __name__ == "__main__":
    main()
