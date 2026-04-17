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