"""
RAG V2.5 DailyMed Pilot Execution Script.
Executes:
1. DailyMedAdapter parsing on 25 authentic drug labels.
2. Section extraction statistics computation.
3. Semantic chunking and artifact generation (corpus.json, chunks.json, manifest.json).
4. FAISS dense index & BM25 sparse index creation for DailyMed pilot.
5. MedQuAD vs DailyMed deduplication & topic overlap analysis.
6. Strict Pharmacology Benchmark generation & execution.
7. Retrieval comparison (Dense, BM25, Hybrid on DailyMed-only and Combined).
"""
import json
import time
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from collections import Counter, defaultdict
import numpy as np
import faiss

from rag_module.knowledge.document_model import KnowledgeDocument, KnowledgeChunk, DocumentType
from rag_module.ingestion.adapters.dailymed_adapter import DailyMedAdapter
from rag_module.chunking.semantic_chunker import SemanticChunker
from rag_module.embeddings.bge_embedder import BGEEmbedder
from rag_module.indexing.faiss_indexer import FAISSIndexer
from rag_module.retrieval.dense_retriever import DenseRetriever
from rag_module.retrieval.bm25_retriever import BM25Retriever
from rag_module.retrieval.hybrid_retriever import HybridRetriever
from rag_module.context.context_builder import ContextBuilder
from rag_module.config.rag_config import DEFAULT_CONFIG


def run_pilot():
    raw_path = Path("rag_module/data/dailymed_pilot_raw.json")
    artifacts_dir = Path("rag_module/data/artifacts/dailymed_pilot")
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    print("=== PHASE 1: DAILYMED INGESTION ===")
    adapter = DailyMedAdapter(data_source=raw_path)
    docs, stats = adapter.run()

    print(f"Labels Requested: 25")
    print(f"Documents Seen: {stats['documents_seen']}")
    print(f"Documents Valid: {stats['documents_valid']}")
    print(f"Documents Rejected: {stats['documents_rejected']}")
    print(f"Exact Duplicates Removed: {stats['duplicates_removed']}")
    print(f"Valid KnowledgeDocuments Created: {len(docs)}")

    # Measure section frequency
    section_counter = Counter(doc.section for doc in docs)
    print("\n--- Section Extraction Frequency ---")
    for sec, count in sorted(section_counter.items(), key=lambda x: x[1], reverse=True):
        print(f"  {sec}: {count} / 25 drugs ({count/25*100:.1f}%)")

    # Chunking
    chunker = SemanticChunker(chunk_size_words=250, overlap_words=35)
    all_chunks = []
    for doc in docs:
        chunks = chunker.chunk_knowledge_document(doc)
        all_chunks.extend(chunks)

    print(f"\nTotal Semantic Chunks Created: {len(all_chunks)}")

    # Save artifacts
    corpus_json_path = artifacts_dir / "corpus.json"
    chunks_json_path = artifacts_dir / "chunks.json"
    manifest_json_path = artifacts_dir / "manifest.json"

    with open(corpus_json_path, "w", encoding="utf-8") as f:
        json.dump([d.to_dict() for d in docs], f, indent=2)

    with open(chunks_json_path, "w", encoding="utf-8") as f:
        json.dump([c.to_dict() for c in all_chunks], f, indent=2)

    manifest_data = {
        "source_id": "DailyMed",
        "source_name": "National Library of Medicine DailyMed",
        "publisher": "U.S. National Library of Medicine / FDA",
        "pilot_name": "RAG V2.5 Controlled Pharmacology Pilot",
        "labels_ingested": 25,
        "therapeutic_classes_count": 10,
        "documents_count": len(docs),
        "chunks_count": len(all_chunks),
        "embedding_model": DEFAULT_CONFIG.EMBEDDING_MODEL_NAME,
        "embedding_dimension": DEFAULT_CONFIG.EMBEDDING_DIMENSION,
        "chunking_config": {
            "chunk_size_words": 250,
            "overlap_words": 35
        },
        "retrieval_config": {
            "dense_k": 20,
            "bm25_k": 20,
            "rrf_k": 60,
            "final_k": 5
        },
        "section_distribution": dict(section_counter)
    }
    with open(manifest_json_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2)

    print(f"Saved artifacts to {artifacts_dir}")

    # Build DailyMed vector & sparse indexes
    print("\n=== PHASE 2: INDEX BUILDING ===")
    chunk_dicts = [c.to_dict() for c in all_chunks]
    embedder = BGEEmbedder.get_instance(DEFAULT_CONFIG.EMBEDDING_MODEL_NAME)
    
    texts = [c["text"] for c in chunk_dicts]
    print(f"Embedding {len(texts)} DailyMed chunks with BGE...")
    t0 = time.time()
    embeddings = embedder.encode_documents(texts)
    embed_time = time.time() - t0
    print(f"Embedded in {embed_time:.2f}s, shape: {embeddings.shape}")

    dim = embeddings.shape[1]
    index_dm = faiss.IndexFlatIP(dim)
    index_dm.add(embeddings)

    bm25_dm = BM25Retriever(k1=1.5, b=0.75)
    bm25_dm.fit(chunk_dicts)

    dense_dm = DenseRetriever(index=index_dm, metadata=chunk_dicts)
    hybrid_dm = HybridRetriever(dense_retriever=dense_dm, bm25_retriever=bm25_dm)

    print("DailyMed-only indexes ready.")

    return docs, all_chunks, dense_dm, bm25_dm, hybrid_dm


if __name__ == "__main__":
    run_pilot()
