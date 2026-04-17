"""
Drug interaction engine (rule-based).

Goal:
- Detect interactions between multiple drugs.

Input:
- List of drug names

Output:
[
    {
        "drug_pair": [drugA, drugB],
        "severity": str,
        "explanation": str
    }
]

Requirements:
- Use preloaded interaction_dict
- Check all pair combinations
- Normalize drug names before lookup
- Avoid duplicate pair checks
- Return empty list if no interaction found

Functions:
- check_interactions(drugs: list[str], interaction_dict: dict) -> list
"""

from itertools import combinations
from normalizer import normalize_list


def check_interactions(drugs: list, interaction_dict: dict) -> list:
    """
    Check drug-drug interactions.

    Input:
        drugs: list of drug names
        interaction_dict: preloaded dictionary

    Output:
        list of interaction results
    """

    results = []

    # Normalize input drugs
    normalized_drugs = normalize_list(drugs)

    # Generate all unique pairs
    pairs = combinations(normalized_drugs, 2)

    seen = set()

    for drug_a, drug_b in pairs:
        # Avoid duplicate pair checks
        if (drug_a, drug_b) in seen or (drug_b, drug_a) in seen:
            continue

        seen.add((drug_a, drug_b))

        # Check interaction
        if (drug_a, drug_b) in interaction_dict:
            data = interaction_dict[(drug_a, drug_b)]

            results.append({
                "drug_pair": [drug_a, drug_b],
                "severity": data["severity"],
                "explanation": data["description"]
            })

    return results


# 🔍 Test block
if __name__ == "__main__":
    from data_loader import load_drugbank

    interaction_dict = load_drugbank()

    test_drugs = ["Aspirin", "Ibuprofen", "Paracetamol"]

    interactions = check_interactions(test_drugs, interaction_dict)

    print("\nDetected Interactions:")
    for i in interactions:
        print(i)