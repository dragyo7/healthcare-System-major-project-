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