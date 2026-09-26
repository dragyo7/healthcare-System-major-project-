"""
Empirical Model-Agnostic LLM Benchmark & Comparison Harness.
Evaluates TinyLlama-1.1B-Chat vs Qwen2.5-1.5B-Instruct vs SmolLM2-1.7B-Instruct.
Strictly controls for identical retrieval, evidence policy, context, prompts, and verifier.
"""
import os
import sys
import time
import json
import gc
from pathlib import Path
from typing import Dict, Any, List, Optional

# Ensure workspace root is in sys.path
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKSPACE_ROOT))

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
try:
    import psutil
    TOTAL_RAM_GB = round(psutil.virtual_memory().total / (1024**3), 2)
except ImportError:
    TOTAL_RAM_GB = 16.0  # Hardware specification: 16GB



from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.rag_pipeline import MedicalRAGPipeline
from rag_module.safety.grounding_verifier import AnswerGroundingVerifier, ClaimStatus
from rag_module.generation.generator_v2 import MedicalGenerator


class ModelAgnosticGenerator:
    """
    Standardized, model-agnostic generator adapter.
    """
    def __init__(self, model_name: str, device: str = "cuda", max_new_tokens: int = 150):
        self.model_name = model_name
        self.device = device
        self.max_new_tokens = max_new_tokens
        self.model = None
        self.tokenizer = None
        self.load_time_sec = 0.0

    def load(self):
        t0 = time.time()
        print(f"Loading {self.model_name} on {self.device}...")
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        dtype = torch.float16 if self.device == "cuda" else torch.float32
        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_name,
            torch_dtype=dtype
        ).to(self.device)
        self.model.eval()
        self.load_time_sec = time.time() - t0
        print(f"Loaded {self.model_name} in {self.load_time_sec:.2f}s")

    def unload(self):
        del self.model
        del self.tokenizer
        self.model = None
        self.tokenizer = None
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()

    def generate(self, query: str, context: str) -> Dict[str, Any]:
        default_system_prompt = (
            "You are an authoritative, evidence-grounded medical AI assistant.\n\n"
            "STRICT CLINICAL RULES:\n"
            "1. Answer the question using ONLY the factual medical evidence provided in <evidence_passages>.\n"
            "2. Always repeat the specific medication or medical condition name (e.g. 'Lisinopril', 'Metformin'); NEVER use ambiguous pronouns such as 'It' or 'This drug'.\n"
            "3. Do not include conversational filler (such as 'Sure!', 'Certainly!', or 'Here is...').\n"
            "4. Do not output numbered lists or fragments; output concise, complete factual sentences.\n"
            "5. Preserve numerical values, units, and qualifiers exactly as stated in the evidence.\n"
            "6. Never extrapolate, speculate, or introduce unverified medical claims.\n"
            "7. If the evidence does not directly answer the question, state: 'The provided medical evidence does not contain sufficient details to answer this question.'\n"
            "8. Maximum 2 to 3 sentences."
        )

        user_content = (
            f"<evidence_passages>\n{context}\n</evidence_passages>\n\n"
            f"<patient_question>\n{query}\n</patient_question>\n\n"
            f"Please provide a clear, concise, evidence-grounded medical summary answering the patient question.\n"
            f"Explicitly name the subject medication or condition in each sentence instead of using pronouns. Do not use conversational filler."
        )

        messages = [
            {"role": "system", "content": default_system_prompt},
            {"role": "user", "content": user_content}
        ]

        prompt = self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True
        )

        inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True, max_length=2048)
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        t0 = time.time()
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=self.max_new_tokens,
                do_sample=False,
                repetition_penalty=1.1,
                pad_token_id=self.tokenizer.eos_token_id
            )
        latency = time.time() - t0

        generated_tokens = outputs[0][inputs["input_ids"].shape[1]:]
        raw_answer = self.tokenizer.decode(generated_tokens, skip_special_tokens=True).strip()
        cleaned_answer = MedicalGenerator.clean_generation_output(raw_answer, context)

        return {
            "raw_answer": raw_answer,
            "cleaned_answer": cleaned_answer,
            "latency_ms": round(latency * 1000, 2),
            "tokens_generated": len(generated_tokens),
            "tokens_per_sec": round(len(generated_tokens) / max(latency, 0.001), 2)
        }


def run_benchmark():
    benchmark_file = WORKSPACE_ROOT / "rag_module" / "evaluation" / "v29_benchmark_46_queries.json"
    with open(benchmark_file, "r", encoding="utf-8") as f:
        benchmark_queries = json.load(f)

    print(f"Loaded {len(benchmark_queries)} benchmark queries.")

    # Initialize frozen pipeline (with mock generator for retrieval/evidence stages)
    pipeline = MedicalRAGPipeline()
    verifier = AnswerGroundingVerifier()

    # Step 1: Precompute and freeze the exact retrieval and evidence context for all 46 queries
    print("Pre-computing and freezing retrieval & evidence policy decisions...")
    frozen_query_contexts = []
    for idx, item in enumerate(benchmark_queries):
        q = item["query"]
        sanitized_q = pipeline.guardrails.sanitize_input(q)
        emergency_alert = pipeline.guardrails.check_emergency(q)

        if emergency_alert:
            frozen_query_contexts.append({
                "item": item,
                "sanitized_query": sanitized_q,
                "is_emergency": True,
                "emergency_alert": emergency_alert,
                "generation_allowed": False,
                "accepted_chunks": [],
                "context_str": "",
                "citations": []
            })
            continue

        # Hybrid retrieval
        candidates = pipeline.hybrid_retriever.search(
            sanitized_q,
            dense_k=pipeline.config.DENSE_CANDIDATE_K,
            bm25_k=pipeline.config.BM25_CANDIDATE_K,
            final_k=pipeline.config.DENSE_CANDIDATE_K
        )
        final_chunks = pipeline.reranker.rerank(sanitized_q, candidates, top_k=pipeline.config.FINAL_TOP_K)

        should_abstain, abstention_msg = pipeline.guardrails.check_abstention(final_chunks)
        grounding_decision = pipeline.evidence_policy.evaluate_evidence(sanitized_q, final_chunks, retrieval_mode="hybrid")

        if should_abstain or not grounding_decision.generation_allowed:
            frozen_query_contexts.append({
                "item": item,
                "sanitized_query": sanitized_q,
                "is_emergency": False,
                "emergency_alert": None,
                "generation_allowed": False,
                "abstention_msg": abstention_msg or "I am not able to find verified medical evidence regarding the requested subject in authoritative clinical guidelines.",
                "accepted_chunks": [],
                "context_str": "",
                "citations": []
            })
            continue

        accepted_chunks = [c for c in final_chunks if c.get("chunk_id") in (grounding_decision.accepted_chunk_ids or set())] or final_chunks
        context_str, citations = pipeline.context_builder.build_context(accepted_chunks)

        frozen_query_contexts.append({
            "item": item,
            "sanitized_query": sanitized_q,
            "is_emergency": False,
            "emergency_alert": None,
            "generation_allowed": True,
            "abstention_msg": None,
            "accepted_chunks": accepted_chunks,
            "context_str": context_str,
            "citations": citations
        })

    print(f"Precomputed {len(frozen_query_contexts)} queries: {sum(1 for c in frozen_query_contexts if c['generation_allowed'])} generation-eligible, {sum(1 for c in frozen_query_contexts if not c['generation_allowed'])} policy-abstained.")

    # Step 2: Models to evaluate
    models_to_evaluate = [
        {"name": "TinyLlama/TinyLlama-1.1B-Chat-v1.0", "label": "TinyLlama-1.1B"},
        {"name": "Qwen/Qwen2.5-1.5B-Instruct", "label": "Qwen2.5-1.5B"},
        {"name": "HuggingFaceTB/SmolLM2-1.7B-Instruct", "label": "SmolLM2-1.7B"}
    ]

    benchmark_report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "hardware": {
            "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU",
            "vram_gb": round(torch.cuda.get_device_properties(0).total_memory / (1024**3), 2) if torch.cuda.is_available() else 0,
            "ram_gb": TOTAL_RAM_GB
        },
        "models": {}
    }

    for model_spec in models_to_evaluate:
        model_name = model_spec["name"]
        label = model_spec["label"]
        print(f"\n==================================================")
        print(f"BENCHMARKING MODEL: {label} ({model_name})")
        print(f"==================================================")

        generator = ModelAgnosticGenerator(model_name, device="cuda")
        generator.load()

        torch.cuda.reset_peak_memory_stats()
        model_results = []
        start_time = time.time()

        counts = {
            "correctly_grounded": 0,
            "correctly_abstained": 0,
            "incorrectly_answered": 0,
            "incorrectly_abstained": 0,
            "total_claims": 0,
            "supported_claims": 0,
            "unsupported_claims": 0,
            "contradictions": 0,
            "entity_mismatches": 0,
            "numeric_mismatches": 0,
            "qualifier_mismatches": 0,
            "invalid_citations": 0
        }
        latencies = []

        for idx, qc in enumerate(frozen_query_contexts, start=1):
            item = qc["item"]
            qid = item["query_id"]
            q = item["query"]
            cat = item["category"]

            if qc["is_emergency"]:
                counts["correctly_abstained"] += 1
                model_results.append({
                    "query_id": qid,
                    "category": cat,
                    "query": q,
                    "classification": "2. Correctly abstained (Emergency)",
                    "answer": qc["emergency_alert"],
                    "is_grounded": False,
                    "abstained": False,
                    "is_emergency": True
                })
                continue

            if not qc["generation_allowed"]:
                counts["correctly_abstained"] += 1
                model_results.append({
                    "query_id": qid,
                    "category": cat,
                    "query": q,
                    "classification": "2. Correctly abstained (Policy)",
                    "answer": qc["abstention_msg"],
                    "is_grounded": False,
                    "abstained": True,
                    "is_emergency": False
                })
                continue

            # Generation eligible query
            gen_out = generator.generate(qc["sanitized_query"], qc["context_str"])
            latencies.append(gen_out["latency_ms"])

            # Verify with frozen verifier
            verification = verifier.verify_answer(
                answer=gen_out["cleaned_answer"],
                evidence_chunks=qc["accepted_chunks"],
                citations=[str(c.get("chunk_id")) for c in qc["accepted_chunks"] if isinstance(c, dict) and "chunk_id" in c]
            )

            # Count claims
            counts["total_claims"] += verification.total_claim_count
            counts["supported_claims"] += verification.grounded_claim_count
            if verification.has_contradiction:
                counts["contradictions"] += 1

            for cr in verification.claim_results:
                st = cr.status
                if st == ClaimStatus.UNSUPPORTED_BY_EVIDENCE:
                    counts["unsupported_claims"] += 1
                elif st == ClaimStatus.ENTITY_MISMATCH:
                    counts["entity_mismatches"] += 1
                elif st == ClaimStatus.NUMERIC_MISMATCH:
                    counts["numeric_mismatches"] += 1
                elif st == ClaimStatus.QUALIFIER_MISMATCH:
                    counts["qualifier_mismatches"] += 1
                elif st == ClaimStatus.INVALID_CITATION:
                    counts["invalid_citations"] += 1

            if verification.is_grounded:
                classification = "1. Correctly grounded answer"
                counts["correctly_grounded"] += 1
                final_answer = pipeline.guardrails.append_disclaimer(gen_out["cleaned_answer"])
                abstained = False
            else:
                fail_reason = verification.discrepancies[0] if verification.discrepancies else "Verification failure"
                final_answer = pipeline.guardrails.append_disclaimer(
                    f"I am not able to verify the clinical accuracy of the generated answer against authoritative guidelines ({fail_reason}). As a patient safety precaution, this answer has been withheld."
                )
                abstained = True
                if verification.has_contradiction:
                    classification = "3. Incorrectly answered (Contradiction)"
                    counts["incorrectly_answered"] += 1
                else:
                    classification = "4. Incorrectly abstained (Verification Failure)"
                    counts["incorrectly_abstained"] += 1

            print(f"  [{qid}] {classification} | Latency: {gen_out['latency_ms']}ms | Grounded Claims: {verification.grounded_claim_count}/{verification.total_claim_count}")

            model_results.append({
                "query_id": qid,
                "category": cat,
                "query": q,
                "classification": classification,
                "raw_generated_answer": gen_out["raw_answer"],
                "cleaned_answer": gen_out["cleaned_answer"],
                "final_answer": final_answer,
                "is_grounded": verification.is_grounded,
                "abstained": abstained,
                "discrepancies": verification.discrepancies,
                "claim_count": verification.total_claim_count,
                "supported_claim_count": verification.grounded_claim_count,
                "latency_ms": gen_out["latency_ms"],
                "tokens_generated": gen_out["tokens_generated"]
            })

        total_duration = time.time() - start_time
        peak_vram_mb = torch.cuda.max_memory_allocated() / (1024**2)

        generator.unload()

        import numpy as np
        med_lat = float(np.median(latencies)) if latencies else 0.0
        p95_lat = float(np.percentile(latencies, 95)) if latencies else 0.0

        benchmark_report["models"][label] = {
            "model_name": model_name,
            "load_time_sec": round(generator.load_time_sec, 2),
            "total_benchmark_sec": round(total_duration, 2),
            "peak_vram_mb": round(peak_vram_mb, 1),
            "median_latency_ms": round(med_lat, 2),
            "p95_latency_ms": round(p95_lat, 2),
            "metrics": counts,
            "results": model_results
        }

        print(f"\n--- {label} SUMMARY ---")
        print(f"Correctly Grounded Answers: {counts['correctly_grounded']} / 22 in-domain ({counts['correctly_grounded']/22*100:.1f}%)")
        print(f"Correct Abstentions: {counts['correctly_abstained']} / 24 negative ({counts['correctly_abstained']/24*100:.1f}%)")
        print(f"Incorrect Answers (Contradictions): {counts['incorrectly_answered']}")
        print(f"False Abstentions: {counts['incorrectly_abstained']} / 22 ({counts['incorrectly_abstained']/22*100:.1f}%)")
        print(f"Supported Claims: {counts['supported_claims']} / {counts['total_claims']}")
        print(f"Entity Mismatches: {counts['entity_mismatches']} | Unsupported Claims: {counts['unsupported_claims']}")
        print(f"Median Generation Latency: {med_lat:.1f}ms | Peak VRAM: {peak_vram_mb:.1f}MB")

    # Save artifact
    output_path = WORKSPACE_ROOT / "rag_module" / "data" / "artifacts" / "evaluation" / "generator_benchmark_comparison.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(benchmark_report, f, indent=2)

    print(f"\nSaved complete comparative benchmark report to {output_path}")


if __name__ == "__main__":
    run_benchmark()
