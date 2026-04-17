"""
Side effect detection engine.

Goal:
- Fetch side effects from SIDER
- Augment with openFDA API data

Requirements:
- Input: single drug name
- Normalize drug name
- Lookup in side_effects_dict
- Call openFDA API for adverse events

API:
- Use requests
- Endpoint: https://api.fda.gov/drug/event.json
- Query using drug name

Output:
{
    "side_effects": list[str],
    "source": "SIDER + openFDA"
}

Functions:
- get_side_effects(drug: str, side_effects_dict: dict) -> dict

Notes:
- Handle API failures (timeout, empty response)
- Limit results to avoid huge output
"""

import requests
from normalizer import normalize_drug_name


def fetch_openfda_side_effects(drug: str):
    """
    Fetch side effects from openFDA API
    """
    if len(effect) > 3:
        effects.add(effect.lower())
    
    url = "https://api.fda.gov/drug/event.json"

    params = {
        "search": f'patient.drug.medicinalproduct:"{drug}"',
        "limit": 5
    }

    effects = set()

    try:
        response = requests.get(url, params=params, timeout=5)

        if response.status_code != 200:
            return []

            for result in data.get("results", []):
                for reaction in result.get("patient", {}).get("reaction", []):
                    effect = reaction.get("reactionmeddrapt")
                    if effect:
                        effects.add(effect.lower())

    except Exception as e:
        print("openFDA error:", e)

    return list(effects)


def get_side_effects(drug: str, side_effects_dict: dict) -> dict:
    """
    Combine SIDER + openFDA
    """

    normalized_drug = normalize_drug_name(drug)

    # Get SIDER effects
    sider_effects = side_effects_dict.get(normalized_drug, [])

    # Get openFDA effects
    fda_effects = fetch_openfda_side_effects(normalized_drug)

    # Merge + remove duplicates
    combined = list(set(sider_effects + fda_effects))[:15]

    return {
        "drug": normalized_drug,
        "side_effects": combined,
        "source": "SIDER + openFDA"
    }


# 🔍 Test block
if __name__ == "__main__":
    from data_loader import load_sider

    side_effects_dict = load_sider()

    test_drug = "Aspirin"

    result = get_side_effects(test_drug, side_effects_dict)

    print("\nSide Effects Result:")
    print(result)