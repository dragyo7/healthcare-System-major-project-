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
try:
    from drug_module.normalizer import normalize_drug_name
except ImportError:
    from normalizer import normalize_drug_name



def fetch_openfda_side_effects(drug: str, enable_live: bool = True):
    """
    Fetch side effects from openFDA API with timeout handling.
    """
    if not enable_live:
        return []

    url = "https://api.fda.gov/drug/event.json"

    params = {
        "search": f'patient.drug.medicinalproduct:"{drug}"',
        "limit": 5
    }

    effects = set()

    try:
        response = requests.get(url, params=params, timeout=3)

        if response.status_code != 200:
            return []

        data = response.json()

        for result in data.get("results", []):
            reactions = result.get("patient", {}).get("reaction", [])

            for reaction in reactions:
                effect = reaction.get("reactionmeddrapt")

                # Filter junk values
                if effect and len(effect) > 3:
                    effects.add(effect.lower())

    except Exception as e:
        # Graceful fallback on network timeout/offline
        return []

    return list(effects)


def get_side_effects(drug: str, side_effects_dict: dict, enable_live_fda: bool = True) -> dict:
    """
    Combine verified DailyMed/SIDER rulebase with optional openFDA live adverse event augmentation.
    """
    normalized_drug = normalize_drug_name(drug)

    # Verified DailyMed / SIDER rulebase effects
    sider_effects = side_effects_dict.get(normalized_drug, [])

    # Optional live openFDA effects
    fda_effects = fetch_openfda_side_effects(normalized_drug, enable_live=enable_live_fda)

    # Merge + limit
    combined = list(set(sider_effects + fda_effects))[:15]

    source_label = "DailyMed / SIDER + openFDA (Live)" if fda_effects else "DailyMed / SIDER (Verified Rulebase)"

    return {
        "drug": normalized_drug,
        "side_effects": combined,
        "source": source_label,
        "live_fda_augmented": bool(fda_effects)
    }


# 🔍 Test block
if __name__ == "__main__":
    from data_loader import load_sider

    side_effects_dict = load_sider()

    test_drug = "Aspirin"

    result = get_side_effects(test_drug, side_effects_dict)

    print("\nSide Effects Result:")
    print(result)