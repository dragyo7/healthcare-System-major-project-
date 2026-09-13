"""
RAG V2.5 Phase 4: MedQuAD vs DailyMed Deduplication and Overlap Analysis.
Analyzes:
1. Exact SHA-256 hash collision rate between MedQuAD and DailyMed.
2. Drug name mentions in MedQuAD vs DailyMed.
3. Content near-duplicate overlap (Jaccard > 0.85).
4. Content complementarity: General patient Q&A vs Prescribing information.
"""
import json
import re
import sys
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from rag_module.context.context_builder import compute_word_overlap


def analyze_overlap():
    medquad_path = Path("rag_module/rag_module/data/clean_corpus_v2.json")
    dailymed_path = Path("rag_module/data/artifacts/dailymed_pilot/corpus.json")

    with open(medquad_path, "r", encoding="utf-8") as f:
        medquad_docs = json.load(f)

    with open(dailymed_path, "r", encoding="utf-8") as f:
        dailymed_docs = json.load(f)

    print(f"Loaded {len(medquad_docs)} MedQuAD records and {len(dailymed_docs)} DailyMed documents.")

    # 1. Exact Content Hash Collisions
    medquad_hashes = {d.get("content_hash", "") for d in medquad_docs if d.get("content_hash")}
    dailymed_hashes = {d.get("content_hash", "") for d in dailymed_docs if d.get("content_hash")}
    exact_overlap = medquad_hashes.intersection(dailymed_hashes)
    print(f"\n1. Exact SHA-256 Hash Overlaps: {len(exact_overlap)}")

    # 2. Drug Entity Overlap
    drugs_25 = [
        "lisinopril", "amlodipine", "atorvastatin", "losartan", "metoprolol",
        "hydrochlorothiazide", "metformin", "glipizide", "empagliflozin", "amoxicillin",
        "azithromycin", "ciprofloxacin", "doxycycline", "levothyroxine", "prednisone",
        "gabapentin", "levetiracetam", "albuterol", "fluticasone", "omeprazole",
        "pantoprazole", "ondansetron", "tramadol", "sertraline", "duloxetine"
    ]

    drug_in_medquad_count = defaultdict(int)
    for doc in medquad_docs:
        text = (doc.get("title", "") + " " + doc.get("content", "") + " " + doc.get("question", "") + " " + doc.get("answer", "")).lower()
        for drug in drugs_25:
            if re.search(r'\b' + re.escape(drug) + r'\b', text):
                drug_in_medquad_count[drug] += 1

    print("\n2. Drug Mentions in MedQuAD (16,406 corpus):")
    for drug in sorted(drugs_25):
        count = drug_in_medquad_count[drug]
        print(f"  - {drug.capitalize()}: {count} MedQuAD QA pairs")

    # 3. Near-Duplicate Analysis (Jaccard > 0.85)
    near_duplicates = []
    for d_doc in dailymed_docs:
        d_text = d_doc.get("content", "")
        for m_doc in medquad_docs[:500]: # Sample check
            m_text = m_doc.get("content") or m_doc.get("answer", "")
            if compute_word_overlap(d_text, m_text) >= 0.85:
                near_duplicates.append((d_doc["document_id"], m_doc.get("document_id", "mq")))

    print(f"\n3. Near-Duplicate Collisions Sampled: {len(near_duplicates)}")

    # 4. Complementarity Sample
    print("\n4. Qualitative Source Distinction Example:")
    print("--- MedQuAD sample on Lisinopril ---")
    mq_liso = next((d for d in medquad_docs if "lisinopril" in (d.get("title","") + d.get("question","")).lower()), None)
    if mq_liso:
        print(f"Title/Q: {mq_liso.get('title') or mq_liso.get('question')}")
        print(f"Content excerpt: {mq_liso.get('content', '')[:180]}...")
    else:
        print("No dedicated MedQuAD record for Lisinopril.")

    print("\n--- DailyMed sample on Lisinopril (Boxed Warning) ---")
    dm_liso = next((d for d in dailymed_docs if "Lisinopril - Boxed Warning" in d.get("title","")), None)
    if dm_liso:
        print(f"Title: {dm_liso['title']}")
        print(f"Content: {dm_liso['content']}")


if __name__ == "__main__":
    analyze_overlap()
