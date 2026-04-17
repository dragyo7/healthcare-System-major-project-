"""
Create a spaCy NLP pipeline for prescription analysis using real drug data.

Requirements:
- Load spaCy model "en_core_web_sm"
- Load drug names from local file data/drug_list.json
- Add EntityRuler before default NER

Tasks:
- Implement load_drug_list() to read JSON file
- Create DRUG patterns dynamically from loaded list

Behavior:
- If drug_list.json is missing, fallback to default drug names
- Ensure pipeline initializes without crashing

Constraints:
- Do NOT call external APIs here
- Keep pipeline fast and lightweight

Goal:
- Dynamically detect real drug names in prescription text
"""