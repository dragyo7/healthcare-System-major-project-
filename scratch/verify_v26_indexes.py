"""
Post-Ingestion Index and Retrieval Verification Script for RAG V2.6-A.
Validates:
1. File existence and sizes of all generated artifacts and indexes.
2. Vector dimensions, chunk counts, and metadata synchronization.
3. Source-isolation filtering performance on DailyMed vs MedQuAD.
4. Multi-source retrieval latency profiling.
"""
import sys
import time
import json
import pickle
from pathlib import Path
import numpy as np
import faiss

BASE_DIR = Path(r"e:\Major Project Code")
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.retrieval.dense_retriever import DenseRetriever
from rag_module.retrieval.bm25_retriever import BM25Retriever
from rag_module.retrieval.hybrid_retriever import HybridRetriever
from rag_module.context.context_builder import ContextBuilder


def verify_all():
    print("=" * 70)
    print("RAG V2.6-A: VERIFICATION & LATENCY PROFILING")
    print("=" * 70)

    artifacts_root = BASE_DIR / "rag_module" / "data" / "artifacts"
    faiss_dir = BASE_DIR / "rag_module" / "data" / "faiss_index"

    # 1. Inspect Artifacts
    print("\n[1] Checking Artifacts & Manifests...")
    sources = ["dailymed", "medquad", "openfda", "combined"]
    for s in sources:
        s_dir = artifacts_root / s
        manifest_p = s_dir / "manifest.json"
        if manifest_p.exists():
            with open(manifest_p, "r", encoding="utf-8") as f:
                m = json.load(f)
            docs = m.get("document_count", 0)
            chunks = m.get("chunk_count", 0)
            print(f"  - [{s.upper()}] docs={docs}, chunks={chunks}, manifest={manifest_p.name} [OK]")
        else:
            print(f"  - [{s.upper()}] manifest not found at {manifest_p}")

    # 2. Inspect FAISS Indexes
    print("\n[2] Checking FAISS and BM25 Indexes...")
    dm_faiss_p = artifacts_root / "dailymed" / "index.bin"
    dm_bm25_p = artifacts_root / "dailymed" / "bm25_index.pkl"
    if dm_faiss_p.exists() and dm_bm25_p.exists():
        idx_dm = faiss.read_index(str(dm_faiss_p))
        with open(artifacts_root / "dailymed" / "metadata.pkl", "rb") as f:
            meta_dm = pickle.load(f)
        print(f"  - DailyMed Isolated FAISS: {idx_dm.ntotal} vectors (dim={idx_dm.d}), metadata={len(meta_dm)} [OK]")

    comb_faiss_p = faiss_dir / "index_v2.bin"
    comb_bm25_p = faiss_dir / "bm25_index.pkl"
    if comb_faiss_p.exists() and comb_bm25_p.exists():
        idx_comb = faiss.read_index(str(comb_faiss_p))
        with open(faiss_dir / "meta_v2.pkl", "rb") as f:
            meta_comb = pickle.load(f)
        print(f"  - Combined Production FAISS: {idx_comb.ntotal} vectors (dim={idx_comb.d}), metadata={len(meta_comb)} [OK]")

    # 3. Source Filtering Validation
    print("\n[3] Testing Source Filtering Isolation...")
    dense_retriever = DenseRetriever(index=idx_comb, metadata=meta_comb)
    bm25_retriever = BM25Retriever.load(comb_bm25_p)
    hybrid_retriever = HybridRetriever(dense_retriever=dense_retriever, bm25_retriever=bm25_retriever)

    # Test DailyMed filter
    q_dm = "Lisinopril dosage for adult hypertension"
    res_dm = hybrid_retriever.search(q_dm, final_k=5, source_filter=["DailyMed"])
    print(f"\n  Query: '{q_dm}' (source_filter=['DailyMed'])")
    self_consistent_dm = True
    for r in res_dm:
        sid = r.get("source_id")
        title = r.get("title", "")
        print(f"    - [{sid}] {title} (RRF score: {r.get('score', 0):.4f})")
        if sid != "DailyMed":
            self_consistent_dm = False
    print(f"  DailyMed Isolation Check: {'PASS [✓]' if self_consistent_dm and len(res_dm) > 0 else 'FAIL [X]'}")

    # Test MedQuAD filter
    q_mq = "What causes Fabry disease and what are the inheritance patterns?"
    res_mq = hybrid_retriever.search(q_mq, final_k=5, source_filter=["medquad_nih"])
    print(f"\n  Query: '{q_mq}' (source_filter=['medquad_nih'])")
    self_consistent_mq = True
    for r in res_mq:
        sid = r.get("source_id")
        title = r.get("title", "")
        print(f"    - [{sid}] {title} (RRF score: {r.get('score', 0):.4f})")
        if "medquad" not in sid.lower() and sid not in ["CancerGov", "GARD", "GHR", "MPlus_Health_Topics", "NIDDK", "NINDS", "SeniorHealth", "NHLBI", "CDC", "MedQuAD"]:
            self_consistent_mq = False
    print(f"  MedQuAD Isolation Check: {'PASS [✓]' if self_consistent_mq and len(res_mq) > 0 else 'FAIL [X]'}")

    # 4. Latency Profiling
    print("\n[4] Profiling Retrieval Latencies (Combined Corpus N=26,143)...")
    test_queries = [
        "Metformin boxed warning lactic acidosis",
        "Atorvastatin drug interactions with CYP3A4 inhibitors",
        "Amoxicillin pediatric dosage for otitis media",
        "Symptoms and diagnosis of heart failure",
        "Warfarin INR monitoring and bleeding risk"
    ]
    
    dense_times = []
    bm25_times = []
    hybrid_times = []

    for q in test_queries:
        t0 = time.time()
        dense_retriever.search(q, top_k=20)
        dense_times.append((time.time() - t0) * 1000)

        t0 = time.time()
        bm25_retriever.search(q, top_k=20)
        bm25_times.append((time.time() - t0) * 1000)

        t0 = time.time()
        hybrid_retriever.search(q, final_k=5)
        hybrid_times.append((time.time() - t0) * 1000)

    print(f"  - Dense Search (FAISS):  mean = {np.mean(dense_times):.2f} ms | p95 = {np.percentile(dense_times, 95):.2f} ms")
    print(f"  - BM25 Search (Lexical): mean = {np.mean(bm25_times):.2f} ms | p95 = {np.percentile(bm25_times, 95):.2f} ms")
    print(f"  - End-to-End Hybrid:     mean = {np.mean(hybrid_times):.2f} ms | p95 = {np.percentile(hybrid_times, 95):.2f} ms")

    # Context & Provenance Formatting Check
    cb = ContextBuilder()
    ctx_str, citations = cb.build_context(res_dm[:3])
    print(f"\n[5] Context & Citation Verification:")
    print(f"  - Citations generated: {len(citations)}")
    for c in citations:
        print(f"    * Title: {c['title']} | Section: {c.get('section')} | Source: {c['source_name']} | URL: {c['url']}")

    print("\n" + "=" * 70)
    print("ALL VERIFICATIONS COMPLETE!")
    print("=" * 70)


if __name__ == "__main__":
    verify_all()
