"""
Rule-Based Drug Interaction Engine with Traceable Clinical Evidence.
Identifies pairwise drug interactions, assigns severity levels, and attaches DailyMed/FDA SPL citations.
"""
from itertools import combinations
from typing import List, Dict, Any, Tuple
try:
    from drug_module.normalizer import get_drug_identity, decompose_medication, normalize_drug_name, normalize_list
except ImportError:
    from normalizer import get_drug_identity, decompose_medication, normalize_drug_name, normalize_list


def check_interactions(drugs: List[str], interaction_dict: Dict[Tuple[str, str], Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Checks pairwise drug-drug interactions for an arbitrary list of medications,
    including decomposition of verified combination products.

    Args:
        drugs: List of drug names (generic, brand, or with dosage)
        interaction_dict: Preloaded interaction rules dictionary

    Returns:
        List of interaction objects with severity, explanation, clinical guidance, and source attribution.
    """
    detailed = screen_medications_detailed(drugs, interaction_dict)
    return detailed.get("interactions", [])


def screen_medications_detailed(
    drugs: List[str],
    interaction_dict: Dict[Tuple[str, str], Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Comprehensive medication screening returning:
    - interactions: pairwise clinical DDI alerts with rule provenance
    - duplicate_ingredients: detected ingredient redundancies (e.g. Combiflam + Dolo)
    - evaluated_drugs: structured identities of all input medications
    - unindexed_drugs: drugs not present in verified dictionary
    """
    results = []
    duplicate_ingredients = []
    evaluated_drugs = []
    unindexed_drugs = []

    if not drugs:
        return {
            "interactions": [],
            "duplicate_ingredients": [],
            "evaluated_drugs": [],
            "unindexed_drugs": []
        }

    # Map input drugs to structured identities
    ingredient_to_sources: Dict[str, List[str]] = {}

    for d in drugs:
        if not d or not str(d).strip():
            continue
        ident = get_drug_identity(str(d).strip())
        evaluated_drugs.append(ident)
        raw_name = ident.get("raw_name", str(d))

        if ident.get("status") == "UNRECOGNIZED":
            unindexed_drugs.append(raw_name)

        for ing in ident.get("active_ingredients", []):
            ing_lower = ing.lower().strip()
            if ing_lower not in ingredient_to_sources:
                ingredient_to_sources[ing_lower] = []
            if raw_name not in ingredient_to_sources[ing_lower]:
                ingredient_to_sources[ing_lower].append(raw_name)

    # 1. Detect duplicate active ingredients across distinct prescribed medications
    for ing, source_meds in ingredient_to_sources.items():
        if len(source_meds) > 1:
            duplicate_ingredients.append({
                "ingredient": ing,
                "source_medications": source_meds,
                "severity": "moderate",
                "finding": f"Duplicate active ingredient '{ing}' co-prescribed across multiple medicines: {', '.join(source_meds)}. Synergistic risk of supratherapeutic dosing.",
                "clinical_action": f"Reconcile prescription to avoid redundant administration of {ing}."
            })

    # 2. Pairwise interaction screening across all distinct active ingredients
    all_ingredients = list(ingredient_to_sources.keys())
    if len(all_ingredients) >= 2:
        pairs = combinations(all_ingredients, 2)
        seen_pairs = set()

        for ing_a, ing_b in pairs:
            pair_key = tuple(sorted([ing_a, ing_b]))
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)

            # Check lookup (supports bidirectional indexing)
            matched_data = None
            if (ing_a, ing_b) in interaction_dict:
                matched_data = interaction_dict[(ing_a, ing_b)]
            elif (ing_b, ing_a) in interaction_dict:
                matched_data = interaction_dict[(ing_b, ing_a)]

            if matched_data:
                source_a_list = ingredient_to_sources.get(ing_a, [ing_a])
                source_b_list = ingredient_to_sources.get(ing_b, [ing_b])

                # Explain combination product constituent if brand differs from ingredient
                explanation = matched_data.get("description", "") or matched_data.get("finding", "")
                addendum = []
                for s_a in source_a_list:
                    if s_a.lower() != ing_a:
                        addendum.append(f"'{s_a}' contains active moiety '{ing_a}'")
                for s_b in source_b_list:
                    if s_b.lower() != ing_b:
                        addendum.append(f"'{s_b}' contains active moiety '{ing_b}'")

                if addendum:
                    explanation = f"[{'; '.join(addendum)}] - {explanation}"

                results.append({
                    "drug_pair": [ing_a, ing_b],
                    "involved_medications": source_a_list + source_b_list,
                    "severity": matched_data.get("severity", "moderate"),
                    "explanation": explanation,
                    "clinical_action": matched_data.get("clinical_action", ""),
                    "source_id": matched_data.get("source_id", "DailyMed"),
                    "source_url": matched_data.get("source_url", ""),
                    "rule_id": matched_data.get("rule_id", ""),
                    "provenance_status": matched_data.get("provenance_status", "VERIFIED")
                })

    return {
        "interactions": results,
        "duplicate_ingredients": duplicate_ingredients,
        "evaluated_drugs": evaluated_drugs,
        "unindexed_drugs": unindexed_drugs
    }


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