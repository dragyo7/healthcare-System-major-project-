"""
Benchmark Leakage and Contamination Checker for RAG V2.6-B.
Audits queries for duplicates, verbatim chunk overlap, answer leakage, and ground truth integrity.
"""

import json
import pickle
import re
from typing import Dict, List, Any, Optional

def extract_ngrams(text: str, n: int = 5) -> set:
    """Extract word n-grams from normalized text."""
    words = re.findall(r'\b\w+\b', text.lower())
    if len(words) < n:
        return set()
    return set(' '.join(words[i:i+n]) for i in range(len(words) - n + 1))

def run_leakage_audit(
    dataset_path: str = 'rag_module/evaluation/v26_benchmark_dataset.json',
    meta_path: str = 'rag_module/data/faiss_index/meta_v2.pkl',
    ngram_size: int = 6,
    max_allowed_overlap_ratio: float = 0.50
) -> Dict[str, Any]:
    """
    Run complete leakage and contamination audit on benchmark dataset against corpus index metadata.
    """
    with open(dataset_path, 'r', encoding='utf-8') as f:
        queries = json.load(f)

    with open(meta_path, 'rb') as f:
        meta = pickle.load(f)

    meta_by_chunk_id = {m['chunk_id']: m for m in meta}
    meta_by_doc_id = {}
    for m in meta:
        doc_id = m['document_id']
        if doc_id not in meta_by_doc_id:
            meta_by_doc_id[doc_id] = []
        meta_by_doc_id[doc_id].append(m)

    audit_results = {
        "total_queries": len(queries),
        "unique_query_ids": len(set(q["query_id"] for q in queries)),
        "unique_query_texts": len(set(q["query"].strip().lower() for q in queries)),
        "duplicate_queries": [],
        "invalid_ground_truth_chunks": [],
        "invalid_ground_truth_docs": [],
        "high_ngram_leakages": [],
        "audit_passed": True,
        "summary": {}
    }

    # 1. Duplicate check
    seen_ids = set()
    seen_texts = {}
    for q in queries:
        qid = q["query_id"]
        qtext = q["query"].strip().lower()

        if qid in seen_ids:
            audit_results["duplicate_queries"].append({"type": "duplicate_id", "query_id": qid})
        seen_ids.add(qid)

        if qtext in seen_texts:
            audit_results["duplicate_queries"].append({
                "type": "duplicate_text",
                "query_id": qid,
                "first_seen_id": seen_texts[qtext]
            })
        seen_texts[qtext] = qid

    # 2. Ground truth integrity & n-gram overlap check
    for q in queries:
        qid = q["query_id"]
        qtext = q["query"]
        q_ngrams = extract_ngrams(qtext, n=ngram_size)

        for gt in q.get("ground_truth", []):
            cid = gt["chunk_id"]
            did = gt["document_id"]

            if cid not in meta_by_chunk_id:
                audit_results["invalid_ground_truth_chunks"].append({"query_id": qid, "chunk_id": cid})
            if did not in meta_by_doc_id:
                audit_results["invalid_ground_truth_docs"].append({"query_id": qid, "document_id": did})

            # Check n-gram overlap with target chunk text
            if cid in meta_by_chunk_id:
                chunk_text = meta_by_chunk_id[cid].get("text", "")
                chunk_ngrams = extract_ngrams(chunk_text, n=ngram_size)

                if q_ngrams and chunk_ngrams:
                    overlap = q_ngrams.intersection(chunk_ngrams)
                    overlap_ratio = len(overlap) / len(q_ngrams)
                    if overlap_ratio > max_allowed_overlap_ratio:
                        audit_results["high_ngram_leakages"].append({
                            "query_id": qid,
                            "chunk_id": cid,
                            "overlap_ratio": overlap_ratio,
                            "shared_ngrams": list(overlap)[:3]
                        })

    # 3. Overall pass status
    if (audit_results["unique_query_ids"] != audit_results["total_queries"] or
        audit_results["unique_query_texts"] != audit_results["total_queries"] or
        audit_results["duplicate_queries"] or
        audit_results["invalid_ground_truth_chunks"] or
        audit_results["invalid_ground_truth_docs"] or
        audit_results["high_ngram_leakages"]):
        audit_results["audit_passed"] = False

    audit_results["summary"] = {
        "status": "PASS" if audit_results["audit_passed"] else "FAIL",
        "duplicate_count": len(audit_results["duplicate_queries"]),
        "invalid_chunk_count": len(audit_results["invalid_ground_truth_chunks"]),
        "invalid_doc_count": len(audit_results["invalid_ground_truth_docs"]),
        "high_ngram_leakage_count": len(audit_results["high_ngram_leakages"])
    }

    return audit_results

if __name__ == '__main__':
    report = run_leakage_audit()
    print(json.dumps(report, indent=2))
