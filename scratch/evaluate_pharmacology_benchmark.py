"""
RAG V2.5 Phase 6: Strict Pharmacology Benchmark Evaluation.
Evaluates 45 strict pharmacology queries across 6 retrieval regimes:
A. DailyMed-only Dense
B. DailyMed-only BM25
C. DailyMed-only Hybrid
D. Combined MedQuAD + DailyMed Dense
E. Combined MedQuAD + DailyMed BM25
F. Combined MedQuAD + DailyMed Hybrid
G. CrossEncoder Reranker Status Check
"""
import json
import time
import sys
from pathlib import Path
from typing import List, Dict, Any, Tuple
import numpy as np
import faiss

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from rag_module.embeddings.bge_embedder import BGEEmbedder
from rag_module.indexing.faiss_indexer import FAISSIndexer
from rag_module.retrieval.dense_retriever import DenseRetriever
from rag_module.retrieval.bm25_retriever import BM25Retriever
from rag_module.retrieval.hybrid_retriever import HybridRetriever
from rag_module.reranking.cross_encoder_reranker import CrossEncoderReranker
from rag_module.config.rag_config import DEFAULT_CONFIG


def is_hit(chunk: Dict[str, Any], query_item: Dict[str, Any], strict_doc_id: bool = False) -> bool:
    """Evaluates whether retrieved chunk matches gold evidence."""
    exp_doc_id = query_item["expected_document_id"]
    if chunk.get("document_id") == exp_doc_id:
        return True
    
    if strict_doc_id:
        return False

    # Section-level matching: same drug AND expected section
    chunk_drug = (chunk.get("metadata", {}).get("drug_name") or chunk.get("title", "")).lower()
    exp_drug = query_item["expected_drug"].lower()
    chunk_sec = chunk.get("section", "").lower()
    exp_secs = [s.lower() for s in query_item["expected_sections"]]

    if exp_drug in chunk_drug and any(s in chunk_sec or chunk_sec in s for s in exp_secs):
        return True
    return False


def evaluate_retriever(
    name: str,
    benchmark: List[Dict[str, Any]],
    search_fn,
    top_ks: List[int] = [1, 3, 5, 10]
) -> Dict[str, Any]:
    """Runs benchmark through a search function and calculates Recall@k, MRR, latency."""
    recalls = {k: 0 for k in top_ks}
    recalls_strict = {k: 0 for k in top_ks}
    reciprocal_ranks = []
    latencies = []

    for item in benchmark:
        q = item["query"]
        t0 = time.perf_counter()
        results = search_fn(q, max(top_ks))
        latency = (time.perf_counter() - t0) * 1000.0
        latencies.append(latency)

        # Find first rank of hit
        hit_rank = 0
        for rank, chunk in enumerate(results, start=1):
            if is_hit(chunk, item):
                hit_rank = rank
                break

        if hit_rank > 0:
            reciprocal_ranks.append(1.0 / hit_rank)
            for k in top_ks:
                if hit_rank <= k:
                    recalls[k] += 1
        else:
            reciprocal_ranks.append(0.0)

        # Strict Doc-ID hit check
        hit_rank_strict = 0
        for rank, chunk in enumerate(results, start=1):
            if is_hit(chunk, item, strict_doc_id=True):
                hit_rank_strict = rank
                break
        if hit_rank_strict > 0:
            for k in top_ks:
                if hit_rank_strict <= k:
                    recalls_strict[k] += 1

    total = len(benchmark)
    metrics = {
        "regime": name,
        "total_queries": total,
        "recall_at_1": round(recalls[1] / total * 100, 2),
        "recall_at_3": round(recalls[3] / total * 100, 2),
        "recall_at_5": round(recalls[5] / total * 100, 2),
        "recall_at_10": round(recalls[10] / total * 100, 2),
        "strict_docid_recall_at_1": round(recalls_strict[1] / total * 100, 2),
        "strict_docid_recall_at_5": round(recalls_strict[5] / total * 100, 2),
        "mrr": round(float(np.mean(reciprocal_ranks)), 4),
        "mean_latency_ms": round(float(np.mean(latencies)), 2)
    }
    return metrics


def run_all_evaluations():
    benchmark_path = Path("rag_module/evaluation/pharmacology_benchmark.json")
    with open(benchmark_path, "r", encoding="utf-8") as f:
        benchmark = json.load(f)

    print(f"Loaded {len(benchmark)} strict pharmacology benchmark queries.")

    # 1. Load DailyMed pilot chunks
    dm_chunks_path = Path("rag_module/data/artifacts/dailymed_pilot/chunks.json")
    with open(dm_chunks_path, "r", encoding="utf-8") as f:
        dm_chunks = json.load(f)

    # 2. Load Combined Chunks (MedQuAD + DailyMed)
    # MedQuAD chunks
    with open(DEFAULT_CONFIG.METADATA_JSON_PATH, "r", encoding="utf-8") as f:
        medquad_chunks = json.load(f)

    combined_chunks = medquad_chunks + dm_chunks
    print(f"Corpus Sizes: DailyMed={len(dm_chunks)}, MedQuAD={len(medquad_chunks)}, Combined={len(combined_chunks)}")

    embedder = BGEEmbedder.get_instance(DEFAULT_CONFIG.EMBEDDING_MODEL_NAME)

    # Build DailyMed Embeddings & Index
    dm_texts = [c["text"] for c in dm_chunks]
    dm_embeddings = embedder.encode_documents(dm_texts, show_progress_bar=False)
    dm_index = faiss.IndexFlatIP(384)
    dm_index.add(dm_embeddings)

    dm_dense = DenseRetriever(index=dm_index, metadata=dm_chunks)
    dm_bm25 = BM25Retriever(k1=1.5, b=0.75)
    dm_bm25.fit(dm_chunks)
    dm_hybrid = HybridRetriever(dense_retriever=dm_dense, bm25_retriever=dm_bm25)

    # Load Existing FAISS Index for MedQuAD and Add DailyMed to Combined
    mq_index, _ = FAISSIndexer.load_index(DEFAULT_CONFIG.FAISS_INDEX_PATH, DEFAULT_CONFIG.METADATA_PATH)
    combined_index = faiss.IndexFlatIP(384)
    # Reconstruct vectors from existing index or use BGE to embed combined if needed
    # Note: FAISS IndexFlatIP allows reconstructing all vectors
    mq_vectors = mq_index.reconstruct_n(0, mq_index.ntotal)
    combined_vectors = np.vstack([mq_vectors, dm_embeddings])
    combined_index.add(combined_vectors)

    comb_dense = DenseRetriever(index=combined_index, metadata=combined_chunks)
    comb_bm25 = BM25Retriever(k1=1.5, b=0.75)
    print("Fitting BM25 on combined 23,708 chunks...")
    comb_bm25.fit(combined_chunks)
    comb_hybrid = HybridRetriever(dense_retriever=comb_dense, bm25_retriever=comb_bm25)

    # Search adaptors returning chunk dicts
    def dm_dense_search(q, k):
        res = dm_dense.search(q, top_k=k)
        return [dm_dense.get_chunk(idx) for idx, _ in res]

    def dm_bm25_search(q, k):
        res = dm_bm25.search(q, top_k=k)
        return [dm_bm25.metadata[idx] for idx, _ in res]

    def dm_hybrid_search(q, k):
        return dm_hybrid.search(q, dense_k=k, bm25_k=k, final_k=k)

    def comb_dense_search(q, k):
        res = comb_dense.search(q, top_k=k)
        return [comb_dense.get_chunk(idx) for idx, _ in res]

    def comb_bm25_search(q, k):
        res = comb_bm25.search(q, top_k=k)
        return [comb_bm25.metadata[idx] for idx, _ in res]

    def comb_hybrid_search(q, k):
        return comb_hybrid.search(q, dense_k=k, bm25_k=k, final_k=k)

    # Check Reranker
    reranker = CrossEncoderReranker()
    reranker_model = reranker._get_model()
    reranker_status = "ACTIVE" if reranker_model is not None else "FALLBACK (Pass-Through)"

    def comb_hybrid_rerank_search(q, k):
        candidates = comb_hybrid.search(q, dense_k=k*2, bm25_k=k*2, final_k=k*2)
        return reranker.rerank(q, candidates, top_k=k)

    print("\n=== EXECUTING RETRIEVAL BENCHMARK REGIMES ===")
    results = []
    
    res_a = evaluate_retriever("A. DailyMed Dense", benchmark, dm_dense_search)
    results.append(res_a)
    print("Regime A complete:", res_a)

    res_b = evaluate_retriever("B. DailyMed BM25", benchmark, dm_bm25_search)
    results.append(res_b)
    print("Regime B complete:", res_b)

    res_c = evaluate_retriever("C. DailyMed Hybrid", benchmark, dm_hybrid_search)
    results.append(res_c)
    print("Regime C complete:", res_c)

    res_d = evaluate_retriever("D. Combined Dense", benchmark, comb_dense_search)
    results.append(res_d)
    print("Regime D complete:", res_d)

    res_e = evaluate_retriever("E. Combined BM25", benchmark, comb_bm25_search)
    results.append(res_e)
    print("Regime E complete:", res_e)

    res_f = evaluate_retriever("F. Combined Hybrid", benchmark, comb_hybrid_search)
    results.append(res_f)
    print("Regime F complete:", res_f)

    res_g = evaluate_retriever(f"G. Combined Hybrid + Reranker ({'Active' if reranker_model is not None else 'Fallback'})", benchmark, comb_hybrid_rerank_search)
    results.append(res_g)
    print("Regime G complete:", res_g)

    # Output comparison table
    print("\n" + "="*85)
    print(f"{'Regime':<25} | {'R@1 (%)':<8} | {'R@3 (%)':<8} | {'R@5 (%)':<8} | {'R@10 (%)':<8} | {'MRR':<8} | {'Latency (ms)':<12}")
    print("="*85)
    for r in results:
        print(f"{r['regime']:<25} | {r['recall_at_1']:<8.1f} | {r['recall_at_3']:<8.1f} | {r['recall_at_5']:<8.1f} | {r['recall_at_10']:<8.1f} | {r['mrr']:<8.4f} | {r['mean_latency_ms']:<12.2f}")
    print("="*85)
    print(f"CrossEncoder Reranker Status: {reranker_status}")

    # Save results to artifacts
    eval_out_path = Path("rag_module/data/artifacts/dailymed_pilot/evaluation_results.json")
    with open(eval_out_path, "w", encoding="utf-8") as f:
        json.dump({"reranker_status": reranker_status, "regimes": results}, f, indent=2)

    return results


if __name__ == "__main__":
    run_all_evaluations()
