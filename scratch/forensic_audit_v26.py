"""Forensic audit script for V2.6-A verification."""
import json
import pickle
import sys
import os
from pathlib import Path
from collections import Counter
import faiss

sys.path.insert(0, os.path.abspath("."))

def main():
    print("=== 8. METADATA <-> INDEX SYNCHRONIZATION ===")
    with open('rag_module/data/faiss_index/meta_v2.pkl', 'rb') as f:
        meta = pickle.load(f)

    index = faiss.read_index('rag_module/data/faiss_index/index_v2.bin')
    print(f"FAISS ntotal: {index.ntotal}, Metadata count: {len(meta)}")

    chunk_ids = [m.get('chunk_id') for m in meta]
    doc_ids = [m.get('document_id') for m in meta]
    print(f"Total chunk_ids: {len(chunk_ids)}, Unique chunk_ids: {len(set(chunk_ids))}")
    
    # Check duplicate chunk_ids by source
    chunk_id_counts = Counter(chunk_ids)
    dup_chunk_ids = {k: v for k, v in chunk_id_counts.items() if v > 1}
    print(f"Number of duplicated chunk_id values: {len(dup_chunk_ids)}")
    
    # Inspect sample duplicate chunk_ids
    sample_dups = list(dup_chunk_ids.keys())[:5]
    print("Sample duplicate chunk_ids:", sample_dups)
    for s_cid in sample_dups:
        records = [m for m in meta if m.get('chunk_id') == s_cid]
        print(f"  ChunkID '{s_cid}' appears {len(records)} times across docs: {[r.get('title') for r in records]}")

    # DailyMed chunk_ids uniqueness check
    dm_chunk_ids = [m.get('chunk_id') for m in meta if m.get('source_id') == 'DailyMed']
    print(f"DailyMed chunk_ids: {len(dm_chunk_ids)}, Unique DailyMed chunk_ids: {len(set(dm_chunk_ids))}")

    # MedQuAD chunk_ids uniqueness check
    mq_chunk_ids = [m.get('chunk_id') for m in meta if m.get('source_id') != 'DailyMed']
    print(f"MedQuAD chunk_ids: {len(mq_chunk_ids)}, Unique MedQuAD chunk_ids: {len(set(mq_chunk_ids))}")

    has_all_text = all(isinstance(m.get('text'), str) and len(m.get('text').strip()) > 0 for m in meta)
    print("All metadata records have non-empty text:", has_all_text)

    print("\n=== 9. PROVENANCE CHAIN KEYS INSPECTION ===")
    sample_dm = [m for m in meta if m.get('source_id') == 'DailyMed'][0]
    print("All keys present in DailyMed metadata record:")
    print(list(sample_dm.keys()))
    print("Metadata sub-dict keys in DailyMed record:")
    print(sample_dm.get('metadata', {}))

    # Also check KnowledgeChunk in artifacts/dailymed/chunks.json
    dm_chunks_json = json.load(open('rag_module/data/artifacts/dailymed/chunks.json', encoding='utf-8'))
    print("Keys in serialized KnowledgeChunk object (chunks.json):")
    print(list(dm_chunks_json[0].keys()))

    print("\n=== 13 & 14. INDEX ARTIFACT AND BM25 TYPE AUDIT ===")
    print("FAISS Index Class:", type(index).__name__)
    print("FAISS Metric Type:", index.metric_type, "(METRIC_INNER_PRODUCT = 0)")
    print("FAISS Dimension:", index.d)
    with open('rag_module/data/faiss_index/bm25_index.pkl', 'rb') as f:
        bm25 = pickle.load(f)
    print("BM25 Class:", type(bm25).__name__, "Module:", type(bm25).__module__)
    print("BM25 Corpus Size:", bm25.corpus_size)
    print("BM25 avg_doc_len:", bm25.avg_doc_len)
    print("BM25 k1:", bm25.k1, "b:", bm25.b)

if __name__ == '__main__':
    main()
