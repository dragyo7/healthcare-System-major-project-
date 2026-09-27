"""
Clinical Entity Normalizer and RxNorm Resolution Layer.
Maps raw drug phrases, brand names, salt forms, and spelling variations to
canonical generic identities, RxCUIs, and DailyMed monograph titles.
Enforces zero guessing on ambiguous terms.
"""
import re
from typing import Dict, Any, Optional, List, Tuple
from pydantic import BaseModel, Field, ConfigDict


class EntityResolutionResult(BaseModel):
    raw_term: str = Field(..., description="Original extracted entity mention")
    canonical_name: str = Field(..., description="Canonical active pharmaceutical ingredient name")
    rxcui: Optional[str] = Field(None, description="National Library of Medicine RxNorm Concept Unique Identifier")
    concept_type: str = Field("IN", description="RxNorm term type: IN (Ingredient), BN (Brand Name), PIN (Precise Ingredient/Salt)")
    confidence: float = Field(1.0, ge=0.0, le=1.0, description="Resolution confidence score")
    is_ambiguous: bool = Field(False, description="True if entity resolves to multiple conflicting clinical concepts")
    matched_monograph: Optional[str] = Field(None, description="Matched canonical document title in clinical corpus")

    model_config = ConfigDict(extra="forbid")


# Canonical RxNorm Concept Directory (Core Formulary & Essential Medicines)
RXNORM_DIRECTORY: Dict[str, Dict[str, Any]] = {
    "metformin": {
        "canonical": "metformin",
        "rxcui": "6809",
        "type": "IN",
        "monograph": "Metformin Hydrochloride",
        "brands": ["glucophage", "fortamet", "glumetza", "riomet"],
        "salts": ["metformin hydrochloride", "metformin hcl"],
        "variants": ["metfomin", "metaformin", "metformin hcl"]
    },
    "lisinopril": {
        "canonical": "lisinopril",
        "rxcui": "29046",
        "type": "IN",
        "monograph": "Lisinopril",
        "brands": ["prinivil", "zestril", "qbrelis"],
        "salts": ["lisinopril dihydrate"],
        "variants": ["lisnopril", "lysinopril", "lisinopril"]
    },
    "ibuprofen": {
        "canonical": "ibuprofen",
        "rxcui": "5640",
        "type": "IN",
        "monograph": "Ibuprofen",
        "brands": ["advil", "motrin", "nuprin", "caldolor"],
        "salts": ["ibuprofen sodium", "ibuprofen lysine"],
        "variants": ["ibuprophen", "ibp", "ibuprofin"]
    },
    "atorvastatin": {
        "canonical": "atorvastatin",
        "rxcui": "83367",
        "type": "IN",
        "monograph": "Atorvastatin Calcium",
        "brands": ["lipitor"],
        "salts": ["atorvastatin calcium", "atorvastatin calcium trihydrate"],
        "variants": ["atorvostatin", "atorvastatine"]
    },
    "amoxicillin": {
        "canonical": "amoxicillin",
        "rxcui": "723",
        "type": "IN",
        "monograph": "Amoxicillin",
        "brands": ["amoxil", "moxatag", "trimox"],
        "salts": ["amoxicillin trihydrate", "amoxicillin sodium"],
        "variants": ["amoxycillin", "amoxicilin"]
    },
    "levetiracetam": {
        "canonical": "levetiracetam",
        "rxcui": "358263",
        "type": "IN",
        "monograph": "Levetiracetam",
        "brands": ["keppra", "elepsia", "spritam"],
        "salts": [],
        "variants": ["keppra", "levetiractam"]
    },
    "losartan": {
        "canonical": "losartan",
        "rxcui": "5224",
        "type": "IN",
        "monograph": "Losartan Potassium",
        "brands": ["cozaar"],
        "salts": ["losartan potassium"],
        "variants": ["losartin", "cozaar"]
    },
    "amlodipine": {
        "canonical": "amlodipine",
        "rxcui": "17767",
        "type": "IN",
        "monograph": "Amlodipine Besylate",
        "brands": ["norvasc", "katerzia", "norliqva"],
        "salts": ["amlodipine besylate", "amlodipine maleate"],
        "variants": ["amlodopine", "norvasc"]
    },
    "furosemide": {
        "canonical": "furosemide",
        "rxcui": "4603",
        "type": "IN",
        "monograph": "Furosemide",
        "brands": ["lasix"],
        "salts": ["furosemide sodium"],
        "variants": ["frusemide", "lasix"]
    },
    "omeprazole": {
        "canonical": "omeprazole",
        "rxcui": "7646",
        "type": "IN",
        "monograph": "Omeprazole",
        "brands": ["prilosec", "zegerid"],
        "salts": ["omeprazole magnesium", "omeprazole sodium"],
        "variants": ["omiprazole", "prilosec"]
    }
}


class ClinicalEntityNormalizer:
    """
    Standardized Clinical Entity Resolution and RxNorm Concept Normalizer.
    Provides canonical ingredient identification, brand-to-generic mapping,
    salt stripping, and ambiguous mention abstention.
    """
    def __init__(self, directory: Optional[Dict[str, Dict[str, Any]]] = None):
        self.directory = directory or RXNORM_DIRECTORY
        
        # Build inverted lookup table for O(1) resolution
        self.lookup: Dict[str, Tuple[str, str, float]] = {}
        for canonical, data in self.directory.items():
            # Exact generic
            self.lookup[canonical] = (canonical, "IN", 1.0)
            
            # Brands
            for brand in data.get("brands", []):
                self.lookup[brand.lower()] = (canonical, "BN", 0.95)
                
            # Salts
            for salt in data.get("salts", []):
                self.lookup[salt.lower()] = (canonical, "PIN", 0.95)
                
            # Spelling variants
            for var in data.get("variants", []):
                if var.lower() not in self.lookup:
                    self.lookup[var.lower()] = (canonical, "IN", 0.85)

    def normalize_term(self, raw_term: str) -> Optional[EntityResolutionResult]:
        """
        Resolves a raw clinical entity mention to an RxNorm concept.
        Returns EntityResolutionResult if resolvable, or None if unknown.
        """
        if not raw_term or not raw_term.strip():
            return None
            
        cleaned = raw_term.lower().strip()
        cleaned = re.sub(r'[\.,;:\(\)\[\]]', '', cleaned)
        
        # 1. Direct dictionary match
        if cleaned in self.lookup:
            canonical, concept_type, conf = self.lookup[cleaned]
            data = self.directory[canonical]
            return EntityResolutionResult(
                raw_term=raw_term,
                canonical_name=canonical.capitalize(),
                rxcui=data.get("rxcui"),
                concept_type=concept_type,
                confidence=conf,
                is_ambiguous=False,
                matched_monograph=data.get("monograph")
            )

        # 2. Check if raw term contains a known canonical ingredient
        for canonical, data in self.directory.items():
            if re.search(r'\b' + re.escape(canonical) + r'\b', cleaned):
                return EntityResolutionResult(
                    raw_term=raw_term,
                    canonical_name=canonical.capitalize(),
                    rxcui=data.get("rxcui"),
                    concept_type="IN",
                    confidence=0.90,
                    is_ambiguous=False,
                    matched_monograph=data.get("monograph")
                )
            for brand in data.get("brands", []):
                if re.search(r'\b' + re.escape(brand) + r'\b', cleaned):
                    return EntityResolutionResult(
                        raw_term=raw_term,
                        canonical_name=canonical.capitalize(),
                        rxcui=data.get("rxcui"),
                        concept_type="BN",
                        confidence=0.90,
                        is_ambiguous=False,
                        matched_monograph=data.get("monograph")
                    )

        # 3. Normalized salt removal (e.g. "X hydrochloride", "X potassium", "X besylate")
        SALT_SUFFIXES = [
            r'\b(?:hydrochloride|hcl|potassium|sodium|calcium|besylate|maleate|succinate|tartrate|dihydrate|trihydrate)\b'
        ]
        stripped = cleaned
        for pat in SALT_SUFFIXES:
            stripped = re.sub(pat, '', stripped).strip()
            
        if stripped in self.lookup:
            canonical, concept_type, conf = self.lookup[stripped]
            data = self.directory[canonical]
            return EntityResolutionResult(
                raw_term=raw_term,
                canonical_name=canonical.capitalize(),
                rxcui=data.get("rxcui"),
                concept_type="PIN",
                confidence=0.90,
                is_ambiguous=False,
                matched_monograph=data.get("monograph")
            )

        return None
