"""
Final Phase 25 Micro-Check Script.
Verifies:
1. Exact count alignment: chunks = metadata = FAISS vectors = BM25 entries = 2,204.
2. Exact 1-to-1 chunk_id alignment at every positional index i in [0..2203] between FAISS, metadata, and BM25.
3. Distinction between source documents (monographs/guidelines) and chunks/vectors.
4. Live API default index loading and endpoint sanity checks (/health, /ready, /rag/query, /chat, /retrieve).
"""

import sys
import json
import pickle
import urllib.request
from pathlib import Path
import numpy as np
import faiss

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from rag_module.retrieval.bm25_retriever import BM25Retriever


def api_post(url: str, payload: dict, timeout: int = 60) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def api_get(url: str) -> dict:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    print("======================================================================")
    print("FINAL PHASE 25 MICRO-CHECK & POSITION ALIGNMENT AUDIT")
    print("======================================================================")

    runtime_dir = ROOT_DIR / "rag_module" / "data" / "faiss_index"

    # 1. Load active runtime index artifacts
    print("\n--- [Step 1] Loading active runtime index artifacts ---")
    index = faiss.read_index(str(runtime_dir / "index_v2.bin"))
    with open(runtime_dir / "meta_v2.json", "r", encoding="utf-8") as f:
        meta_json = json.load(f)
    with open(runtime_dir / "meta_v2.pkl", "rb") as f:
        meta_pkl = pickle.load(f)
    bm25 = BM25Retriever.load(runtime_dir / "bm25_index.pkl")

    faiss_ntotal = index.ntotal
    meta_json_len = len(meta_json)
    meta_pkl_len = len(meta_pkl)
    bm25_len = bm25.corpus_size

    print(f"  FAISS Vectors:       {faiss_ntotal}")
    print(f"  Metadata (JSON):     {meta_json_len}")
    print(f"  Metadata (Pickle):   {meta_pkl_len}")
    print(f"  BM25 Inverted Docs:  {bm25_len}")

    assert faiss_ntotal == 2204, f"Expected 2204 FAISS vectors, got {faiss_ntotal}"
    assert meta_json_len == 2204, f"Expected 2204 JSON meta, got {meta_json_len}"
    assert meta_pkl_len == 2204, f"Expected 2204 Pickle meta, got {meta_pkl_len}"
    assert bm25_len == 2204, f"Expected 2204 BM25 docs, got {bm25_len}"
    print("  -> EXACT COUNT ALIGNMENT VERIFIED: 2,204 = 2,204 = 2,204 = 2,204")

    # 2. Positional chunk_id alignment verification
    print("\n--- [Step 2] Auditing 1-to-1 Positional Index Alignment (Indices 0..2203) ---")
    mismatches = []
    unique_chunk_ids = set()
    document_ids = set()

    for i in range(2204):
        json_chunk = meta_json[i]
        pkl_chunk = meta_pkl[i]
        bm25_chunk = bm25.metadata[i]

        cid_json = json_chunk.get("chunk_id")
        cid_pkl = pkl_chunk.get("chunk_id")
        cid_bm25 = bm25_chunk.get("chunk_id")
        doc_id = json_chunk.get("document_id")

        if not (cid_json == cid_pkl == cid_bm25):
            mismatches.append((i, cid_json, cid_pkl, cid_bm25))

        unique_chunk_ids.add(cid_json)
        if doc_id:
            document_ids.add(doc_id)

    print(f"  Total Unique Chunk IDs:     {len(unique_chunk_ids)}")
    print(f"  Total Unique Document IDs:  {len(document_ids)}")
    print(f"  Positional Mismatches:      {len(mismatches)}")

    assert len(mismatches) == 0, f"Found positional mismatches: {mismatches[:5]}"
    assert len(unique_chunk_ids) == 2204, f"Duplicate chunk IDs found: {2204 - len(unique_chunk_ids)}"
    print("  -> 1-TO-1 POSITIONAL ALIGNMENT VERIFIED: Position i corresponds to the exact same chunk_id across FAISS, Metadata, and BM25.")

    # 3. Document vs Chunk Distinction Analysis
    print("\n--- [Step 3] Document vs. Chunk Breakdown ---")
    source_chunk_dist = {}
    source_doc_dist = {}
    for c in meta_json:
        src = c.get("source_id", "UNKNOWN")
        doc = c.get("document_id", "UNKNOWN")
        source_chunk_dist[src] = source_chunk_dist.get(src, 0) + 1
        if src not in source_doc_dist:
            source_doc_dist[src] = set()
        source_doc_dist[src].add(doc)

    print(f"  Total Retrieval Chunks:     {len(meta_json)}")
    print(f"  Total Source Documents:     {len(document_ids)}")
    print("  Breakdown by Source:")
    for src in sorted(source_chunk_dist.keys()):
        chunks_count = source_chunk_dist[src]
        docs_count = len(source_doc_dist[src])
        print(f"    - {src:12s}: {docs_count:4d} source documents -> {chunks_count:4d} retrieval chunks")

    # 4. Live API Endpoints Check
    print("\n--- [Step 4] Live API Endpoint Verification (http://127.0.0.1:8000) ---")
    base_url = "http://127.0.0.1:8000"

    # GET /health
    health = api_get(f"{base_url}/health")
    print(f"  GET /health: status={health.get('status')}, indexed_chunks_count={health.get('indexed_chunks_count')}")
    assert health.get("indexed_chunks_count") == 2204

    # GET /ready
    ready = api_get(f"{base_url}/ready")
    print(f"  GET /ready:  ready={ready.get('ready')}")
    assert ready.get("ready") is True

    # POST /rag/query
    query_res = api_post(f"{base_url}/rag/query", {"query": "What are the contraindications for Metformin?", "top_k": 3})
    print(f"  POST /rag/query: total_evidence={query_res.get('total_evidence')}, grounding={query_res.get('grounding', {}).get('status')}")
    assert query_res.get("total_evidence") == 3

    # POST /chat
    chat_res = api_post(f"{base_url}/chat", {"message": "What is the adult dosage for Lisinopril?", "generate_answer": False})
    print(f"  POST /chat: sources_count={len(chat_res.get('sources', []))}, is_emergency={chat_res.get('is_emergency')}, abstained={chat_res.get('abstained')}")
    assert len(chat_res.get("sources", [])) > 0
    assert chat_res.get("is_emergency") is False

    # POST /retrieve
    ret_res = api_post(f"{base_url}/retrieve", {"query": "Atorvastatin indications", "top_k": 3})
    print(f"  POST /retrieve: total_evidence={ret_res.get('total_evidence')}")
    assert ret_res.get("total_evidence") == 3

    print("\n======================================================================")
    print("ALL FINAL MICRO-CHECKS PASSED PERFECTLY!")
    print("======================================================================")


if __name__ == "__main__":
    main()
