"""
Unified Knowledge Base Builder and Multi-Source Indexer.
Runs full multi-source ingestion orchestrator and builds FAISS + BM25 index.
"""
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import json
from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.ingestion.orchestrator import MultiSourceOrchestrator
from rag_module.indexing.faiss_indexer import FAISSIndexer
from rag_module.retrieval.bm25_retriever import BM25Retriever

def build_unified_kb():
    print("=" * 60)
    print("STEP 1: Multi-Source Knowledge Ingestion Orchestration")
    print("=" * 60)
    
    orchestrator = MultiSourceOrchestrator(
        artifacts_root=DEFAULT_CONFIG.ARTIFACTS_DIR
    )
    
    # Run ingestion across all registered authoritative sources
    combined_result = orchestrator.ingest_all(combine=True)
    print(f"\nIngestion Complete!")
    print(f"Total Sources Ingested: {len(combined_result.stats.get('sources', {}))}")
    print(f"Total Documents: {len(combined_result.documents)}")
    print(f"Total Chunks: {len(combined_result.chunks)}")
    
    combined_chunks_path = DEFAULT_CONFIG.ARTIFACTS_DIR / "combined" / "chunks.json"
    with open(combined_chunks_path, "r", encoding="utf-8") as f:
        all_chunks = json.load(f)
        
    print("\n" + "=" * 60)
    print(f"STEP 2: Building BM25 Index on {len(all_chunks)} chunks...")
    print("=" * 60)
    bm25 = BM25Retriever()
    bm25.fit(all_chunks)
    bm25.save(DEFAULT_CONFIG.BM25_INDEX_PATH)
    print(f"BM25 Index saved to {DEFAULT_CONFIG.BM25_INDEX_PATH}")
    
    print("\n" + "=" * 60)
    print(f"STEP 3: Building FAISS Dense Index on {len(all_chunks)} chunks...")
    print("=" * 60)
    indexer = FAISSIndexer()
    indexer.build_from_chunks(
        chunks=all_chunks,
        index_save_path=DEFAULT_CONFIG.FAISS_INDEX_PATH,
        meta_save_path=DEFAULT_CONFIG.METADATA_PATH,
        meta_json_path=DEFAULT_CONFIG.METADATA_JSON_PATH
    )
    print(f"FAISS Index saved to {DEFAULT_CONFIG.FAISS_INDEX_PATH}")
    
    print("\n" + "=" * 60)
    print("STEP 4: Verifying Index Load and Sample Query")
    print("=" * 60)
    from rag_module.retrieval.hybrid_retriever import HybridRetriever
    from rag_module.retrieval.dense_retriever import DenseRetriever
    
    dense = DenseRetriever()
    hybrid = HybridRetriever(dense_retriever=dense, bm25_retriever=bm25)
    
    sample_queries = [
        ("What are the contraindications for lisinopril in pregnancy?", None),
        ("First line treatment for acute asthma exacerbation", ["ICMR", "MoHFW_STG"]),
        ("Metformin adverse effects and lactic acidosis", ["DailyMed"]),
    ]
    
    for q, s_filter in sample_queries:
        print(f"\nQuery: '{q}' | Filter: {s_filter}")
        results = hybrid.search(query=q, final_k=3, source_filter=s_filter)
        for idx, r in enumerate(results):
            print(f"  [{idx+1}] Source: {r.get('source_id')} | Doc: {r.get('doc_id')} | Score: {r.get('score', 0):.4f}")
            print(f"      Section: {r.get('metadata', {}).get('section')} | Drug: {r.get('metadata', {}).get('drug_name')}")
            snippet = r.get('text', '')[:120].replace('\n', ' ')
            print(f"      Snippet: {snippet}...")

if __name__ == "__main__":
    build_unified_kb()
