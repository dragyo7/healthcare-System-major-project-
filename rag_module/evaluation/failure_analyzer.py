"""
Diagnostic Failure Analyzer for RAG V2.6-B.
Categorizes retrieval outcomes into distinct clinical and diagnostic failure buckets.
"""

from typing import Dict, List, Any, Optional

FAILURE_CATEGORIES = {
    "SUCCESS_RANK_1": "Ground-truth evidence retrieved at Rank 1 with correct entity, section, and source.",
    "RETRIEVED_RANK_GT_1": "Relevant ground-truth evidence successfully retrieved within Top-K but ranked > 1.",
    "WRONG_SECTION_SAME_ENTITY": "Top-1 result matches target entity but points to a different clinical section.",
    "WRONG_ENTITY_SAME_SOURCE": "Top-1 result is from correct source domain but matches a different clinical entity.",
    "WRONG_SOURCE": "Top-1 result originates from an incorrect/unapproved source domain.",
    "ABSENT_FROM_TOP_K": "No ground-truth evidence chunk or document was retrieved anywhere in Top-K.",
    "NOT_APPLICABLE": "Query is out-of-scope for the evaluated isolated corpus.",
    "RETRIEVAL_ERROR": "Execution error encountered during query retrieval."
}

def analyze_query_outcome(
    query_item: Dict[str, Any],
    retrieved_results: List[Dict[str, Any]],
    top_k: int = 10,
    is_applicable: bool = True
) -> Dict[str, Any]:
    """
    Analyze retrieval outcome for a single query against ground truth.
    """
    if not is_applicable:
        return {
            "query_id": query_item.get("query_id"),
            "status": "NOT_APPLICABLE",
            "category": "NOT_APPLICABLE",
            "explanation": "Query target corpus does not match evaluated corpus partition.",
            "top_1_rank_hit": False,
            "top_k_hit": False,
            "hit_rank": None
        }

    if not retrieved_results:
        return {
            "query_id": query_item.get("query_id"),
            "status": "ABSENT_FROM_TOP_K",
            "category": "ABSENT_FROM_TOP_K",
            "explanation": "Retriever returned zero results.",
            "top_1_rank_hit": False,
            "top_k_hit": False,
            "hit_rank": None
        }

    gt_chunk_ids = {gt["chunk_id"] for gt in query_item.get("ground_truth", [])}
    gt_doc_ids = {gt["document_id"] for gt in query_item.get("ground_truth", [])}
    target_entity = query_item.get("target_entity", "").strip().lower()
    target_section = query_item.get("target_section", "").strip().lower()
    acceptable_entities = [e.strip().lower() for e in query_item.get("acceptable_entities", [target_entity])]
    acceptable_sources = [s.strip() for s in query_item.get("acceptable_sources", [])]

    # Find earliest rank of ground truth in retrieved results
    hit_rank = None
    for rank_idx, doc in enumerate(retrieved_results[:top_k], start=1):
        cid = doc.get("chunk_id") or doc.get("metadata", {}).get("chunk_id")
        did = doc.get("document_id") or doc.get("doc_id") or doc.get("metadata", {}).get("document_id")
        if cid in gt_chunk_ids or did in gt_doc_ids:
            hit_rank = rank_idx
            break

    top_1 = retrieved_results[0]
    top_1_meta = top_1.get("metadata", top_1)
    top_1_cid = top_1.get("chunk_id") or top_1_meta.get("chunk_id")
    top_1_did = top_1.get("document_id") or top_1.get("doc_id") or top_1_meta.get("document_id")
    top_1_source = top_1.get("source_id") or top_1_meta.get("source_id")
    top_1_sec = (top_1.get("section") or top_1_meta.get("section") or top_1_meta.get("qtype") or "").strip().lower()
    
    # Entity matching from title / focus
    top_1_title = top_1.get("title") or top_1_meta.get("title", "")
    top_1_focus = top_1.get("focus") or top_1_meta.get("focus", "")
    top_1_entity_str = (top_1_title + " " + top_1_focus).lower()
    
    entity_match = any(acc_ent in top_1_entity_str for acc_ent in acceptable_entities)
    source_match = top_1_source in acceptable_sources if acceptable_sources else True
    section_match = target_section in top_1_sec or top_1_sec in target_section

    if hit_rank == 1:
        category = "SUCCESS_RANK_1"
        explanation = f"Ground truth chunk ({top_1_cid}) retrieved at Rank 1."
    elif hit_rank is not None and hit_rank > 1:
        category = "RETRIEVED_RANK_GT_1"
        explanation = f"Ground truth evidence retrieved at Rank {hit_rank} (within Top-{top_k})."
    elif entity_match and source_match and not section_match:
        category = "WRONG_SECTION_SAME_ENTITY"
        explanation = f"Top-1 matched entity '{target_entity}' but retrieved section '{top_1_sec}' instead of '{target_section}'."
    elif source_match and not entity_match:
        category = "WRONG_ENTITY_SAME_SOURCE"
        explanation = f"Top-1 retrieved from correct source '{top_1_source}' but matched wrong entity (title: '{top_1_title}')."
    elif not source_match:
        category = "WRONG_SOURCE"
        explanation = f"Top-1 retrieved from unapproved source '{top_1_source}'."
    else:
        category = "ABSENT_FROM_TOP_K"
        explanation = f"No ground truth chunk retrieved within Top-{top_k}."

    return {
        "query_id": query_item.get("query_id"),
        "category": category,
        "explanation": explanation,
        "top_1_rank_hit": (hit_rank == 1),
        "top_k_hit": (hit_rank is not None),
        "hit_rank": hit_rank,
        "top_1_source": top_1_source,
        "top_1_section": top_1_sec,
        "top_1_entity_match": entity_match,
        "top_1_source_match": source_match,
        "top_1_section_match": section_match
    }

def summarize_failures(outcome_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate failure category distribution across query outcomes."""
    counts = {k: 0 for k in FAILURE_CATEGORIES.keys()}
    for out in outcome_list:
        cat = out.get("category", "ABSENT_FROM_TOP_K")
        if cat in counts:
            counts[cat] += 1
        else:
            counts["ABSENT_FROM_TOP_K"] += 1
    
    total = len(outcome_list)
    distribution = {k: {"count": v, "percentage": round((v / total * 100) if total > 0 else 0, 2)} for k, v in counts.items()}
    return {
        "total_queries_analyzed": total,
        "distribution": distribution
    }
