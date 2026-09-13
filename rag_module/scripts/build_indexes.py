"""
Index Build Script for RAG V2.
Generates semantic chunks, builds and serializes BM25 index,
computes dense BGE embeddings, and creates FAISS IndexFlatIP.
"""
import sys
import time
from pathlib import Path

# Ensure root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import json
from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.ingestion.medquad_loader import ingest_medquad
from rag_module.chunking.semantic_chunker import SemanticChunker
from rag_module.retrieval.bm25_retriever import BM25Retriever
from rag_module.indexing.faiss_indexer import FAISSIndexer


def run_full_indexing_pipeline():
    print("=" * 60)
    print("RAG V2: Full Knowledge Ingestion & Indexing Pipeline")
    print("=" * 60)
    t0 = time.time()

    # Step 1: Ingest MedQuAD if clean_corpus_v2.json does not exist
    corpus_path = DEFAULT_CONFIG.CLEAN_CORPUS_V2_PATH
    if not corpus_path.exists():
        print("clean_corpus_v2.json not found. Running MedQuAD ingestion...")
        ingest_medquad()
    else:
        print(f"Found clean corpus at: {corpus_path}")

    # Step 2: Load corpus and chunk
    with open(corpus_path, "r", encoding="utf-8") as f:
        corpus = json.load(f)

    print(f"\nChunking {len(corpus)} medical documents...")
    chunker = SemanticChunker(
        chunk_size_words=DEFAULT_CONFIG.CHUNK_SIZE_WORDS,
        overlap_words=DEFAULT_CONFIG.CHUNK_OVERLAP_WORDS,
        min_chunk_char_len=DEFAULT_CONFIG.MIN_CHUNK_CHAR_LEN
    )
    chunks = chunker.chunk_corpus(corpus)
    print(f"Generated {len(chunks)} non-redundant semantic chunks.")

    # Step 3: Build & Save BM25 Index
    print("\nBuilding BM25 Lexical Inverted Index...")
    bm25 = BM25Retriever()
    bm25.fit(chunks)
    bm25.save(DEFAULT_CONFIG.BM25_INDEX_PATH)
    print(f"BM25 index saved to: {DEFAULT_CONFIG.BM25_INDEX_PATH}")

    # Step 4: Build & Save FAISS Dense Index
    print("\nBuilding FAISS Dense Index...")
    indexer = FAISSIndexer()
    indexer.build_from_corpus(
        corpus_path=corpus_path,
        index_save_path=DEFAULT_CONFIG.FAISS_INDEX_PATH,
        meta_save_path=DEFAULT_CONFIG.METADATA_PATH,
        meta_json_path=DEFAULT_CONFIG.METADATA_JSON_PATH
    )

    t1 = time.time()
    print("\n" + "=" * 60)
    print(f"Indexing Complete! Total pipeline duration: {t1 - t0:.2f} seconds.")
    print("=" * 60)


if __name__ == "__main__":
    run_full_indexing_pipeline()
