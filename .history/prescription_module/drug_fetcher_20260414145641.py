"""
Fetch real-world drug names from OpenFDA API and store locally.

Requirements:
- Use requests library to call OpenFDA drug label API
- Extract generic_name field from openfda section
- Clean and normalize drug names (lowercase, strip spaces)
- Remove duplicates using a set

Tasks:
- Implement fetch_drug_names(limit=50)
- Implement save_drugs_to_file()

Behavior:
- Fetch drug names once
- Save to data/drug_list.json
- Do NOT call API during runtime of main system

Constraints:
- Handle API failure gracefully
- Ensure file is saved in data/ directory

Goal:
- Build a reusable drug database for NLP pipeline
"""


import requests
import json

def fetch_drug_names(limit=50):
    url = f"https://api.fda.gov/drug/label.json?limit={limit}"
    drugs = set()

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()

        for item in data.get("results", []):
            names = item.get("openfda", {}).get("generic_name", [])
            for name in names:
                drugs.add(name.lower().strip())

    except Exception as e:
        print("Error fetching drugs:", e)

    return list(drugs)


def save_drugs_to_file():
    drugs = fetch_drug_names(100)

    if not drugs:
        print("No drugs fetched, using fallback list")
        drugs = ["paracetamol", "ibuprofen", "amoxicillin", "metformin"]

    with open("data/drug_list.json", "w") as f:
        json.dump(drugs, f, indent=2)

    print(f"Saved {len(drugs)} drugs to data/drug_list.json")


if __name__ == "__main__":
    save_drugs_to_file()