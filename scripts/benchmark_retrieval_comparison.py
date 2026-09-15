"""
Retrieval Benchmark: Dense vs. BM25 vs. Hybrid RRF vs. Hybrid + Cross-Encoder Reranker.
Computes Recall@1, Recall@3, Recall@5, MRR, and Latency statistics across clinical benchmark queries.
"""
import sys
import time
import json
from pathlib import Path
from typing import List, Dict, Any
import numpy as np

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.retrieval.dense_retriever import DenseRetriever
from rag_module.retrieval.bm25_retriever import BM25Retriever
from rag_module.retrieval.hybrid_retriever import HybridRetriever
from rag_module.reranking.cross_encoder_reranker import CrossEncoderReranker

# Curated Clinical Benchmark Dataset (20 Clinical Decision Support Queries with Expected Target Drugs/Entities)
BENCHMARK_QUERIES = [
    {
        "query": "Is lisinopril contraindicated in pregnant patients due to fetal toxicity?",
        "target_keywords": ["lisinopril", "fetal", "toxicity", "pregnancy", "angioedema"],
        "expected_drug": "Lisinopril"
    },
    {
        "query": "What is the boxed warning for metformin regarding lactic acidosis?",
        "target_keywords": ["metformin", "lactic", "acidosis", "renal"],
        "expected_drug": "Metformin"
    },
    {
        "query": "Can amlodipine cause peripheral edema and gingival hyperplasia?",
        "target_keywords": ["amlodipine", "edema", "calcium", "channel"],
        "expected_drug": "Amlodipine"
    },
    {
        "query": "What are the drug interactions between warfarin and NSAIDs or amiodarone?",
        "target_keywords": ["warfarin", "bleeding", "inr", "interaction", "nsaid"],
        "expected_drug": "Warfarin"
    },
    {
        "query": "What are the contraindications and liver toxicity warnings for atorvastatin?",
        "target_keywords": ["atorvastatin", "myopathy", "rhabdomyolysis", "hepatic"],
        "expected_drug": "Atorvastatin"
    },
    {
        "query": "ICMR antimicrobial guideline recommendations for urinary tract infection",
        "target_keywords": ["icmr", "antimicrobial", "urinary", "uti", "nitrofurantoin"],
        "expected_drug": "General"
    },
    {
        "query": "MoHFW standard treatment guideline hypertension referral criteria to tertiary care",
        "target_keywords": ["mohfw", "hypertension", "referral", "emergency"],
        "expected_drug": "General"
    },
    {
        "query": "What is the boxed warning for ciprofloxacin regarding tendonitis and tendon rupture?",
        "target_keywords": ["ciprofloxacin", "tendon", "rupture", "myasthenia"],
        "expected_drug": "Ciprofloxacin"
    },
    {
        "query": "Can clopidogrel be combined with omeprazole or CYP2C19 inhibitors?",
        "target_keywords": ["clopidogrel", "omeprazole", "cyp2c19", "antiplatelet"],
        "expected_drug": "Clopidogrel"
    },
    {
        "query": "What is the boxed warning for methotrexate regarding severe bone marrow suppression?",
        "target_keywords": ["methotrexate", "bone marrow", "hepatotoxicity", "renal"],
        "expected_drug": "Methotrexate"
    },
    {
        "query": "What are the symptoms and emergency treatment of severe anaphylaxis?",
        "target_keywords": ["anaphylaxis", "epinephrine", "allergy", "airway"],
        "expected_drug": "General"
    },
    {
        "query": "Signs, symptoms and diagnostic criteria of Type 2 Diabetes Mellitus",
        "target_keywords": ["diabetes", "glucose", "hba1c", "polyuria"],
        "expected_drug": "General"
    },
    {
        "query": "Signs, diagnosis and management of acute myocardial infarction",
        "target_keywords": ["myocardial", "infarction", "troponin", "coronary", "ecg"],
        "expected_drug": "General"
    },
    {
        "query": "What are the boxed warnings and risks of tendon rupture with levofloxacin?",
        "target_keywords": ["levofloxacin", "tendon", "rupture", "aortic", "aneurysm"],
        "expected_drug": "Levofloxacin"
    },
    {
        "query": "Is apixaban contraindicated with strong dual CYP3A4 and P-gp inhibitors?",
        "target_keywords": ["apixaban", "bleeding", "cyp3a4", "coagulation"],
        "expected_drug": "Apixaban"
    },
    {
        "query": "What are the adverse reactions and warnings for amoxicillin and clavulanate?",
        "target_keywords": ["amoxicillin", "clavulanate", "anaphylaxis", "cholestatic", "jaundice"],
        "expected_drug": "Amoxicillin"
    },
    {
        "query": "Can omeprazole increase the risk of Clostridium difficile-associated diarrhea?",
        "target_keywords": ["omeprazole", "difficile", "diarrhea", "ppi"],
        "expected_drug": "Omeprazole"
    },
    {
        "query": "What are the contraindications for losartan during pregnancy?",
        "target_keywords": ["losartan", "fetal", "toxicity", "pregnancy", "arb"],
        "expected_drug": "Losartan"
    },
    {
        "query": "What is the boxed warning for digoxin toxicity and hypokalemia?",
        "target_keywords": ["digoxin", "toxicity", "arrhythmia", "hypokalemia"],
        "expected_drug": "Digoxin"
    },
    {
        "query": "What are the drug interactions and hepatic safety warnings for carbamazepine?",
        "target_keywords": ["carbamazepine", "stevens-johnson", "toxic", "epidermal", "cyp3a4"],
        "expected_drug": "Carbamazepine"
    }
]


def evaluate_hit(hit: Dict[str, Any], query_spec: Dict[str, Any]) -> bool:
    """Evaluates whether retrieved chunk matches ground-truth target keywords/drug."""
    text = hit.get("text", "").lower()
    doc_id = hit.get("doc_id", "").lower()
    drug_meta = str(hit.get("metadata", {}).get("drug_name", "")).lower()
    
    expected_drug = query_spec.get("expected_drug", "").lower()
    if expected_drug and expected_drug != "general":
        if expected_drug in text or expected_drug in doc_id or expected_drug in drug_meta:
            return True
            
    # Fallback to matching 2 or more target keywords
    matches = sum(1 for kw in query_spec["target_keywords"] if kw.lower() in text or kw.lower() in doc_id)
    return matches >= 2


def run_benchmark():
    print("=" * 70)
    print("CLINICAL RAG RETRIEVAL COMPARISON BENCHMARK")
    print(f"Evaluating {len(BENCHMARK_QUERIES)} CDS queries on Unified Knowledge Base (236 Chunks)")
    print("=" * 70)
    
    dense_retriever = DenseRetriever()
    bm25_retriever = BM25Retriever.load(DEFAULT_CONFIG.BM25_INDEX_PATH)
    hybrid_retriever = HybridRetriever(dense_retriever=dense_retriever, bm25_retriever=bm25_retriever)
    reranker = CrossEncoderReranker()
    
    strategies = ["Dense Only", "BM25 Only", "Hybrid RRF", "Hybrid + CrossEncoder Reranker"]
    metrics = {s: {"r@1": [], "r@3": [], "r@5": [], "mrr": [], "latencies": []} for s in strategies}
    
    for q_spec in BENCHMARK_QUERIES:
        q = q_spec["query"]
        
        # 1. Dense Only
        t0 = time.time()
        raw_dense = dense_retriever.search(q, top_k=5)
        dense_hits = [dense_retriever.get_chunk(idx) for idx, _ in raw_dense]
        metrics["Dense Only"]["latencies"].append((time.time() - t0) * 1000)
        
        # 2. BM25 Only
        t0 = time.time()
        raw_bm25 = bm25_retriever.search(q, top_k=5)
        bm25_hits = [bm25_retriever.get_chunk(idx) for idx, _ in raw_bm25]
        metrics["BM25 Only"]["latencies"].append((time.time() - t0) * 1000)
        
        # 3. Hybrid RRF
        t0 = time.time()
        hybrid_hits = hybrid_retriever.search(q, final_k=5)
        metrics["Hybrid RRF"]["latencies"].append((time.time() - t0) * 1000)
        
        # 4. Hybrid + CrossEncoder Reranker
        t0 = time.time()
        raw_hybrid = hybrid_retriever.search(q, final_k=10)
        reranked_hits = reranker.rerank(q, raw_hybrid, top_k=5)
        metrics["Hybrid + CrossEncoder Reranker"]["latencies"].append((time.time() - t0) * 1000)
        
        results_map = {
            "Dense Only": dense_hits,
            "BM25 Only": bm25_hits,
            "Hybrid RRF": hybrid_hits,
            "Hybrid + CrossEncoder Reranker": reranked_hits
        }
        
        for strat, hits in results_map.items():
            hit_matches = [evaluate_hit(h, q_spec) for h in hits]
            
            # Recall@K (Is there at least 1 relevant hit in top K?)
            metrics[strat]["r@1"].append(1.0 if any(hit_matches[:1]) else 0.0)
            metrics[strat]["r@3"].append(1.0 if any(hit_matches[:3]) else 0.0)
            metrics[strat]["r@5"].append(1.0 if any(hit_matches[:5]) else 0.0)
            
            # MRR (1 / rank of first relevant hit)
            mrr_val = 0.0
            for rank_idx, matched in enumerate(hit_matches):
                if matched:
                    mrr_val = 1.0 / (rank_idx + 1)
                    break
            metrics[strat]["mrr"].append(mrr_val)

    # Print summary table
    print("\n" + "=" * 80)
    print(f"{'Retrieval Strategy':<32} | {'Recall@1':<8} | {'Recall@3':<8} | {'Recall@5':<8} | {'MRR':<6} | {'p50 (ms)':<8} | {'p95 (ms)':<8}")
    print("-" * 80)
    
    benchmark_report = {}
    for s in strategies:
        r1 = np.mean(metrics[s]["r@1"]) * 100
        r3 = np.mean(metrics[s]["r@3"]) * 100
        r5 = np.mean(metrics[s]["r@5"]) * 100
        mrr = np.mean(metrics[s]["mrr"])
        p50 = np.percentile(metrics[s]["latencies"], 50)
        p95 = np.percentile(metrics[s]["latencies"], 95)
        
        print(f"{s:<32} | {r1:>7.1f}% | {r3:>7.1f}% | {r5:>7.1f}% | {mrr:>6.3f} | {p50:>8.1f} | {p95:>8.1f}")
        benchmark_report[s] = {
            "recall@1": round(float(r1), 2),
            "recall@3": round(float(r3), 2),
            "recall@5": round(float(r5), 2),
            "mrr": round(float(mrr), 4),
            "latency_p50_ms": round(float(p50), 2),
            "latency_p95_ms": round(float(p95), 2)
        }
    print("=" * 80)
    
    # Save report artifact
    report_path = ROOT_DIR / "docs" / "retrieval_benchmark_results.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(benchmark_report, f, indent=2)
    print(f"\nDetailed benchmark artifact saved to: {report_path}")

if __name__ == "__main__":
    run_benchmark()
