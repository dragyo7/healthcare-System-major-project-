"""
Quantitative Medical RAG Benchmark & Retrieval Evaluation Suite (V2.6-B).
Provides exact ID-based and graded-relevance metrics: Recall@K, MRR, nDCG@K,
Source Accuracy@1, Entity Accuracy@1, Section Precision@1, and Latency.
"""

import json
import math
import sys
import time
import statistics
from pathlib import Path
from typing import List, Dict, Any, Optional, Set, Tuple

# Ensure workspace root is in path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.rag_pipeline import MedicalRAGPipeline
from rag_module.evaluation.failure_analyzer import analyze_query_outcome, summarize_failures


def compute_dcg_at_k(grades: List[int], k: int) -> float:
    """Computes Discounted Cumulative Gain at rank K using exponential gain formula."""
    dcg = 0.0
    for i, g in enumerate(grades[:k]):
        gain = (2.0 ** g) - 1.0
        discount = math.log2(i + 2)  # i=0 -> log2(2)=1.0
        dcg += gain / discount
    return dcg


def compute_ndcg_at_k(retrieved_grades: List[int], ideal_grades: List[int], k: int) -> float:
    """Computes Normalized Discounted Cumulative Gain at rank K."""
    if not ideal_grades or max(ideal_grades) == 0:
        return 0.0
    
    dcg = compute_dcg_at_k(retrieved_grades, k)
    sorted_ideal = sorted(ideal_grades, reverse=True)
    idcg = compute_dcg_at_k(sorted_ideal, k)
    
    if idcg <= 0.0:
        return 0.0
    return dcg / idcg


class RAGEvaluator:
    """
    Automated benchmark evaluation runner with exact ID and graded-relevance support.
    """
    def __init__(
        self,
        pipeline: Optional[MedicalRAGPipeline] = None,
        benchmark_path: Optional[Path] = None
    ):
        self.pipeline = pipeline or MedicalRAGPipeline()
        v26_path = DEFAULT_CONFIG.BASE_DIR / "evaluation" / "v26_benchmark_dataset.json"
        legacy_path = DEFAULT_CONFIG.BASE_DIR / "evaluation" / "benchmark_dataset.json"
        
        if benchmark_path is not None:
            self.benchmark_path = benchmark_path
        elif v26_path.exists():
            self.benchmark_path = v26_path
        else:
            self.benchmark_path = legacy_path

    def load_dataset(self) -> List[Dict[str, Any]]:
        """Load benchmark dataset from file."""
        if not self.benchmark_path.exists():
            raise FileNotFoundError(f"Benchmark dataset not found at: {self.benchmark_path}")
        with open(self.benchmark_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def retrieve_candidates(
        self,
        query_text: str,
        mode: str = "hybrid",
        top_k: int = 10
    ) -> Tuple[List[Dict[str, Any]], float]:
        """
        Execute candidate retrieval using requested mode and return candidates with latency.
        """
        t0 = time.perf_counter()
        
        if mode == "dense":
            if self.pipeline.dense_retriever:
                raw_res = self.pipeline.dense_retriever.search(query_text, top_k=top_k)
                chunks = [self.pipeline.dense_retriever.metadata[idx] for idx, _ in raw_res]
            else:
                chunks = []
        elif mode == "bm25":
            if self.pipeline.bm25_retriever:
                raw_res = self.pipeline.bm25_retriever.search(query_text, top_k=top_k)
                chunks = [self.pipeline.bm25_retriever.metadata[idx] for idx, _ in raw_res]
            else:
                chunks = []
        elif mode in ("hybrid", "hybrid_rerank"):
            if self.pipeline.hybrid_retriever:
                chunks = self.pipeline.hybrid_retriever.search(query_text, final_k=top_k)
                if mode == "hybrid_rerank" and self.pipeline.reranker:
                    chunks = self.pipeline.reranker.rerank(query_text, chunks, top_k=top_k)
            else:
                chunks = []
        else:
            chunks = []

        t1 = time.perf_counter()
        latency_ms = (t1 - t0) * 1000.0
        return chunks, latency_ms

    def evaluate_query(
        self,
        query_item: Dict[str, Any],
        retrieved_chunks: List[Dict[str, Any]],
        top_k: int = 10,
        scope: str = "production"
    ) -> Dict[str, Any]:
        """
        Evaluate single query against exact ground truth and graded relevance.
        """
        applicable_scopes = query_item.get("applicable_scopes", ["production"])
        is_applicable = (scope in applicable_scopes)

        if not is_applicable:
            diag = analyze_query_outcome(query_item, retrieved_chunks, top_k=top_k, is_applicable=False)
            return {
                "query_id": query_item["query_id"],
                "category": query_item.get("category", "General"),
                "is_applicable": False,
                "status": "NOT_APPLICABLE",
                "recall@1": None,
                "recall@3": None,
                "recall@5": None,
                "recall@10": None,
                "mrr": None,
                "ndcg@5": None,
                "ndcg@10": None,
                "source_acc@1": None,
                "entity_acc@1": None,
                "section_prec@1": None,
                "diagnostic": diag
            }

        gt_list = query_item.get("ground_truth", [])
        gt_chunk_ids = {gt["chunk_id"] for gt in gt_list}
        gt_doc_ids = {gt["document_id"] for gt in gt_list}
        gt_grade_map = {gt["chunk_id"]: gt.get("relevance_grade", 3) for gt in gt_list}
        for gt in gt_list:
            gt_grade_map[gt["document_id"]] = gt.get("relevance_grade", 3)

        ideal_grades = [gt.get("relevance_grade", 3) for gt in gt_list]
        target_entity = query_item.get("target_entity", "").strip().lower()
        target_section = query_item.get("target_section", "").strip().lower()
        acceptable_entities = [e.strip().lower() for e in query_item.get("acceptable_entities", [target_entity])]
        acceptable_sources = [s.strip() for s in query_item.get("acceptable_sources", [])]

        retrieved_cids = []
        retrieved_dids = []
        retrieved_grades = []

        hit_rank = 0
        for rank, chunk in enumerate(retrieved_chunks[:top_k], start=1):
            cid = chunk.get("chunk_id") or chunk.get("metadata", {}).get("chunk_id")
            did = chunk.get("document_id") or chunk.get("doc_id") or chunk.get("metadata", {}).get("document_id")
            retrieved_cids.append(cid)
            retrieved_dids.append(did)

            grade = 0
            if cid in gt_grade_map:
                grade = gt_grade_map[cid]
            elif did in gt_grade_map:
                grade = gt_grade_map[did]
            retrieved_grades.append(grade)

            if hit_rank == 0 and (cid in gt_chunk_ids or did in gt_doc_ids):
                hit_rank = rank

        # Top-1 metadata evaluation
        source_acc_1 = 0.0
        entity_acc_1 = 0.0
        section_prec_1 = 0.0

        if retrieved_chunks:
            top_1 = retrieved_chunks[0]
            top_1_meta = top_1.get("metadata", top_1)
            top_1_src = top_1.get("source_id") or top_1_meta.get("source_id")
            top_1_title = (top_1.get("title") or top_1_meta.get("title", "")).lower()
            top_1_focus = (top_1.get("focus") or top_1_meta.get("focus", "")).lower()
            top_1_text = top_1_title + " " + top_1_focus
            top_1_sec = (top_1.get("section") or top_1_meta.get("section") or top_1_meta.get("qtype") or "").lower()

            if acceptable_sources and top_1_src in acceptable_sources:
                source_acc_1 = 1.0
            elif not acceptable_sources:
                source_acc_1 = 1.0

            if any(ent in top_1_text for ent in acceptable_entities):
                entity_acc_1 = 1.0

            if target_section in top_1_sec or top_1_sec in target_section:
                section_prec_1 = 1.0

        rec1 = 1.0 if hit_rank == 1 else 0.0
        rec3 = 1.0 if 1 <= hit_rank <= 3 else 0.0
        rec5 = 1.0 if 1 <= hit_rank <= 5 else 0.0
        rec10 = 1.0 if 1 <= hit_rank <= 10 else 0.0
        mrr_val = 1.0 / hit_rank if hit_rank > 0 else 0.0

        ndcg5 = compute_ndcg_at_k(retrieved_grades, ideal_grades, k=5)
        ndcg10 = compute_ndcg_at_k(retrieved_grades, ideal_grades, k=10)

        diag = analyze_query_outcome(query_item, retrieved_chunks, top_k=top_k, is_applicable=True)

        return {
            "query_id": query_item["query_id"],
            "category": query_item.get("category", "General"),
            "is_applicable": True,
            "status": diag["category"],
            "hit_rank": hit_rank if hit_rank > 0 else None,
            "recall@1": rec1,
            "recall@3": rec3,
            "recall@5": rec5,
            "recall@10": rec10,
            "mrr": mrr_val,
            "ndcg@5": round(ndcg5, 4),
            "ndcg@10": round(ndcg10, 4),
            "source_acc@1": source_acc_1,
            "entity_acc@1": entity_acc_1,
            "section_prec@1": section_prec_1,
            "diagnostic": diag
        }

    def run_benchmark(
        self,
        modes: List[str] = ["dense", "bm25", "hybrid", "hybrid_rerank"],
        scope: str = "production",
        top_k: int = 10
    ) -> Dict[str, Any]:
        """
        Runs full evaluation across requested retrieval modes and scopes.
        """
        benchmark_queries = self.load_dataset()
        results = {
            "metadata": {
                "benchmark_file": str(self.benchmark_path.name),
                "total_queries": len(benchmark_queries),
                "scope": scope,
                "modes": modes,
                "top_k": top_k
            },
            "modes": {}
        }

        # Check reranker real status
        reranker_status = "ACTIVE_MODEL"
        if hasattr(self.pipeline, 'reranker') and self.pipeline.reranker is not None:
            if getattr(self.pipeline.reranker, 'model', None) is None:
                reranker_status = "UNAVAILABLE_FALLBACK_PASS_THROUGH"
        else:
            reranker_status = "DISABLED"

        results["metadata"]["reranker_execution_status"] = reranker_status

        for mode in modes:
            print(f"\n==================================================")
            print(f"Evaluating Mode: {mode.upper()} [Scope: {scope}]")
            if mode == "hybrid_rerank" and reranker_status == "UNAVAILABLE_FALLBACK_PASS_THROUGH":
                print(f"NOTE: Cross-Encoder weights unavailable; running as diagnostic fallback pass-through.")
            print(f"==================================================")

            latencies = []
            query_results = []
            applicable_results = []

            for item in benchmark_queries:
                qtext = item["query"]
                chunks, lat_ms = self.retrieve_candidates(qtext, mode=mode, top_k=top_k)
                latencies.append(lat_ms)

                q_eval = self.evaluate_query(item, chunks, top_k=top_k, scope=scope)
                query_results.append(q_eval)
                if q_eval["is_applicable"]:
                    applicable_results.append(q_eval)

            n_app = len(applicable_results)
            if n_app == 0:
                print(f"No applicable queries for scope '{scope}'.")
                results["modes"][mode] = {"status": "NOT_APPLICABLE", "applicable_count": 0}
                continue

            r1 = statistics.mean(q["recall@1"] for q in applicable_results)
            r3 = statistics.mean(q["recall@3"] for q in applicable_results)
            r5 = statistics.mean(q["recall@5"] for q in applicable_results)
            r10 = statistics.mean(q["recall@10"] for q in applicable_results)
            mrr = statistics.mean(q["mrr"] for q in applicable_results)
            ndcg5 = statistics.mean(q["ndcg@5"] for q in applicable_results)
            ndcg10 = statistics.mean(q["ndcg@10"] for q in applicable_results)
            src_acc = statistics.mean(q["source_acc@1"] for q in applicable_results)
            ent_acc = statistics.mean(q["entity_acc@1"] for q in applicable_results)
            sec_prec = statistics.mean(q["section_prec@1"] for q in applicable_results)

            # Failure breakdown
            diagnostics = [q["diagnostic"] for q in query_results]
            failure_summary = summarize_failures(diagnostics)

            # Category performance
            categories = sorted(list(set(q["category"] for q in applicable_results)))
            category_metrics = {}
            for cat in categories:
                cat_qs = [q for q in applicable_results if q["category"] == cat]
                category_metrics[cat] = {
                    "total": len(cat_qs),
                    "recall@1": round(statistics.mean(q["recall@1"] for q in cat_qs), 4),
                    "recall@3": round(statistics.mean(q["recall@3"] for q in cat_qs), 4),
                    "mrr": round(statistics.mean(q["mrr"] for q in cat_qs), 4),
                    "entity_acc@1": round(statistics.mean(q["entity_acc@1"] for q in cat_qs), 4)
                }

            mode_summary = {
                "mode": mode,
                "scope": scope,
                "total_queries": len(benchmark_queries),
                "applicable_queries": n_app,
                "recall@1": round(r1, 4),
                "recall@3": round(r3, 4),
                "recall@5": round(r5, 4),
                "recall@10": round(r10, 4),
                "mrr": round(mrr, 4),
                "ndcg@5": round(ndcg5, 4),
                "ndcg@10": round(ndcg10, 4),
                "source_acc@1": round(src_acc, 4),
                "entity_acc@1": round(ent_acc, 4),
                "section_prec@1": round(sec_prec, 4),
                "mean_latency_ms": round(statistics.mean(latencies), 2),
                "median_latency_ms": round(statistics.median(latencies), 2),
                "p95_latency_ms": round(statistics.quantiles(latencies, n=20)[18] if len(latencies) >= 20 else max(latencies), 2),
                "failure_distribution": failure_summary["distribution"],
                "category_breakdown": category_metrics,
                "per_query_results": query_results
            }

            print(f"Recall@1:  {mode_summary['recall@1']:.4f}")
            print(f"Recall@3:  {mode_summary['recall@3']:.4f}")
            print(f"Recall@5:  {mode_summary['recall@5']:.4f}")
            print(f"Recall@10: {mode_summary['recall@10']:.4f}")
            print(f"MRR:       {mode_summary['mrr']:.4f}")
            print(f"nDCG@5:    {mode_summary['ndcg@5']:.4f}")
            print(f"nDCG@10:   {mode_summary['ndcg@10']:.4f}")
            print(f"Source Acc@1:  {mode_summary['source_acc@1']:.4f}")
            print(f"Entity Acc@1:  {mode_summary['entity_acc@1']:.4f}")
            print(f"Section Prec@1:{mode_summary['section_prec@1']:.4f}")
            print(f"Latency:   mean={mode_summary['mean_latency_ms']}ms, p95={mode_summary['p95_latency_ms']}ms")

            results["modes"][mode] = mode_summary

        return results


if __name__ == "__main__":
    evaluator = RAGEvaluator()
    evaluator.run_benchmark()
