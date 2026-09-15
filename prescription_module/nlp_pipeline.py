"""
spaCy NLP pipeline for prescription analysis.

Features
--------
- Loads drug names from local JSON
- Uses EntityRuler to detect medicines
- Case-insensitive matching
- No statistical NER (avoids PERSON/ORG mistakes)
"""

import json
from pathlib import Path
import spacy

DATA_FILE = Path("data/drug_list.json")


def load_drug_list():
    """
    Load drug names from JSON.
    Falls back to a small built-in list.
    """

    fallback = [
        "paracetamol",
        "ibuprofen",
        "amoxicillin",
        "metformin",
        "azithromycin",
        "cetirizine",
        "pantoprazole",
        "crocin",
        "dolo"
    ]

    if DATA_FILE.exists():
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                drugs = json.load(f)

            drugs = [
                drug.strip().lower()
                for drug in drugs
                if drug.strip()
            ]

            drugs = sorted(set(drugs))

            if drugs:
                print(f"Loaded {len(drugs)} drug names.")
                return drugs

        except Exception as e:
            print("Error loading drug database:", e)

    print("Using fallback drug list.")
    return fallback


def load_nlp():
    """
    Build the NLP pipeline.
    """

    # Disable pretrained NER completely
    nlp = spacy.load(
        "en_core_web_sm",
        disable=["ner"]
    )

    ruler = nlp.add_pipe(
        "entity_ruler",
        config={
            "phrase_matcher_attr": "LOWER"
        }
    )

    patterns = []

    for drug in load_drug_list():

        patterns.append(
            {
                "label": "DRUG",
                "pattern": drug
            }
        )

    ruler.add_patterns(patterns)

    print(f"EntityRuler loaded with {len(patterns)} patterns.")

    return nlp