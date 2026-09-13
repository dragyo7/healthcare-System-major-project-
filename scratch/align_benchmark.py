"""
Updates pharmacology_benchmark.json with exact document_id from corpus.json.
"""
import json
from pathlib import Path

def align_benchmark():
    corpus_path = Path("rag_module/data/artifacts/dailymed_pilot/corpus.json")
    benchmark_path = Path("rag_module/evaluation/pharmacology_benchmark.json")

    with open(corpus_path, "r", encoding="utf-8") as f:
        corpus = json.load(f)

    with open(benchmark_path, "r", encoding="utf-8") as f:
        benchmark = json.load(f)

    # Build mapping (drug_lower, section_lower) -> document_id
    doc_map = {}
    for doc in corpus:
        drug = doc.get("metadata", {}).get("drug_name", "").lower()
        sec = doc.get("section", "").lower()
        doc_map[(drug, sec)] = doc["document_id"]

    for item in benchmark:
        drug = item["expected_drug"].lower()
        for sec in item["expected_sections"]:
            sec_l = sec.lower()
            # Match directly or by prefix
            match = next((doc_id for (d, s), doc_id in doc_map.items() if d == drug and (sec_l in s or s in sec_l)), None)
            if match:
                item["expected_document_id"] = match
                break

    with open(benchmark_path, "w", encoding="utf-8") as f:
        json.dump(benchmark, f, indent=2)

    print(f"Aligned {len(benchmark)} benchmark queries with exact corpus document IDs.")

if __name__ == "__main__":
    align_benchmark()
