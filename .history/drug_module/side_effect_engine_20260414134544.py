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