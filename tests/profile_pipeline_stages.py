"""
profile_pipeline_stages.py

Monotonic latency profiler for frozen Medical RAG Pipeline (v2.10) stages.
Uses time.perf_counter() to measure:
- Input sanitization & Query analysis
- Dense retrieval (Embedding encoding + FAISS)
- BM25 lexical retrieval
- Hybrid RRF fusion
- Cross-encoder reranking
- Evidence policy evaluation
- Context assembly
- TinyLlama-1.1B answer generation
- AnswerGroundingVerifier verification

Outputs machine-readable JSON metrics including p50, p90, p95, max.
Strictly non-sensitive synthetic medical queries only. Zero PII.
"""
import sys
import os
import time
import json
from pathlib import Path
from typing import Dict, List, Any
import numpy as np

# Ensure repository root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.rag_pipeline import MedicalRAGPipeline
from rag_module.retrieval.query_analyzer import ClinicalIntent
from multilingual_module.detector import detect_language
from multilingual_module.canonicalizer import canonicalize_medical_query

BENCHMARK_QUERIES = [
    {
        "type": "common_grounded",
        "query": "What are the common adverse reactions of Lisinopril?",
        "lang": "en"
    },
    {
        "type": "complex_multipart",
        "query": "What is the recommended dosage of Metformin for type 2 diabetes and what are its contraindications in renal impairment?",
        "lang": "en"
    },
    {
        "type": "insufficient_evidence",
        "query": "What are the off-label dosing protocols for investigational molecule XYZ-9988 in acute pediatric pancreatitis?",
        "lang": "en"
    },
    {
        "type": "emergency_triage",
        "query": "Patient has crushing chest pain radiating to left arm, severe shortness of breath and diaphoresis.",
        "lang": "en"
    },
    {
        "type": "multilingual_hi",
        "query": "लिसीनोप्रिल के क्या दुष्प्रभाव हैं?",
        "lang": "hi"
    },
    {
        "type": "multilingual_mr",
        "query": "लिसिनोप्रिलचे दुष्परिणाम काय आहेत?",
        "lang": "mr"
    }
]

def calculate_stats(latencies_ms: List[float]) -> Dict[str, float]:
    if not latencies_ms:
        return {"count": 0, "p50": 0.0, "p90": 0.0, "p95": 0.0, "max": 0.0, "min": 0.0, "avg": 0.0}
    arr = np.array(latencies_ms)
    return {
        "count": len(arr),
        "min": round(float(np.min(arr)), 2),
        "p50": round(float(np.median(arr)), 2),
        "p90": round(float(np.percentile(arr, 90)), 2),
        "p95": round(float(np.percentile(arr, 95)), 2),
        "max": round(float(np.max(arr)), 2),
        "avg": round(float(np.mean(arr)), 2)
    }

def profile_query(pipeline: MedicalRAGPipeline, query_item: Dict[str, str]) -> Dict[str, Any]:
    raw_query = query_item["query"]
    target_lang = query_item.get("lang", "en")
    timings: Dict[str, float] = {}

    t_total_start = time.perf_counter()

    # 1. Multilingual Detection & Canonicalization
    t0 = time.perf_counter()
    det = detect_language(raw_query)
    eff_lang = target_lang if target_lang != "auto" else det["language"]
    canon = canonicalize_medical_query(raw_query, forced_lang=eff_lang)
    retrieval_query = canon["canonical_query"] if canon["was_canonicalized"] else raw_query
    timings["multilingual_processing_ms"] = (time.perf_counter() - t0) * 1000.0

    # 2. Emergency Triage Check
    t0 = time.perf_counter()
    is_emerg = bool(pipeline.guardrails.check_emergency(retrieval_query) or pipeline.guardrails.check_emergency(raw_query))
    timings["emergency_check_ms"] = (time.perf_counter() - t0) * 1000.0

    if is_emerg:
        timings["total_pipeline_ms"] = (time.perf_counter() - t_total_start) * 1000.0
        return {
            "query_type": query_item["type"],
            "is_emergency": True,
            "abstained": False,
            "grounded": False,
            "timings_ms": timings
        }

    # 3. Prompt Injection Check
    t0 = time.perf_counter()
    is_inj = bool(pipeline.guardrails.detect_injection(retrieval_query) or pipeline.guardrails.detect_injection(raw_query))
    timings["prompt_injection_check_ms"] = (time.perf_counter() - t0) * 1000.0
    if is_inj:
        timings["total_pipeline_ms"] = (time.perf_counter() - t_total_start) * 1000.0
        return {
            "query_type": query_item["type"],
            "is_emergency": False,
            "is_injection": True,
            "abstained": True,
            "grounded": False,
            "timings_ms": timings
        }

    # 4. Sanitization & Query Analysis
    t0 = time.perf_counter()
    sanitized = pipeline.guardrails.sanitize_input(retrieval_query)
    q_analysis = pipeline.query_analyzer.analyze(sanitized)
    timings["query_analysis_ms"] = (time.perf_counter() - t0) * 1000.0

    budget = q_analysis.retrieval_budget
    dense_k = budget.dense_k
    bm25_k = budget.bm25_k
    target_final_k = budget.final_top_k

    # Canonical terms expansion
    c_terms = [ent.get("canonical_name") for ent in q_analysis.resolved_entities if ent.get("canonical_name") and ent.get("canonical_name").lower() not in sanitized.lower()]
    search_query = f"{sanitized} {' '.join(c_terms)}" if c_terms else sanitized

    # 5. Dense Retrieval (Embedding + FAISS)
    t0 = time.perf_counter()
    dense_results = pipeline.dense_retriever.search(search_query, top_k=dense_k)
    timings["dense_retrieval_ms"] = (time.perf_counter() - t0) * 1000.0

    # 6. BM25 Retrieval
    t0 = time.perf_counter()
    bm25_results = pipeline.bm25_retriever.search(search_query, top_k=bm25_k)
    timings["bm25_retrieval_ms"] = (time.perf_counter() - t0) * 1000.0

    # 7. Hybrid RRF Fusion
    t0 = time.perf_counter()
    candidate_chunks = pipeline.hybrid_retriever.search(
        search_query,
        dense_k=dense_k,
        bm25_k=bm25_k,
        final_k=max(dense_k, bm25_k, target_final_k * 3)
    )
    timings["rrf_fusion_ms"] = (time.perf_counter() - t0) * 1000.0

    # 8. Cross-Encoder Reranking
    t0 = time.perf_counter()
    if pipeline.reranker and candidate_chunks:
        scored_candidates = pipeline.reranker.rerank(search_query, candidate_chunks, top_k=len(candidate_chunks))
    else:
        scored_candidates = candidate_chunks
    timings["cross_encoder_rerank_ms"] = (time.perf_counter() - t0) * 1000.0

    # Entity-isolation screening
    t0 = time.perf_counter()
    if q_analysis.candidate_entities and ClinicalIntent.COMPARISON not in q_analysis.intents:
        target_entities = set(e.lower() for e in q_analysis.candidate_entities)
        for res_ent in q_analysis.resolved_entities:
            if res_ent.get("canonical_name"):
                target_entities.add(res_ent["canonical_name"].lower())
            if res_ent.get("matched_monograph"):
                target_entities.add(res_ent["matched_monograph"].lower())
        entity_matching = [c for c in scored_candidates if any(t in str(c.get("title", "")).lower() or t in str(c.get("text", "")).lower() for t in target_entities)]
        if len(entity_matching) >= 1:
            non_conf = [c for c in scored_candidates if c not in entity_matching and not any(sep in str(c.get("title", "")) for sep in [" - Indications", " - Dosage", " - Contraindications", " - Adverse Reactions"])]
            scored_candidates = entity_matching + non_conf
    final_chunks = scored_candidates[:target_final_k]
    timings["entity_screening_ms"] = (time.perf_counter() - t0) * 1000.0

    # 9. Evidence Policy Evaluation
    t0 = time.perf_counter()
    should_abstain, abstention_msg = pipeline.guardrails.check_abstention(final_chunks)
    grounding_decision = pipeline.evidence_policy.evaluate_evidence(sanitized, final_chunks, retrieval_mode="hybrid")
    timings["evidence_policy_ms"] = (time.perf_counter() - t0) * 1000.0

    if should_abstain or not grounding_decision.generation_allowed:
        timings["total_pipeline_ms"] = (time.perf_counter() - t_total_start) * 1000.0
        return {
            "query_type": query_item["type"],
            "is_emergency": False,
            "abstained": True,
            "grounded": False,
            "retrieved_chunks": len(final_chunks),
            "timings_ms": timings
        }

    # 10. Context & Citation Construction
    t0 = time.perf_counter()
    accepted_chunks = [c for c in final_chunks if c.get("chunk_id") in (grounding_decision.accepted_chunk_ids or set())] or final_chunks
    context_str, citations = pipeline.context_builder.build_context(accepted_chunks)
    timings["context_assembly_ms"] = (time.perf_counter() - t0) * 1000.0

    # 11. Generator (TinyLlama-1.1B on CPU)
    t0 = time.perf_counter()
    raw_answer = pipeline.generator.generate(sanitized, context_str, audience="doctor")
    timings["generator_ms"] = (time.perf_counter() - t0) * 1000.0

    # 12. AnswerGroundingVerifier
    t0 = time.perf_counter()
    ver_res = pipeline.grounding_verifier.verify_answer(
        answer=raw_answer,
        evidence_chunks=accepted_chunks,
        citations=[str(c.get("chunk_id")) for c in accepted_chunks if isinstance(c, dict) and "chunk_id" in c],
        target_intents=q_analysis.intents
    )
    timings["grounding_verifier_ms"] = (time.perf_counter() - t0) * 1000.0

    timings["total_pipeline_ms"] = (time.perf_counter() - t_total_start) * 1000.0

    return {
        "query_type": query_item["type"],
        "is_emergency": False,
        "abstained": not ver_res.is_grounded and not ver_res.safe_for_partial,
        "grounded": bool(ver_res.is_grounded or ver_res.safe_for_partial),
        "retrieved_chunks": len(accepted_chunks),
        "verification_status": "grounded" if ver_res.is_grounded else ("partially_grounded" if ver_res.safe_for_partial else "withheld"),
        "timings_ms": timings
    }

def main():
    print("==========================================================================")
    print("  STAGE-LEVEL LATENCY PROFILER: MEDICAL RAG PIPELINE v2.10 (MONOTONIC)    ")
    print("==========================================================================")

    print("Initializing MedicalRAGPipeline...")
    t_init = time.perf_counter()
    pipeline = MedicalRAGPipeline(config=DEFAULT_CONFIG)
    print(f"Pipeline initialized in {(time.perf_counter() - t_init):.2f}s")

    # Warm-up run to avoid cold-start skew
    print("\nExecuting warm-up query (cold-start mitigation)...")
    warmup_res = profile_query(pipeline, BENCHMARK_QUERIES[0])
    print(f"Warm-up complete: {warmup_res['timings_ms']['total_pipeline_ms']:.1f} ms")

    # Measured runs
    print("\nRunning measured benchmark queries across representative clinical categories...")
    results_by_stage: Dict[str, List[float]] = {}
    detailed_runs = []

    for item in BENCHMARK_QUERIES:
        print(f"Profiling [{item['type']}]: '{item['query'][:50]}...'")
        res = profile_query(pipeline, item)
        detailed_runs.append(res)
        for stage, dur in res["timings_ms"].items():
            if stage not in results_by_stage:
                results_by_stage[stage] = []
            results_by_stage[stage].append(dur)

    print("\n==========================================================================")
    print("                     STAGE LATENCY BREAKDOWN (ms)                         ")
    print("==========================================================================")
    summary_stats = {}
    for stage, durs in results_by_stage.items():
        stats = calculate_stats(durs)
        summary_stats[stage] = stats
        print(f"{stage:<30} | count={stats['count']:<2} | p50={stats['p50']:>8.2f} | p90={stats['p90']:>8.2f} | max={stats['max']:>8.2f}")

    output_file = REPO_ROOT / "tests" / "benchmark_pipeline_stage_timings.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "environment": {
                "os": "Windows",
                "python": sys.version,
                "model": "TinyLlama/TinyLlama-1.1B-Chat-v1.0",
                "reranker": "cross-encoder/ms-marco-MiniLM-L-6-v2",
                "embeddings": "BAAI/bge-small-en"
            },
            "summary_stats": summary_stats,
            "detailed_runs": detailed_runs
        }, f, indent=2)

    print(f"\nStage latency metrics written to: {output_file}")
    print("==========================================================================")

if __name__ == "__main__":
    main()
