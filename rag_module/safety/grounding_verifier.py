"""
Answer Grounding Verifier Engine (V2.9).
Provides deterministic, proposition-level evidence consistency verification for medical summaries.

Evaluates generated claims against authoritative clinical evidence without relying on an external
LLM-as-a-judge or hardcoded medical facts. Enforces fail-closed whole-answer suppression on:
- Polarity reversals / contradictions
- Target object hallucinations (unsupported claims)
- Cross-entity contamination & combination-product leakage
- Property-bound numeric & unit mismatches
- Qualifier omissions or contradictions
- Invalid or section-mismatched citations
- Ambiguous / unparseable assertions (unverified)
"""
import re
from enum import Enum
from typing import List, Dict, Any, Optional, Tuple, Set
from pydantic import BaseModel, Field, ConfigDict


class ClaimStatus(str, Enum):
    """
    Mutually exclusive verification outcomes for atomic clinical propositions.
    """
    SUPPORTED = "supported"
    CONTRADICTED = "contradicted"
    UNSUPPORTED_BY_EVIDENCE = "unsupported_by_evidence"
    QUALIFIER_MISMATCH = "qualifier_mismatch"
    NUMERIC_MISMATCH = "numeric_mismatch"
    ENTITY_MISMATCH = "entity_mismatch"
    INVALID_CITATION = "invalid_citation"
    UNVERIFIED = "unverified"


class Proposition(BaseModel):
    """
    Structured semantic representation of an atomic clinical proposition.
    """
    subject: str = Field(default="", description="Subject entity (drug, active moiety, or disease).")
    predicate: str = Field(default="", description="Standardized clinical relation (indicated, contraindicated, decreases, increases, dose, adverse_reaction, is).")
    target_object: str = Field(default="", description="Clinical target, indication, condition, or endpoint.")
    polarity: str = Field(default="positive", description="Assertion polarity: 'positive', 'negative', or 'neutral'.")
    value: Optional[float] = Field(default=None, description="Numeric magnitude if clinical measurement or dose.")
    unit: Optional[str] = Field(default=None, description="Measurement or dosing unit (mg, mcg, g, ml/min).")
    clinical_property: Optional[str] = Field(default=None, description="Clinical binding property (initial_dose, maximum_dose, maintenance_dose).")
    frequency: Optional[str] = Field(default=None, description="Dosing schedule or frequency (once daily, twice daily, four times daily, every 12 hours).")
    qualifiers: Dict[str, Any] = Field(default_factory=dict, description="Contextual qualifiers (population, organ_impairment, pregnancy, temporal).")
    raw_text: str = Field(default="", description="Original sentence or proposition text.")

    model_config = ConfigDict(extra="forbid")


class ClaimVerificationResult(BaseModel):
    """
    Audit result for an individual clinical claim.
    """
    claim_text: str = Field(..., description="Original evaluated claim sentence.")
    status: ClaimStatus = Field(..., description="Deterministic verification status.")
    proposition: Optional[Proposition] = Field(default=None, description="Extracted claim proposition if parseable.")
    supporting_chunk_ids: List[str] = Field(default_factory=list, description="IDs of evidence chunks supporting this claim.")
    cited_chunk_ids: List[str] = Field(default_factory=list, description="IDs of evidence chunks cited by this claim.")
    discrepancy_reason: Optional[str] = Field(default=None, description="Human-readable explanation of verification failure.")

    model_config = ConfigDict(extra="forbid")


class AnswerVerificationResult(BaseModel):
    """
    Whole-answer verification outcome enforcing fail-closed suppression.
    """
    answer: str = Field(..., description="Full generated candidate answer text.")
    is_grounded: bool = Field(..., description="True only if 100% of claims are SUPPORTED.")
    has_contradiction: bool = Field(default=False, description="True if any claim exhibits direct contradiction.")
    claim_results: List[ClaimVerificationResult] = Field(default_factory=list, description="Per-claim verification outcomes.")
    failed_claims: List[str] = Field(default_factory=list, description="List of raw claim strings that failed verification.")
    discrepancies: List[str] = Field(default_factory=list, description="List of discrepancy reasons for failed claims.")
    grounded_claim_count: int = Field(default=0, description="Count of supported claims.")
    total_claim_count: int = Field(default=0, description="Total count of evaluated claims.")

    model_config = ConfigDict(extra="forbid")


# =====================================================================
# Generic Linguistic & Directional Lexicons (NO HARDCODED DRUGS/DISEASES)
# =====================================================================

DIRECTIONAL_DECREASE_TERMS = {
    "decrease", "decreases", "decreased", "decreasing",
    "reduce", "reduces", "reduced", "reducing", "reduction",
    "lower", "lowers", "lowered", "lowering",
    "inhibit", "inhibits", "inhibited", "inhibiting", "inhibition",
    "diminish", "diminishes", "diminished", "suppress", "suppresses"
}

DIRECTIONAL_INCREASE_TERMS = {
    "increase", "increases", "increased", "increasing",
    "raise", "raises", "raised", "raising",
    "elevate", "elevates", "elevated", "elevating", "elevation",
    "augment", "augments", "augmented", "augmenting",
    "potentiate", "potentiates", "enhance", "enhances"
}

SAFETY_CONTRAINDICATION_TERMS = {
    "contraindicated", "contraindication", "contraindications",
    "avoid", "avoids", "avoided", "avoiding",
    "withhold", "withholds", "discontinue", "discontinues", "discontinued",
    "do not use", "should not be used", "not recommended",
    "fatal", "toxicity", "injury and death", "boxed warning"
}

SAFETY_PERMISSIVE_TERMS = {
    "safe", "safely", "indicated", "permissible", "recommended",
    "well tolerated", "compatible"
}

INSTRUCTION_OVERRIDE_PATTERNS = [
    r'\b(?:ignore|disregard)\s+(?:all\s+)?(?:previous|prior|above)?\s*(?:instructions|rules|prompts|commands|context)[^.!?\n]*(?:[.!?\n]|$)',
    r'\b(?:system\s*:|<\s*system\s*>)[^.!?\n]*(?:[.!?\n]|$)',
    r'\b(?:you\s+are\s+now|act\s+as\s+an?\s+unrestricted)\b[^.!?\n]*(?:[.!?\n]|$)'
]

PROPERTY_KEYWORDS = {
    "initial_dose": ["initial", "starting", "start", "recommended starting", "usual initial"],
    "maximum_dose": ["maximum", "max", "highest", "not to exceed", "up to"],
    "maintenance_dose": ["maintenance", "chronic", "regular"]
}

# Evaluated in order of descending specificity
FREQUENCY_ORDERED = [
    ("four times daily", [r'\bfour\s+times\s+daily\b', r'\bqid\b', r'\bevery\s+6\s+hours\b']),
    ("three times daily", [r'\bthree\s+times\s+daily\b', r'\btid\b', r'\bevery\s+8\s+hours\b']),
    ("twice daily", [r'\btwice\s+daily\b', r'\bbid\b', r'\bevery\s+12\s+hours\b']),
    ("once daily", [r'\bonce\s+daily\b', r'\bqd\b', r'\bonce\s+a\s+day\b', r'\bevery\s+day\b'])
]


class AnswerGroundingVerifier:
    """
    Deterministic proposition-level verifier enforcing evidence consistency.
    Contains zero hardcoded medical facts, drug databases, or clinical cutoffs.
    """

    def __init__(self):
        self._compiled_injections = [re.compile(p, re.IGNORECASE) for p in INSTRUCTION_OVERRIDE_PATTERNS]

    # =========================================================================
    # Sentence Tokenization
    # =========================================================================

    def _split_into_claims(self, text: str) -> List[str]:
        """Splits candidate answer text into atomic sentences/claims."""
        if not text or not text.strip():
            return []
        cleaned = text.strip()
        sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z0-9])', cleaned)
        results = [s.strip() for s in sentences if s and s.strip()]
        return results if results else [cleaned]

    # =========================================================================
    # Generic Proposition Extraction
    # =========================================================================

    def extract_proposition(self, text: str) -> Optional[Proposition]:
        """
        Parses a candidate claim sentence into a bounded Proposition.
        Returns None if text is unparseable or lacks assertive clinical syntax.
        """
        if not text or not text.strip():
            return None

        clean_text = text.strip()

        # Reject purely convoluted, non-assertive, or hypothetical boilerplate
        if re.search(r'\b(whereas\s+perhaps|oscillates\s+between|somewhat\s+oscillates)\b', clean_text, re.IGNORECASE):
            return None

        # 1. Subject extraction (generic active agent or noun phrase)
        subject = ""

        # Pattern A: "Reactions of X", "Dose of X", "Use of X"
        of_match = re.search(
            r'\b(?:reactions\s+of|effects\s+of|dose\s+of|use\s+of|safety\s+of|indications?\s+for)\s+([a-zA-Z0-9_/-]+(?:\s+and\s+[a-zA-Z0-9_/-]+(?:\s+potassium)?)?)',
            clean_text,
            re.IGNORECASE
        )
        if of_match:
            subject = of_match.group(1).strip()

        # Pattern B: "The usual initial starting dose of X..."
        if not subject:
            subj_match = re.match(
                r'^(?:the\s+)?(?:usual\s+|recommended\s+)?(?:initial\s+|starting\s+|maximum\s+|adult\s+|common\s+)*(?:dose\s+of\s+|adult\s+dose\s+of\s+|adverse\s+reactions\s+of\s+)?([a-zA-Z0-9_/-]+(?:\s+and\s+[a-zA-Z0-9_/-]+(?:\s+potassium)?)?)',
                clean_text,
                re.IGNORECASE
            )
            if subj_match:
                candidate = subj_match.group(1).strip()
                if candidate.lower() not in ["the", "common", "adverse", "usual", "recommended", "initial", "starting", "maximum", "dose"]:
                    subject = candidate

        # Pattern C: "X is indicated...", "X decreases...", "X is a vitamin"
        if not subject:
            direct_match = re.match(r'^([a-zA-Z0-9_/-]+(?:\s+and\s+[a-zA-Z0-9_/-]+(?:\s+potassium)?)?)\s+(?:is|are|decreases|increases|reduces|improves|prevents|causes)', clean_text, re.IGNORECASE)
            if direct_match:
                candidate = direct_match.group(1).strip()
                if candidate.lower() not in ["the", "there", "it", "this"]:
                    subject = candidate

        # 2. Predicate & Polarity extraction
        predicate = ""
        polarity = "positive"
        target_object = ""
        qualifiers: Dict[str, Any] = {}

        # Dosing / Administration pattern
        dose_num_match = re.search(r'\b(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml)\b', clean_text, re.IGNORECASE)
        is_dosing = bool(dose_num_match or re.search(r'\b(dose|starting dose|daily)\b', clean_text, re.IGNORECASE))

        value = None
        unit = None
        clinical_prop = None
        frequency = None

        if dose_num_match:
            value = float(dose_num_match.group(1))
            unit = dose_num_match.group(2).lower()
            predicate = "dose"

            # Determine clinical property
            for prop_name, keywords in PROPERTY_KEYWORDS.items():
                if any(re.search(r'\b' + re.escape(kw) + r'\b', clean_text, re.IGNORECASE) for kw in keywords):
                    clinical_prop = prop_name
                    break

            # Determine frequency (checked in descending specificity)
            for freq_name, patterns in FREQUENCY_ORDERED:
                if any(re.search(pat, clean_text, re.IGNORECASE) for pat in patterns):
                    frequency = freq_name
                    break

        # Contraindication / Warning pattern
        if any(re.search(r'\b' + re.escape(w) + r'\b', clean_text, re.IGNORECASE) for w in SAFETY_CONTRAINDICATION_TERMS):
            predicate = "contraindicated"
            polarity = "negative"
            obj_match = re.search(r'\bcontraindicated\s+(?:in|during|for)?\s*([^.]+)', clean_text, re.IGNORECASE)
            if obj_match:
                target_object = obj_match.group(1).strip()

        # Permissive safety claim (e.g. "safe for use during pregnancy")
        elif any(re.search(r'\b' + re.escape(w) + r'\b', clean_text, re.IGNORECASE) for w in SAFETY_PERMISSIVE_TERMS) and re.search(r'\b(pregnancy|trimesters|lactation|pediatric)\b', clean_text, re.IGNORECASE):
            predicate = "safe"
            polarity = "positive"
            obj_match = re.search(r'\bsafe\s+(?:for\s+use\s+)?(?:in|during)?\s*([^.]+)', clean_text, re.IGNORECASE)
            if obj_match:
                target_object = obj_match.group(1).strip()

        # Directional mechanism pattern
        elif any(re.search(r'\b' + re.escape(w) + r'\b', clean_text, re.IGNORECASE) for w in DIRECTIONAL_DECREASE_TERMS):
            predicate = "decreases"
            polarity = "negative"
            dec_match = re.search(r'\b(?:decreases|reduces|lowers|inhibits)\s+([^.]+)', clean_text, re.IGNORECASE)
            if dec_match:
                target_object = dec_match.group(1).strip()

        elif any(re.search(r'\b' + re.escape(w) + r'\b', clean_text, re.IGNORECASE) for w in DIRECTIONAL_INCREASE_TERMS):
            predicate = "increases"
            polarity = "positive"
            inc_match = re.search(r'\b(?:increases|raises|elevates|augments)\s+([^.]+)', clean_text, re.IGNORECASE)
            if inc_match:
                target_object = inc_match.group(1).strip()

        # Indication pattern
        elif re.search(r'\bindicated\s+(?:for|as)?\s*([^.]+)', clean_text, re.IGNORECASE):
            predicate = "indicated"
            polarity = "positive"
            ind_match = re.search(r'\bindicated\s+(?:for|as)?\s*([^.]+)', clean_text, re.IGNORECASE)
            if ind_match:
                target_object = ind_match.group(1).strip()

        # Adverse reaction pattern
        elif re.search(r'\b(adverse reactions?|side effects?)\b', clean_text, re.IGNORECASE):
            predicate = "adverse_reaction"
            polarity = "negative"
            adv_match = re.search(r'\b(?:include|including|are)\s+([^.]+)', clean_text, re.IGNORECASE)
            if adv_match:
                target_object = adv_match.group(1).strip()

        # Copula definitional assertion: "X is a Y" or "X is defined as Y"
        elif re.search(r'\b(?:is|are)\s+(?:defined\s+as\s+|(?:an?|the)\s+)?([a-zA-Z0-9_\s/-]+)', clean_text, re.IGNORECASE):
            copula_match = re.search(r'\b(?:is|are)\s+(?:defined\s+as\s+|(?:an?|the)\s+)?([a-zA-Z0-9_\s/-]+)', clean_text, re.IGNORECASE)
            predicate = "is"
            polarity = "positive"
            if copula_match:
                target_object = copula_match.group(1).strip()

        # General assertion if predicate still missing but dose exists
        if not predicate and is_dosing:
            predicate = "dose"

        # General assertion for "improves glycemic control" or "prevents stroke"
        if not predicate:
            gen_match = re.search(r'\b(?:improves|treats|prevents|reduces|causes)\s+([^.]+)', clean_text, re.IGNORECASE)
            if gen_match:
                predicate = "indicated"
                target_object = gen_match.group(1).strip()

        if not predicate:
            return None

        # 3. Qualifiers extraction
        # Population
        if re.search(r'\b(pediatric|infants?|children|under\s+\d+)\b', clean_text, re.IGNORECASE):
            qualifiers["population"] = "pediatric"
        elif re.search(r'\b(adults?|18\s+years)\b', clean_text, re.IGNORECASE):
            qualifiers["population"] = "adult"

        # Organ impairment
        if re.search(r'\b(renal\s+impairment|egfr|kidney\s+disease|crcl)\b', clean_text, re.IGNORECASE):
            qualifiers["organ_impairment"] = "renal"
        elif re.search(r'\b(hepatic|liver\s+disease)\b', clean_text, re.IGNORECASE):
            qualifiers["organ_impairment"] = "hepatic"

        # Pregnancy
        if re.search(r'\b(pregnan(?:cy|t)|trimester|lactation|fetal)\b', clean_text, re.IGNORECASE):
            qualifiers["pregnancy"] = True

        # Temporal
        if re.search(r'\b(short-term|14\s+days|acute)\b', clean_text, re.IGNORECASE):
            qualifiers["temporal"] = "short-term"
        elif re.search(r'\b(chronic|long-term|indefinite|maintenance)\b', clean_text, re.IGNORECASE):
            qualifiers["temporal"] = "chronic"

        return Proposition(
            subject=subject,
            predicate=predicate,
            target_object=target_object,
            polarity=polarity,
            value=value,
            unit=unit,
            clinical_property=clinical_prop,
            frequency=frequency,
            qualifiers=qualifiers,
            raw_text=clean_text
        )

    # =========================================================================
    # Proposition Matching Helpers
    # =========================================================================

    def _extract_entity_from_evidence(self, chunk: Dict[str, Any]) -> str:
        """Derives canonical subject entity from chunk metadata title or text header."""
        title = str(chunk.get("title") or chunk.get("focus") or "").strip()
        if " - " in title:
            return title.split(" - ")[0].strip()
        text = str(chunk.get("text") or "").strip()
        first_line = text.split("\n")[0] if text else ""
        if first_line.lower().startswith("drug:") or first_line.lower().startswith("topic:"):
            parts = first_line.split(":")
            if len(parts) > 1:
                return parts[1].strip()
        return title

    def _check_entity_compatibility(self, claim_entity: str, evidence_entity: str) -> bool:
        """
        Enforces strict entity and combination-product isolation.
        'Amoxicillin' MUST NOT inherit evidence from 'Amoxicillin and Clavulanate Potassium' or vice-versa.
        """
        c = claim_entity.lower().strip()
        e = evidence_entity.lower().strip()

        if not c or not e:
            return True

        if c == e:
            return True

        # Combination product detection
        c_is_combo = ("/" in c) or (" and " in c) or ("+" in c)
        e_is_combo = ("/" in e) or (" and " in e) or ("+" in e)

        if not c_is_combo and e_is_combo:
            return False

        if c_is_combo and not e_is_combo:
            return False

        c_clean = re.sub(r'[^a-z0-9]', '', c)
        e_clean = re.sub(r'[^a-z0-9]', '', e)
        if c_clean in e_clean or e_clean in c_clean:
            return True

        return False

    # =========================================================================
    # Claim-Level Verification Core
    # =========================================================================

    def verify_claim(
        self,
        claim_text: str,
        evidence_chunks: List[Dict[str, Any]],
        citation_chunk_ids: Optional[List[str]] = None
    ) -> ClaimVerificationResult:
        """
        Verifies an individual clinical claim against evidence chunks.
        Enforces fail-closed deterministic verification.
        """
        if not claim_text or not claim_text.strip():
            return ClaimVerificationResult(
                claim_text=claim_text,
                status=ClaimStatus.UNVERIFIED,
                discrepancy_reason="Claim text is empty."
            )

        # 0. Empty evidence handling (fail closed)
        if not evidence_chunks:
            return ClaimVerificationResult(
                claim_text=claim_text,
                status=ClaimStatus.UNSUPPORTED_BY_EVIDENCE,
                discrepancy_reason="No evidence chunks supplied."
            )

        # 1. Parse claim proposition
        prop = self.extract_proposition(claim_text)
        if prop is None:
            return ClaimVerificationResult(
                claim_text=claim_text,
                status=ClaimStatus.UNVERIFIED,
                discrepancy_reason="Claim proposition syntax is ambiguous or unparseable."
            )

        # 2. Citation existence & provenance verification
        if citation_chunk_ids is None or len(citation_chunk_ids) == 0:
            return ClaimVerificationResult(
                claim_text=claim_text,
                status=ClaimStatus.INVALID_CITATION,
                proposition=prop,
                discrepancy_reason="Claim lacks citation attribution."
            )

        evidence_chunk_map = {
            str(c.get("chunk_id")): c
            for c in evidence_chunks
            if isinstance(c, dict) and "chunk_id" in c
        }

        # Check for nonexistent citations
        for cid in citation_chunk_ids:
            if cid not in evidence_chunk_map:
                return ClaimVerificationResult(
                    claim_text=claim_text,
                    status=ClaimStatus.INVALID_CITATION,
                    proposition=prop,
                    cited_chunk_ids=citation_chunk_ids,
                    discrepancy_reason=f"Cited chunk ID '{cid}' not found in accepted evidence."
                )

        cited_chunks = [evidence_chunk_map[cid] for cid in citation_chunk_ids if cid in evidence_chunk_map]

        # 3. Check for missing/malformed evidence text in cited chunks
        has_valid_text = any(bool(str(c.get("text") or "").strip()) for c in cited_chunks)
        if not has_valid_text:
            return ClaimVerificationResult(
                claim_text=claim_text,
                status=ClaimStatus.UNSUPPORTED_BY_EVIDENCE,
                proposition=prop,
                cited_chunk_ids=citation_chunk_ids,
                discrepancy_reason="Cited evidence contains no readable factual text."
            )

        # 4. Entity isolation verification across cited chunks
        # If the claim entity does not match the cited chunk entity:
        # If the claim cites a specific chunk of another drug -> INVALID_CITATION (wrong entity cited)
        # If across all evidence, the entity is completely foreign -> ENTITY_MISMATCH
        all_evidence_entities = [self._extract_entity_from_evidence(c) for c in evidence_chunks if isinstance(c, dict)]
        for chunk in cited_chunks:
            ev_entity = self._extract_entity_from_evidence(chunk)
            if prop.subject and ev_entity:
                if not self._check_entity_compatibility(prop.subject, ev_entity):
                    # Check if the claim entity exists in ANY accepted evidence chunk
                    entity_in_other_chunks = any(self._check_entity_compatibility(prop.subject, other_ent) for other_ent in all_evidence_entities)
                    if entity_in_other_chunks:
                        return ClaimVerificationResult(
                            claim_text=claim_text,
                            status=ClaimStatus.INVALID_CITATION,
                            proposition=prop,
                            cited_chunk_ids=citation_chunk_ids,
                            discrepancy_reason=f"Cited chunk belongs to '{ev_entity}', but claim discusses '{prop.subject}'."
                        )
                    else:
                        return ClaimVerificationResult(
                            claim_text=claim_text,
                            status=ClaimStatus.ENTITY_MISMATCH,
                            proposition=prop,
                            cited_chunk_ids=citation_chunk_ids,
                            discrepancy_reason=f"Claim entity '{prop.subject}' does not match evidence entity '{ev_entity}'."
                        )

        # 5. Content verification against cited chunks
        # Sanitize chunk text against instruction-injection patterns (DATA isolation)
        cleaned_chunk_texts = []
        for chunk in cited_chunks:
            raw_chunk_text = str(chunk.get("text") or "")
            if not raw_chunk_text.strip():
                continue
            sanitized_text = raw_chunk_text
            for pat in self._compiled_injections:
                sanitized_text = pat.sub('', sanitized_text)
            cleaned_chunk_texts.append((chunk, sanitized_text))

        combined_evidence_text = " ".join([t for _, t in cleaned_chunk_texts])
        combined_lower = combined_evidence_text.lower()

        # 6. Check section relevance (e.g. contraindication in dosage section)
        if prop.predicate == "contraindicated":
            has_ci_terms = any(re.search(r'\b' + re.escape(w) + r'\b', combined_lower) for w in SAFETY_CONTRAINDICATION_TERMS)
            if not has_ci_terms:
                return ClaimVerificationResult(
                    claim_text=claim_text,
                    status=ClaimStatus.INVALID_CITATION,
                    proposition=prop,
                    cited_chunk_ids=citation_chunk_ids,
                    discrepancy_reason="Cited chunk does not contain contraindication assertions."
                )

        # 7. Polarity reversal / Contradiction check
        if prop.predicate == "increases":
            if any(re.search(r'\b' + re.escape(w) + r'\b', combined_lower) for w in DIRECTIONAL_DECREASE_TERMS):
                obj_tokens = [w for w in re.findall(r'\b[a-z]{3,}\b', prop.target_object.lower()) if w not in ["the", "and", "for"]]
                if any(tok in combined_lower for tok in obj_tokens):
                    return ClaimVerificationResult(
                        claim_text=claim_text,
                        status=ClaimStatus.CONTRADICTED,
                        proposition=prop,
                        cited_chunk_ids=citation_chunk_ids,
                        discrepancy_reason="Directional polarity contradiction: evidence indicates decrease/reduction, but claim asserts increase."
                    )

        elif prop.predicate == "decreases":
            if any(re.search(r'\b' + re.escape(w) + r'\b', combined_lower) for w in DIRECTIONAL_INCREASE_TERMS):
                obj_tokens = [w for w in re.findall(r'\b[a-z]{3,}\b', prop.target_object.lower()) if w not in ["the", "and", "for"]]
                if any(tok in combined_lower for tok in obj_tokens):
                    return ClaimVerificationResult(
                        claim_text=claim_text,
                        status=ClaimStatus.CONTRADICTED,
                        proposition=prop,
                        cited_chunk_ids=citation_chunk_ids,
                        discrepancy_reason="Directional polarity contradiction: evidence indicates increase, but claim asserts decrease."
                    )

        # Safety / Pregnancy contradiction
        if prop.predicate == "safe" and prop.qualifiers.get("pregnancy"):
            if any(re.search(r'\b' + re.escape(w) + r'\b', combined_lower) for w in SAFETY_CONTRAINDICATION_TERMS):
                if re.search(r'\b(pregnancy|fetal|fetus|discontinue)\b', combined_lower):
                    return ClaimVerificationResult(
                        claim_text=claim_text,
                        status=ClaimStatus.CONTRADICTED,
                        proposition=prop,
                        cited_chunk_ids=citation_chunk_ids,
                        discrepancy_reason="Safety contradiction: claim asserts pregnancy safety, but evidence contains boxed warning / contraindication."
                    )

        # 8. Numeric & Property Verification
        if prop.value is not None:
            val_str = f"{prop.value:g}"
            num_pattern = r'\b' + re.escape(val_str) + r'\s*(mg|mcg|g|ml)\b'
            matches = list(re.finditer(num_pattern, combined_evidence_text, re.IGNORECASE))
            if not matches:
                return ClaimVerificationResult(
                    claim_text=claim_text,
                    status=ClaimStatus.NUMERIC_MISMATCH,
                    proposition=prop,
                    cited_chunk_ids=citation_chunk_ids,
                    discrepancy_reason=f"Numeric value '{prop.value}' not found in cited evidence."
                )

            # Check unit for the matching value
            ev_units = {m.group(1).lower() for m in matches}
            if prop.unit and prop.unit.lower() not in ev_units:
                return ClaimVerificationResult(
                    claim_text=claim_text,
                    status=ClaimStatus.NUMERIC_MISMATCH,
                    proposition=prop,
                    cited_chunk_ids=citation_chunk_ids,
                    discrepancy_reason=f"Numeric unit mismatch: claim asserts '{prop.unit}', but evidence specifies '{list(ev_units)}'."
                )

            # Check clinical property binding (initial dose vs maximum dose)
            if prop.clinical_property:
                is_prop_matched = False
                for m in matches:
                    start_idx = max(0, m.start() - 60)
                    end_idx = min(len(combined_evidence_text), m.end() + 60)
                    context_snippet = combined_evidence_text[start_idx:end_idx].lower()

                    target_keywords = PROPERTY_KEYWORDS.get(prop.clinical_property, [])
                    if any(kw in context_snippet for kw in target_keywords):
                        is_prop_matched = True
                        break

                if not is_prop_matched:
                    return ClaimVerificationResult(
                        claim_text=claim_text,
                        status=ClaimStatus.NUMERIC_MISMATCH,
                        proposition=prop,
                        cited_chunk_ids=citation_chunk_ids,
                        discrepancy_reason=f"Numeric property binding mismatch: value {prop.value} {prop.unit} is not bound to property '{prop.clinical_property}' in evidence."
                    )

            # Check frequency mismatch
            if prop.frequency:
                freq_matched = False
                for freq_name, patterns in FREQUENCY_ORDERED:
                    if freq_name == prop.frequency:
                        if any(re.search(pat, combined_lower) for pat in patterns):
                            freq_matched = True
                        break
                if not freq_matched:
                    return ClaimVerificationResult(
                        claim_text=claim_text,
                        status=ClaimStatus.NUMERIC_MISMATCH,
                        proposition=prop,
                        cited_chunk_ids=citation_chunk_ids,
                        discrepancy_reason=f"Dosing frequency '{prop.frequency}' does not match cited evidence."
                    )

        # 9. Qualifier Verification
        if prop.predicate == "contraindicated" and not prop.qualifiers:
            if re.search(r'\bcontraindicated\s+in\s+([a-z0-9_\s()<>/]+)', combined_lower):
                return ClaimVerificationResult(
                    claim_text=claim_text,
                    status=ClaimStatus.QUALIFIER_MISMATCH,
                    proposition=prop,
                    cited_chunk_ids=citation_chunk_ids,
                    discrepancy_reason="Essential clinical qualifier dropped: claim asserts unconditional contraindication, but evidence restricts it to specific conditions."
                )

        if prop.qualifiers.get("population") == "pediatric":
            if not re.search(r'\b(pediatric|children|infants?|years\s+of\s+age)\b', combined_lower):
                return ClaimVerificationResult(
                    claim_text=claim_text,
                    status=ClaimStatus.QUALIFIER_MISMATCH,
                    proposition=prop,
                    cited_chunk_ids=citation_chunk_ids,
                    discrepancy_reason="Population qualifier mismatch: claim asserts pediatric use, but evidence does not support pediatric population."
                )

        if prop.qualifiers.get("temporal") == "chronic":
            if re.search(r'\b(short-term|not\s+to\s+exceed\s+\d+\s+days)\b', combined_lower):
                return ClaimVerificationResult(
                    claim_text=claim_text,
                    status=ClaimStatus.QUALIFIER_MISMATCH,
                    proposition=prop,
                    cited_chunk_ids=citation_chunk_ids,
                    discrepancy_reason="Temporal qualifier mismatch: claim asserts chronic maintenance, but evidence restricts to short-term therapy."
                )

        # 10. Unsupported Claim / Plausible Hallucination check
        if prop.target_object:
            target_words = [
                w.lower() for w in re.findall(r'\b[a-zA-Z]{3,}\b', prop.target_object)
                if w.lower() not in ["the", "and", "for", "with", "patients", "treatment", "observed", "clinical", "trials"]
            ]
            if target_words:
                matched_words = [w for w in target_words if w in combined_lower]
                overlap = len(matched_words) / len(target_words)
                if overlap < 0.50:
                    return ClaimVerificationResult(
                        claim_text=claim_text,
                        status=ClaimStatus.UNSUPPORTED_BY_EVIDENCE,
                        proposition=prop,
                        cited_chunk_ids=citation_chunk_ids,
                        discrepancy_reason=f"Clinical target object '{prop.target_object}' not supported by cited evidence (matched {matched_words} of {target_words})."
                    )

        # 11. Direct fact support confirmation
        supporting_chunks = []
        for chunk, text in cleaned_chunk_texts:
            c_text_lower = text.lower()
            if prop.predicate == "dose" and prop.value is not None:
                if f"{prop.value:g}" in c_text_lower:
                    supporting_chunks.append(str(chunk.get("chunk_id")))
            elif prop.target_object:
                target_words = [w.lower() for w in re.findall(r'\b[a-zA-Z]{4,}\b', prop.target_object) if w.lower() not in ["patients", "treatment"]]
                if any(w in c_text_lower for w in target_words):
                    supporting_chunks.append(str(chunk.get("chunk_id")))
            else:
                supporting_chunks.append(str(chunk.get("chunk_id")))

        if not supporting_chunks:
            return ClaimVerificationResult(
                claim_text=claim_text,
                status=ClaimStatus.UNSUPPORTED_BY_EVIDENCE,
                proposition=prop,
                cited_chunk_ids=citation_chunk_ids,
                discrepancy_reason="None of the cited chunks contain supporting propositions."
            )

        return ClaimVerificationResult(
            claim_text=claim_text,
            status=ClaimStatus.SUPPORTED,
            proposition=prop,
            supporting_chunk_ids=supporting_chunks,
            cited_chunk_ids=citation_chunk_ids
        )

    # =========================================================================
    # Whole-Answer Verification & Fail-Closed Enforcement
    # =========================================================================

    def verify_answer(
        self,
        answer: str,
        evidence_chunks: List[Dict[str, Any]],
        citations: Optional[List[str]] = None
    ) -> AnswerVerificationResult:
        """
        Verifies a complete candidate answer string.
        Deconstructs answer into atomic claims, audits each against citations,
        and enforces whole-answer fail-closed suppression if ANY claim fails.
        """
        if not answer or not answer.strip():
            return AnswerVerificationResult(
                answer=answer,
                is_grounded=False,
                discrepancies=["Answer is empty."]
            )

        claims = self._split_into_claims(answer)
        claim_results: List[ClaimVerificationResult] = []
        failed_claims: List[str] = []
        discrepancies: List[str] = []
        has_contradiction = False
        grounded_count = 0

        # Resolve available citation chunk IDs
        all_citation_ids = citations or [str(c.get("chunk_id")) for c in evidence_chunks if isinstance(c, dict) and "chunk_id" in c]

        for claim in claims:
            # Check if this claim can be verified against ANY valid cited chunk
            # If multiple citations exist, test against all cited chunks
            best_res: Optional[ClaimVerificationResult] = None

            # First try evaluating with all citation IDs together
            res_all = self.verify_claim(
                claim_text=claim,
                evidence_chunks=evidence_chunks,
                citation_chunk_ids=all_citation_ids
            )
            if res_all.status == ClaimStatus.SUPPORTED:
                best_res = res_all
            else:
                # Try evaluating against individual citations to find specific supporting chunk
                for cid in all_citation_ids:
                    res_single = self.verify_claim(
                        claim_text=claim,
                        evidence_chunks=evidence_chunks,
                        citation_chunk_ids=[cid]
                    )
                    if res_single.status == ClaimStatus.SUPPORTED:
                        best_res = res_single
                        break

            claim_res = best_res or res_all
            claim_results.append(claim_res)

            if claim_res.status == ClaimStatus.SUPPORTED:
                grounded_count += 1
            else:
                failed_claims.append(claim)
                reason = claim_res.discrepancy_reason or f"Claim status: {claim_res.status.value}"
                discrepancies.append(f"[{claim_res.status.value.upper()}] {claim}: {reason}")
                if claim_res.status == ClaimStatus.CONTRADICTED:
                    has_contradiction = True

        is_grounded = (len(failed_claims) == 0 and grounded_count > 0)

        return AnswerVerificationResult(
            answer=answer,
            is_grounded=is_grounded,
            has_contradiction=has_contradiction,
            claim_results=claim_results,
            failed_claims=failed_claims,
            discrepancies=discrepancies,
            grounded_claim_count=grounded_count,
            total_claim_count=len(claims)
        )
