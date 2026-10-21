"""
Drug Normalization Module.
Provides robust clinical drug name normalization using RxNorm terminology mapping
and multi-tier brand/salt/synonym resolution.
"""
import re
import sys
from pathlib import Path
from typing import List, Optional

# Attempt to load RxNormNormalizer from RAG module
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:
    from rag_module.ingestion.adapters.rxnorm_adapter import RxNormNormalizer
    _rxnorm_normalizer = RxNormNormalizer.get_instance()
except Exception:
    _rxnorm_normalizer = None

# Comprehensive fallback synonym dictionary
FALLBACK_SYNONYMS = {
    "tylenol": "paracetamol",
    "acetaminophen": "paracetamol",
    "calpol": "paracetamol",
    "dolo": "paracetamol",
    "crocin": "paracetamol",
    "panadol": "paracetamol",
    "advil": "ibuprofen",
    "motrin": "ibuprofen",
    "brufen": "ibuprofen",
    "nurofen": "ibuprofen",
    "coumadin": "warfarin",
    "jantoven": "warfarin",
    "zestril": "lisinopril",
    "prinivil": "lisinopril",
    "norvasc": "amlodipine",
    "lipitor": "atorvastatin",
    "glucophage": "metformin",
    "plavix": "clopidogrel",
    "eliquis": "apixaban",
    "xarelto": "rivaroxaban",
    "amoxil": "amoxicillin",
    "cipro": "ciprofloxacin",
    "levaquin": "levofloxacin",
    "prilosec": "omeprazole",
    "nexium": "esomeprazole",
    "tegretol": "carbamazepine",
    "lanoxin": "digoxin",
    "lasix": "furosemide",
    "tenormin": "atenolol",
    "cozaar": "losartan",
    "zithromax": "azithromycin",
    "biaxin": "clarithromycin",
    "pepcid": "famotidine",
    "protonix": "pantoprazole"
}

# Verified multi-ingredient combination drug products
# Maps combination brand/common name to constituent canonical active ingredients
COMBINATION_DRUGS = {
    "combiflam": ["ibuprofen", "paracetamol"],
    "augmentin": ["amoxicillin", "clavulanate"],
    "bactrim": ["sulfamethoxazole", "trimethoprim"],
    "septra": ["sulfamethoxazole", "trimethoprim"],
    "allegra-d": ["fexofenadine", "pseudoephedrine"],
    "allegrad": ["fexofenadine", "pseudoephedrine"],
    "vicodin": ["hydrocodone", "paracetamol"],
    "percocet": ["oxycodone", "paracetamol"],
    "sinemet": ["carbidopa", "levodopa"],
    "janumet": ["sitagliptin", "metformin"],
    "galvus met": ["vildagliptin", "metformin"],
    "galvusmet": ["vildagliptin", "metformin"],
    "vildaprime m": ["vildagliptin", "metformin"],
    "vildaprimem": ["vildagliptin", "metformin"]
}

# Known verified single-agent canonical ingredients
KNOWN_CANONICAL_INGREDIENTS = {
    "paracetamol", "acetaminophen", "ibuprofen", "aspirin", "warfarin",
    "lisinopril", "amlodipine", "atorvastatin", "metformin", "clopidogrel",
    "apixaban", "rivaroxaban", "amoxicillin", "clavulanate", "ciprofloxacin",
    "levofloxacin", "omeprazole", "esomeprazole", "pantoprazole", "famotidine",
    "carbamazepine", "digoxin", "furosemide", "atenolol", "losartan",
    "methotrexate", "clarithromycin", "azithromycin", "alcohol",
    "sulfamethoxazole", "trimethoprim", "fexofenadine", "pseudoephedrine",
    "hydrocodone", "oxycodone", "carbidopa", "levodopa", "sitagliptin", "vildagliptin"
}


def clean_drug_input(name: str) -> str:
    """Strips dosage, forms, and punctuation from drug name."""
    if not name:
        return ""
    raw = name.strip().lower()
    cleaned = re.sub(r"\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|tablets?|capsules?|oral)\b", "", raw, flags=re.IGNORECASE)
    cleaned = re.sub(r"[^a-z0-9\s-]", "", cleaned).strip()
    return cleaned


def get_drug_identity(name: str) -> dict:
    """
    Returns structured identity model for a given drug name:
    - raw_name: original input string
    - canonical_name: primary canonical or brand name
    - active_ingredients: list of canonical active chemical moieties
    - is_combination: bool
    - status: 'IDENTIFIED' | 'UNRECOGNIZED'
    - provenance: source of identification
    """
    if not name:
        return {
            "raw_name": "",
            "canonical_name": "",
            "active_ingredients": [],
            "is_combination": False,
            "status": "UNRECOGNIZED",
            "provenance": "EMPTY_INPUT"
        }

    raw = name.strip()
    cleaned = clean_drug_input(raw)

    # 1. Check verified combination products first
    if cleaned in COMBINATION_DRUGS:
        ingredients = COMBINATION_DRUGS[cleaned]
        return {
            "raw_name": raw,
            "canonical_name": cleaned,
            "active_ingredients": list(ingredients),
            "is_combination": True,
            "status": "IDENTIFIED",
            "provenance": "VERIFIED_COMBINATION_MAPPING"
        }

    for comb_name, ingredients in COMBINATION_DRUGS.items():
        if re.search(r"\b" + re.escape(comb_name) + r"\b", cleaned):
            return {
                "raw_name": raw,
                "canonical_name": comb_name,
                "active_ingredients": list(ingredients),
                "is_combination": True,
                "status": "IDENTIFIED",
                "provenance": "VERIFIED_COMBINATION_MAPPING"
            }

    # 2. Check RxNorm normalizer if available
    if _rxnorm_normalizer:
        match = _rxnorm_normalizer.normalize(cleaned)
        if match:
            canon = match.canonical_name.lower()
            return {
                "raw_name": raw,
                "canonical_name": canon,
                "active_ingredients": [canon],
                "is_combination": False,
                "status": "IDENTIFIED",
                "provenance": "RXNORM_ADAPTER"
            }

    # 3. Check fallback synonym mapping (exact)
    if cleaned in FALLBACK_SYNONYMS:
        canon = FALLBACK_SYNONYMS[cleaned]
        return {
            "raw_name": raw,
            "canonical_name": canon,
            "active_ingredients": [canon],
            "is_combination": False,
            "status": "IDENTIFIED",
            "provenance": "FALLBACK_SYNONYM"
        }

    # 4. Check fallback synonym mapping (word-boundary regex)
    for k, v in FALLBACK_SYNONYMS.items():
        if re.search(r"\b" + re.escape(k) + r"\b", cleaned):
            return {
                "raw_name": raw,
                "canonical_name": v,
                "active_ingredients": [v],
                "is_combination": False,
                "status": "IDENTIFIED",
                "provenance": "FALLBACK_SYNONYM"
            }

    # 5. Check if cleaned name itself is an established canonical ingredient
    if cleaned in KNOWN_CANONICAL_INGREDIENTS:
        return {
            "raw_name": raw,
            "canonical_name": cleaned,
            "active_ingredients": [cleaned],
            "is_combination": False,
            "status": "IDENTIFIED",
            "provenance": "CANONICAL_NAME"
        }

    # 6. Unrecognized / unindexed
    return {
        "raw_name": raw,
        "canonical_name": cleaned if cleaned else raw.lower(),
        "active_ingredients": [cleaned if cleaned else raw.lower()],
        "is_combination": False,
        "status": "UNRECOGNIZED",
        "provenance": "UNINDEXED_STRING"
    }


def decompose_medication(name: str) -> list:
    """
    Returns list of active ingredient names for a medication.
    If the drug is a combination product (e.g. Combiflam), returns all active ingredients (['ibuprofen', 'paracetamol']).
    If single ingredient (e.g. Advil), returns ['ibuprofen'].
    """
    identity = get_drug_identity(name)
    return identity.get("active_ingredients", [])


def normalize_drug_name(name: str) -> str:
    """
    Normalizes a single drug name:
    1. Lowers and strips whitespace
    2. Strips common dosage forms (e.g. 500mg, tablet, oral)
    3. Resolves brand/synonym via get_drug_identity
    """
    if not name:
        return ""
    identity = get_drug_identity(name)
    # Return canonical name if identified, else primary active ingredient or cleaned name
    return identity.get("canonical_name") or identity.get("active_ingredients", [""])[0]


def normalize_list(drugs: List[str]) -> List[str]:
    """Normalizes a list of drug names, filtering empty strings."""
    return [normalize_drug_name(d) for d in drugs if d and normalize_drug_name(d)]


if __name__ == "__main__":
    test_drugs = ["Tylenol 500mg", "Advil 200 mg tablet", "Norvasc 5mg", "Glucophage XR", "Brufen"]
    print("Original:", test_drugs)
    print("Normalized:", normalize_list(test_drugs))