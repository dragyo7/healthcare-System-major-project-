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
    "augmentin": "amoxicillin",
    "amoxil": "amoxicillin",
    "cipro": "ciprofloxacin",
    "levaquin": "levofloxacin",
    "prilosec": "omeprazole",
    "nexium": "esomeprazole",
    "tegretol": "carbamazepine",
    "lanoxin": "digoxin",
    "lasix": "furosemide",
    "tenormin": "atenolol",
    "cozaar": "losartan"
}


def normalize_drug_name(name: str) -> str:
    """
    Normalizes a single drug name:
    1. Lowers and strips whitespace
    2. Strips common dosage forms (e.g. 500mg, tablet, oral)
    3. Resolves brand/synonym via RxNorm normalizer (or fallback synonym map)
    """
    if not name:
        return ""

    raw = name.strip().lower()
    
    # Strip dosage amounts (e.g. '500mg', '10 mg', '5ml')
    cleaned = re.sub(r"\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|tablets?|capsules?|oral)\b", "", raw, flags=re.IGNORECASE)
    cleaned = re.sub(r"[^a-z0-9\s-]", "", cleaned).strip()
    
    # Check RxNorm normalizer if available
    if _rxnorm_normalizer:
        match = _rxnorm_normalizer.normalize(cleaned)
        if match:
            return match.canonical_name.lower()
            
    # Check fallback synonym mapping
    if cleaned in FALLBACK_SYNONYMS:
        return FALLBACK_SYNONYMS[cleaned]
        
    for k, v in FALLBACK_SYNONYMS.items():
        if k in cleaned:
            return v

    return cleaned


def normalize_list(drugs: List[str]) -> List[str]:
    """Normalizes a list of drug names, filtering empty strings."""
    return [normalize_drug_name(d) for d in drugs if d and normalize_drug_name(d)]


if __name__ == "__main__":
    test_drugs = ["Tylenol 500mg", "Advil 200 mg tablet", "Norvasc 5mg", "Glucophage XR", "Brufen"]
    print("Original:", test_drugs)
    print("Normalized:", normalize_list(test_drugs))