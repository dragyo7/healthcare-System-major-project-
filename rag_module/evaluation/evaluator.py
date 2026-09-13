"""
Quantitative RAG Evaluation Suite.
Measures Recall@K, MRR, Precision@K, Latency, and Safety Abstention across retrieval modes.
"""
import json
import sys
import time
import statistics
from pathlib import Path
from typing import List, Dict, Any, Optional

# Ensure workspace root is in path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.rag_pipeline import MedicalRAGPipeline


def check_hit(chunk_text: str, focus_text: str, expected_topic: str, expected_keywords: List[str]) -> bool:
    """Evaluates whether a retrieved chunk matches ground truth expected medical content."""
    combined = f"{chunk_text} {focus_text}".lower()
    
    # Check topic substring match
    if expected_topic.lower() in combined:
        return True
        
    # Check keyword coverage (at least 2 matching keywords or 50% of list)
    if expected_keywords:
        matches = sum(1 for kw in expected_keywords if kw.lower() in combined)
        if matches >= min(2, len(expected_keywords)):
            return True
            
    return False


class RAGEvaluator:
    """
    Automated benchmark evaluation runner.
    """
    def __init__(
        self,
        pipeline: Optional[MedicalRAGPipeline] = None,
        benchmark_path: Optional[Path] = None
    ):
        self.pipeline = pipeline or MedicalRAGPipeline()
        self.benchmark_path = benchmark_path or (DEFAULT_CONFIG.BASE_DIR / "evaluation" / "benchmark_dataset.json")

    def run_benchmark(
        self,
        modes: List[str] = ["dense", "bm25", "hybrid", "hybrid_rerank"]
    ) -> Dict[str, Any]:
        """
        Runs full benchmark suite across requested retrieval modes.
        """
        if not self.benchmark_path.exists():
            raise FileNotFoundError(f"Benchmark dataset not found at: {self.benchmark_path}")

        with open(self.benchmark_path, "r", encoding="utf-8") as f:
            benchmark_queries = json.load(f)

        results = {}

        for mode in modes:
            print(f"\n==================================================")
            print(f"Evaluating Mode: {mode.upper()}")
            print(f"==================================================")

            retrieval_queries = [q for q in benchmark_queries if q["category"] not in ["out_of_domain", "emergency_crisis"]]
            emergency_queries = [q for q in benchmark_queries if q["category"] == "emergency_crisis"]
            ood_queries = [q for q in benchmark_queries if q["category"] == "out_of_domain"]

            latencies = []
            recalls_at_1 = []
            recalls_at_3 = []
            recalls_at_5 = []
            reciprocal_ranks = []
            category_performance = {}

            # 1. Evaluate Medical Retrieval Queries
            for item in retrieval_queries:
                query_text = item["query"]
                exp_topic = item["expected_topic"]
                exp_keywords = item["expected_keywords"]
                cat = item["category"]

                t0 = time.time()
                res = self.pipeline.query(query_text, mode=mode, generate_answer=False)
                t1 = time.time()
                latencies.append((t1 - t0) * 1000.0)

                # Extract retrieved chunks
                # Access raw candidates for evaluation
                if mode == "dense" and self.pipeline.dense_retriever:
                    raw_res = self.pipeline.dense_retriever.search(query_text, top_k=5)
                    chunks = [self.pipeline.dense_retriever.metadata[idx] for idx, _ in raw_res]
                elif mode == "bm25" and self.pipeline.bm25_retriever:
                    raw_res = self.pipeline.bm25_retriever.search(query_text, top_k=5)
                    chunks = [self.pipeline.bm25_retriever.metadata[idx] for idx, _ in raw_res]
                elif self.pipeline.hybrid_retriever:
                    chunks = self.pipeline.hybrid_retriever.search(query_text, final_k=5)
                    if mode == "hybrid_rerank" and self.pipeline.reranker:
                        chunks = self.pipeline.reranker.rerank(query_text, chunks, top_k=5)
                else:
                    chunks = []

                # Calculate hits at rank 1, 3, 5
                hit_rank = 0
                for rank, chunk in enumerate(chunks, start=1):
                    if check_hit(chunk.get("text", ""), chunk.get("focus", ""), exp_topic, exp_keywords):
                        hit_rank = rank
                        break

                recalls_at_1.append(1 if (hit_rank == 1) else 0)
                recalls_at_3.append(1 if (1 <= hit_rank <= 3) else 0)
                recalls_at_5.append(1 if (1 <= hit_rank <= 5) else 0)
                reciprocal_ranks.append(1.0 / hit_rank if hit_rank > 0 else 0.0)

                if cat not in category_performance:
                    category_performance[cat] = {"total": 0, "hits_at_3": 0}
                category_performance[cat]["total"] += 1
                if 1 <= hit_rank <= 3:
                    category_performance[cat]["hits_at_3"] += 1

            # 2. Evaluate Emergency Triage
            emergency_hits = 0
            for item in emergency_queries:
                res = self.pipeline.query(item["query"], mode=mode, generate_answer=False)
                if res.get("is_emergency", False):
                    emergency_hits += 1
            emergency_accuracy = emergency_hits / len(emergency_queries) if emergency_queries else 1.0

            # 3. Evaluate Out-of-Domain Abstention
            ood_abstentions = 0
            for item in ood_queries:
                res = self.pipeline.query(item["query"], mode=mode, generate_answer=False)
                if res.get("abstained", False):
                    ood_abstentions += 1
            ood_abstention_accuracy = ood_abstentions / len(ood_queries) if ood_queries else 1.0

            mode_summary = {
                "mode": mode,
                "total_queries_tested": len(benchmark_queries),
                "retrieval_queries_count": len(retrieval_queries),
                "recall@1": round(statistics.mean(recalls_at_1), 4),
                "recall@3": round(statistics.mean(recalls_at_3), 4),
                "recall@5": round(statistics.mean(recalls_at_5), 4),
                "MRR": round(statistics.mean(reciprocal_ranks), 4),
                "mean_latency_ms": round(statistics.mean(latencies), 2),
                "median_latency_ms": round(statistics.median(latencies), 2),
                "emergency_triage_accuracy": round(emergency_accuracy * 100.0, 1),
                "ood_abstention_accuracy": round(ood_abstention_accuracy * 100.0, 1),
                "category_breakdown": {
                    cat: f"{d['hits_at_3']}/{d['total']} ({round(d['hits_at_3']/d['total']*100, 1)}%)"
                    for cat, d in category_performance.items()
                }
            }

            print(f"Recall@1: {mode_summary['recall@1']:.4f}")
            print(f"Recall@3: {mode_summary['recall@3']:.4f}")
            print(f"Recall@5: {mode_summary['recall@5']:.4f}")
            print(f"MRR:      {mode_summary['MRR']:.4f}")
            print(f"Latency:  {mode_summary['mean_latency_ms']} ms")
            print(f"Emergency Accuracy: {mode_summary['emergency_triage_accuracy']}%")
            print(f"OOD Abstention:     {mode_summary['ood_abstention_accuracy']}%")

            results[mode] = mode_summary

        return results


if __name__ == "__main__":
    evaluator = RAGEvaluator()
    evaluator.run_benchmark()
