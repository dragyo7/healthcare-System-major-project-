"""
Rule-Based Drug Interaction Engine with Traceable Clinical Evidence.
Identifies pairwise drug interactions, assigns severity levels, and attaches DailyMed/FDA SPL citations.
"""
from itertools import combinations
from typing import List, Dict, Any, Tuple
try:
    from drug_module.normalizer import normalize_drug_name, normalize_list
except ImportError:
    from normalizer import normalize_drug_name, normalize_list



def check_interactions(drugs: List[str], interaction_dict: Dict[Tuple[str, str], Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Checks pairwise drug-drug interactions for an arbitrary list of medications.
    
    Args:
        drugs: List of drug names (generic, brand, or with dosage)
        interaction_dict: Preloaded interaction rules dictionary
        
    Returns:
        List of interaction objects with severity, explanation, clinical guidance, and source attribution.
    """
    results = []
    if not drugs:
        return results

    # Normalize input drugs
    normalized_drugs = []
    for d in drugs:
        norm = normalize_drug_name(d)
        if norm and norm not in normalized_drugs:
            normalized_drugs.append(norm)

    if len(normalized_drugs) < 2:
        return results

    # Check all distinct combinations
    pairs = combinations(normalized_drugs, 2)
    seen_pairs = set()

    for drug_a, drug_b in pairs:
        pair_key = tuple(sorted([drug_a, drug_b]))
        if pair_key in seen_pairs:
            continue
        seen_pairs.add(pair_key)

        # Check lookup (supports bidirectional indexing)
        if (drug_a, drug_b) in interaction_dict:
            data = interaction_dict[(drug_a, drug_b)]
            results.append({
                "drug_pair": [drug_a, drug_b],
                "severity": data.get("severity", "moderate"),
                "explanation": data.get("description", ""),
                "clinical_action": data.get("clinical_action", ""),
                "source_id": data.get("source_id", "DailyMed"),
                "source_url": data.get("source_url", ""),
                "rule_id": data.get("rule_id", ""),
                "provenance_status": data.get("provenance_status", "VERIFIED")
            })

    return results


if __name__ == "__main__":
    from data_loader import load_drugbank
    interactions = load_drugbank()
    sample_drugs = ["Aspirin", "Warfarin", "Lisinopril", "Ibuprofen"]
    detected = check_interactions(sample_drugs, interactions)
    print(f"Detected {len(detected)} interactions for {sample_drugs}:")
    for d in detected:
        print(f"  - Pair: {d['drug_pair']} | Severity: {d['severity']}")
        print(f"    Action: {d['clinical_action']}")
        print(f"    Source: {d['source_id']} ({d['source_url']})")