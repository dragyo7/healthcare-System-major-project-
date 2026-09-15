"""
Human-Readable RAG Trace CLI (Deliverable 29)
Runs any clinical query through the full pipeline and prints an auditable step-by-step trace.
"""
import sys
import argparse
from pathlib import Path
import numpy as np

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.service import RAGService, RAGQueryRequest
from rag_module.rag_pipeline import MedicalRAGPipeline

def trace_query(query: str, top_k: int = 3):
    print("=" * 80)
    print("HEALTHCARE RAG SYSTEM — FORENSIC CLINICAL EXECUTION TRACE")
    print("=" * 80)
    
    service = RAGService(config=DEFAULT_CONFIG)
    
    # 1. User Query & Safety
    print("\n" + "=" * 50)
    print("USER QUERY")
    print("=" * 50)
    print(f"Query: {query}")
    safety = service.query_safety.assess_query(query)
    print(f"Safety Assessment: RiskCategory={safety.risk_category.value if hasattr(safety.risk_category, 'value') else safety.risk_category} | IsEmergency={safety.is_emergency}")
    if safety.is_emergency:
        print(f"Emergency Alert: {safety.emergency_message}")
        print("\n" + "=" * 50)
        print("VERDICT: Intercepted by Acute Emergency Triage Guardrail")
        print("=" * 50)
        return

    # 2. Query Embedding
    print("\n" + "=" * 50)
    print("QUERY EMBEDDING")
    print("=" * 50)
    q_vec = service.dense_retriever.embedder.encode_query(safety.sanitized_query or query)
    print(f"model:     {service.config.EMBEDDING_MODEL_NAME}")
    print(f"dimension: {q_vec.shape[1]}")
    print(f"norm:      {float(np.linalg.norm(q_vec[0])):.4f}")

    # 3. Dense Retrieval
    print("\n" + "=" * 50)
    print("DENSE RETRIEVAL (FAISS IndexFlatIP)")
    print("=" * 50)
    dense_hits = service.dense_retriever.search(safety.sanitized_query or query, top_k=top_k)
    for r, (idx, score) in enumerate(dense_hits, start=1):
        c = service.dense_retriever.metadata[idx]
        print(f"{r}. [{c.get('chunk_id')}] / Cosine Score: {score:.4f} / Source: {c.get('source_id')} / Section: '{c.get('section')}'")

    # 4. BM25 Retrieval
    print("\n" + "=" * 50)
    print("BM25 RETRIEVAL (BM25Okapi Lexical Index)")
    print("=" * 50)
    bm25_hits = service.bm25_retriever.search(safety.sanitized_query or query, top_k=top_k)
    for r, (idx, score) in enumerate(bm25_hits, start=1):
        c = service.bm25_retriever.metadata[idx]
        print(f"{r}. [{c.get('chunk_id')}] / BM25 Score: {score:.4f} / Source: {c.get('source_id')} / Section: '{c.get('section')}'")

    # 5. Hybrid RRF Fusion
    print("\n" + "=" * 50)
    print("HYBRID RECIPROCAL RANK FUSION (RRF, k=60)")
    print("=" * 50)
    hybrid_chunks = service.hybrid_retriever.search(safety.sanitized_query or query, final_k=top_k)
    for r, c in enumerate(hybrid_chunks, start=1):
        print(f"{r}. [{c.get('chunk_id')}] / Fused RRF Score: {c.get('fused_score'):.6f} (DenseRank={c.get('dense_rank')}, BM25Rank={c.get('bm25_rank')})")

    # 6. Cross-Encoder Reranking
    print("\n" + "=" * 50)
    print("CROSS-ENCODER RERANKER (ms-marco-MiniLM-L-6-v2)")
    print("=" * 50)
    reranked = service.reranker.rerank(safety.sanitized_query or query, hybrid_chunks, top_k=top_k)
    for r, c in enumerate(reranked, start=1):
        print(f"{r}. [{c.get('chunk_id')}] / Rerank Score: {c.get('rerank_score', 0.0):.4f} / Title: {c.get('title')} / Section: '{c.get('section')}'")

    # 7. Evidence Policy Evaluation
    print("\n" + "=" * 50)
    print("EVIDENCE POLICY & GROUNDING ENGINE")
    print("=" * 50)
    req = RAGQueryRequest(query=query, mode="hybrid_rerank", top_k=top_k)
    rag_resp = service.retrieve(req)
    grounding = rag_resp.grounding
    print(f"Status:             {grounding.status.value if hasattr(grounding.status, 'value') else grounding.status}")
    print(f"Generation Allowed: {grounding.generation_allowed}")
    print(f"Candidate IDs:      {[item.chunk_id for item in rag_resp.evidence]}")
    print(f"Accepted IDs:       {grounding.accepted_chunk_ids}")
    rejected_ids = [item.chunk_id for item in rag_resp.evidence if item.chunk_id not in grounding.accepted_chunk_ids]
    print(f"Rejected IDs:       {rejected_ids}")
    print(f"Reason Codes:       {[r.value if hasattr(r, 'value') else str(r) for r in grounding.reason_codes]}")
    print(f"Warnings:           {grounding.warnings}")

    # 8. Generator Context
    print("\n" + "=" * 50)
    print("GENERATOR CONTEXT (Strictly bounded to Accepted IDs)")
    print("=" * 50)
    if rag_resp.context_text:
        print(rag_resp.context_text)
    else:
        print("[Context Suppressed: Generation Blocked by Grounding Policy]")

    # 9. LLM Generation & Citations
    print("\n" + "=" * 50)
    print("FINAL ANSWER & CITATION ATTRIBUTION")
    print("=" * 50)
    if grounding.generation_allowed:
        pipeline = MedicalRAGPipeline()
        chat_res = pipeline.query(user_query=query, mode="hybrid_rerank", generate_answer=True)
        print(f"Answer:\n{chat_res.get('answer')}\n")
        print("Citations:")
        for s in chat_res.get("sources", []):
            print(f"  - [{s.get('source_name')}] {s.get('title')} (Section: {s.get('qtype')})")
            print(f"    Chunk ID: {s.get('chunk_id')} | URL: {s.get('url')}")
    else:
        print("I am not able to find sufficient verified medical evidence to answer this question.")

    # 10. Verdict
    print("\n" + "=" * 50)
    print("VERDICT")
    print("=" * 50)
    print(f"Grounded:            {'YES' if grounding.generation_allowed else 'NO (Safe Abstention)'}")
    print(f"Citation Correct:    {'YES' if grounding.generation_allowed else 'N/A'}")
    print(f"Evidence Sufficient: {'YES' if grounding.status.value == 'grounded' else 'NO'}")
    print(f"Unsupported Claim:   NO")
    print("=" * 80)

def main():
    parser = argparse.ArgumentParser(description="Healthcare RAG Forensic Execution Trace CLI")
    parser.add_argument(
        "--query", "-q",
        type=str,
        default="What does the official labeling say about metformin in patients with severe renal impairment?",
        help="Clinical query to execute"
    )
    parser.add_argument("--top_k", "-k", type=int, default=3, help="Number of evidence chunks to retrieve")
    args = parser.parse_args()
    trace_query(args.query, args.top_k)

if __name__ == "__main__":
    main()
