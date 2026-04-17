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

import spacy
from spacy.pipeline import EntityRuler
import json


def load_drug_list():
    try:
        with open("data/drug_list.json", "r") as f:
            return json.load(f)
    except:
        return ["paracetamol", "ibuprofen", "amoxicillin", "metformin"]


def load_nlp():
    nlp = spacy.load("en_core_web_sm")

    ruler = nlp.add_pipe("entity_ruler", before="ner")

    drug_list = load_drug_list()

    patterns = [
        {"label": "DRUG", "pattern": drug}
        for drug in drug_list
    ]

    ruler.add_patterns(patterns)

    return nlp