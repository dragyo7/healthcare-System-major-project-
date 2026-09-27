"""
Dynamic Query Understanding & Complexity Analysis Engine (V2.10).
Provides non-hardcoded query analysis, clinical intent detection, multi-part intent decomposition,
constraint extraction, entity isolation signals, and adaptive retrieval budget estimation.
"""
import re
from enum import Enum
from typing import List, Dict, Any, Optional, Set
from pydantic import BaseModel, Field, ConfigDict
from rag_module.retrieval.entity_normalizer import ClinicalEntityNormalizer


class ClinicalIntent(str, Enum):
    OVERVIEW = "overview"
    INDICATIONS = "indications"
    CONTRAINDICATIONS = "contraindications"
    ADVERSE_EFFECTS = "adverse_effects"
    DOSAGE = "dosage"
    INTERACTIONS = "interactions"
    PRECAUTIONS = "precautions"
    SPECIAL_POPULATIONS = "special_populations"
    COMPARISON = "comparison"
    GENERAL_FACTUAL = "general_factual"


class QueryComplexityTier(str, Enum):
    SIMPLE = "simple"
    MODERATE = "moderate"
    COMPLEX = "complex"
    MULTI_PART = "multi_part"


class RetrievalBudget(BaseModel):
    """
    Adaptive retrieval depth and candidate allocation.
    """
    dense_k: int = Field(default=20, ge=5, le=50, description="Dense candidate pool depth.")
    bm25_k: int = Field(default=20, ge=5, le=50, description="BM25 candidate pool depth.")
    final_top_k: int = Field(default=5, ge=2, le=15, description="Final reranked chunks provided to context.")
    require_section_diversity: bool = Field(default=False, description="Enforce distinct clinical section representation.")
    target_sections: List[str] = Field(default_factory=list, description="Preferred clinical sections based on intent.")

    model_config = ConfigDict(extra="forbid")


class QueryAnalysis(BaseModel):
    """
    Complete structured query understanding profile.
    """
    raw_query: str = Field(..., description="Original raw user inquiry.")
    normalized_query: str = Field(..., description="Cleaned inquiry with conversational framing stripped.")
    intents: List[ClinicalIntent] = Field(default_factory=list, description="Detected clinical question intents.")
    is_multi_part: bool = Field(default=False, description="True if query asks for multiple distinct clinical aspects.")
    sub_intents: List[str] = Field(default_factory=list, description="Identified sub-goals for multi-part synthesis.")
    candidate_entities: List[str] = Field(default_factory=list, description="Extracted candidate clinical subject entities.")
    has_negation: bool = Field(default=False, description="True if query contains negation or polarity inversion.")
    has_numeric: bool = Field(default=False, description="True if query specifies or requests numerical constraints.")
    detected_population: Optional[str] = Field(default=None, description="Special population constraint if detected.")
    complexity_score: float = Field(default=0.0, ge=0.0, le=1.0, description="Continuous complexity index (0.0 - 1.0).")
    complexity_tier: QueryComplexityTier = Field(default=QueryComplexityTier.SIMPLE, description="Categorical complexity tier.")
    retrieval_budget: RetrievalBudget = Field(default_factory=RetrievalBudget, description="Dynamically estimated retrieval parameters.")
    resolved_entities: List[Dict[str, Any]] = Field(default_factory=list, description="RxNorm-resolved clinical concepts.")

    model_config = ConfigDict(extra="forbid")


# Conversational preambles that obscure core clinical inquiry
CONVERSATIONAL_FRAMES = [
    r'^(?:i\s+(?:have\s+been|was|am)\s+prescribed|my\s+doctor\s+prescribed|i\s+am\s+taking)\s+([^,.]+)[,.]?\s*',
    r'^(?:can\s+you\s+(?:please\s+)?(?:explain|tell\s+me|clarify)|could\s+you\s+(?:please\s+)?(?:explain|tell\s+me))\s*',
    r'^(?:what\s+should\s+(?:someone|a\s+patient|i)\s+know\s+about\s+(?:taking\s+)?)\s*',
    r'^(?:please\s+(?:explain|tell\s+me\s+about|provide\s+information\s+on))\s*',
    r'^(?:tell\s+me\s+about\s+a\s+fictional\s+medication\s+called)\s*',
    r'^(?:tell\s+me\s+about)\s*',
    r'^(?:i\s+would\s+like\s+to\s+know\s+(?:about|whether|if)?)\s*'
]

# Intent classification regular expressions
INTENT_PATTERNS = {
    ClinicalIntent.CONTRAINDICATIONS: [
        r'\b(?:contraindicated|contraindication|contraindications|should\s+not\s+take|when\s+(?:to|should\s+one)\s+avoid|who\s+should\s+not\s+take|avoid\s+in)\b',
        r'\b(?:not\s+recommended\s+in|unsafe\s+in)\b'
    ],
    ClinicalIntent.ADVERSE_EFFECTS: [
        r'\b(?:side\s+effect|side\s+effects|adverse\s+effect|adverse\s+effects|adverse\s+reaction|adverse\s+reactions|negative\s+effects|harmful\s+effects)\b',
        r'\b(?:common\s+reactions|toxicity)\b'
    ],
    ClinicalIntent.DOSAGE: [
        r'\b(?:dose|dosage|dosing|how\s+much|how\s+often|maximum\s+daily|initial\s+dose|starting\s+dose|maintenance\s+dose|titration|titrate)\b',
        r'\b(?:\d+\s*(?:mg|mcg|g|ml))\b'
    ],
    ClinicalIntent.INTERACTIONS: [
        r'\b(?:interact|interactions|drug\s+interaction|drug\s+interactions|taken\s+with|taking\s+with|combine\s+with|combining\s+with|co-administration|together\s+with)\b'
    ],
    ClinicalIntent.PRECAUTIONS: [
        r'\b(?:precaution|precautions|warning|warnings|boxed\s+warning|black\s+box|be\s+warned\s+about|seek\s+medical\s+attention|monitoring|laboratory\s+monitoring)\b'
    ],
    ClinicalIntent.SPECIAL_POPULATIONS: [
        r'\b(?:pregnancy|pregnant|lactation|breastfeeding|nursing|pediatric|children|infants|elderly|geriatric|renal\s+impairment|kidney\s+disease|hepatic\s+impairment|liver\s+disease)\b'
    ],
    ClinicalIntent.INDICATIONS: [
        r'\b(?:used\s+for|indication|indications|indicated\s+for|prescribed\s+for|treat|treatment\s+of|management\s+of|what\s+does\s+.*\s+do|works\s+for)\b'
    ],
    ClinicalIntent.COMPARISON: [
        r'\b(?:difference\s+between|compare|comparison|versus|\bvs\.?\b|better\s+than)\b'
    ],
    ClinicalIntent.OVERVIEW: [
        r'^\s*what\s+is\s+([a-zA-Z0-9_-]+)\s*\??\s*$',
        r'\b(?:overview|general\s+information|explain\s+what)\b'
    ]
}

# Mapping intents to DailyMed/clinical monograph sections
INTENT_SECTION_MAP = {
    ClinicalIntent.INDICATIONS: ["Indications & Usage", "Clinical Pharmacology"],
    ClinicalIntent.CONTRAINDICATIONS: ["Contraindications", "Warnings & Precautions", "Boxed Warning"],
    ClinicalIntent.ADVERSE_EFFECTS: ["Adverse Reactions", "Warnings & Precautions"],
    ClinicalIntent.DOSAGE: ["Dosage & Administration"],
    ClinicalIntent.INTERACTIONS: ["Drug Interactions", "Clinical Pharmacology"],
    ClinicalIntent.PRECAUTIONS: ["Warnings & Precautions", "Boxed Warning", "Contraindications"],
    ClinicalIntent.SPECIAL_POPULATIONS: ["Use in Specific Populations", "Contraindications", "Dosage & Administration"]
}

# Negation and polarity markers
NEGATION_PATTERNS = [
    r'\b(?:not|no|never|neither|nor|without|avoid|contraindicated|unlikely|cannot|can\'?t|does\s+not|doesn\'?t|is\s+not|isn\'?t)\b'
]

# Population markers
POPULATION_PATTERNS = {
    "pregnancy": r'\b(pregnancy|pregnant|first\s+trimester|second\s+trimester|third\s+trimester|gestation)\b',
    "lactation": r'\b(lactation|breastfeeding|nursing\s+mothers)\b',
    "pediatric": r'\b(pediatric|children|infants|adolescents|neonates)\b',
    "elderly": r'\b(elderly|geriatric|older\s+adults|senior)\b',
    "renal": r'\b(renal\s+impairment|kidney\s+disease|dialysis|crcl|egfr)\b',
    "hepatic": r'\b(hepatic\s+impairment|liver\s+disease|cirrhosis)\b'
}


class QueryAnalyzer:
    """
    Intelligent, non-hardcoded query analysis and retrieval parameter adapter.
    """
    def __init__(self):
        self._compiled_intents = {
            intent: [re.compile(p, re.IGNORECASE) for p in patterns]
            for intent, patterns in INTENT_PATTERNS.items()
        }
        self._compiled_frames = [re.compile(p, re.IGNORECASE) for p in CONVERSATIONAL_FRAMES]
        self._compiled_negations = [re.compile(p, re.IGNORECASE) for p in NEGATION_PATTERNS]
        self._compiled_populations = {
            pop: re.compile(pat, re.IGNORECASE) for pop, pat in POPULATION_PATTERNS.items()
        }
        self.normalizer = ClinicalEntityNormalizer()

    def normalize_query(self, raw_query: str) -> str:
        """
        Strips conversational preambles while preserving clinical inquiry content.
        """
        if not raw_query:
            return ""
        text = raw_query.strip()
        
        # Check conversational opening frames
        for pat in self._compiled_frames:
            match = pat.match(text)
            if match:
                # If frame captured a trailing entity (e.g. "I am taking lisinopril."), retain it
                if match.groups() and match.group(1):
                    entity_captured = match.group(1).strip()
                    remainder = text[match.end():].strip()
                    if remainder:
                        text = f"{entity_captured} {remainder}"
                    else:
                        text = entity_captured
                else:
                    text = text[match.end():].strip()
                break
                
        # Remove trailing conversational politeness
        text = re.sub(r'[,.]?\s*(?:please|thank\s+you|thanks)\s*\??\s*$', '?', text, flags=re.IGNORECASE)
        return text.strip()

    def detect_intents(self, text: str) -> List[ClinicalIntent]:
        """
        Identifies all clinical intents expressed in the query.
        """
        detected: Set[ClinicalIntent] = set()
        for intent, regexes in self._compiled_intents.items():
            for rgx in regexes:
                if rgx.search(text):
                    detected.add(intent)
                    break
                    
        # If no specific intent found, default to OVERVIEW / GENERAL_FACTUAL
        if not detected:
            if re.search(r'\b(?:what|who|which|how|explain)\b', text, re.IGNORECASE):
                detected.add(ClinicalIntent.OVERVIEW)
            else:
                detected.add(ClinicalIntent.GENERAL_FACTUAL)
                
        # Order intents logically: OVERVIEW/INDICATIONS -> DOSAGE -> CONTRAINDICATIONS -> ADVERSE_EFFECTS
        ORDER = [
            ClinicalIntent.OVERVIEW,
            ClinicalIntent.INDICATIONS,
            ClinicalIntent.DOSAGE,
            ClinicalIntent.CONTRAINDICATIONS,
            ClinicalIntent.ADVERSE_EFFECTS,
            ClinicalIntent.INTERACTIONS,
            ClinicalIntent.PRECAUTIONS,
            ClinicalIntent.SPECIAL_POPULATIONS,
            ClinicalIntent.COMPARISON,
            ClinicalIntent.GENERAL_FACTUAL
        ]
        return [i for i in ORDER if i in detected]

    def extract_candidate_entities(self, query: str) -> List[str]:
        """
        Extracts candidate medical entities without relying on a static closed drug list.
        Uses capitalization, word boundaries, and non-stopword medical token patterns.
        """
        COMMON_ENGLISH_WORDS = {
            "what", "is", "are", "the", "and", "or", "for", "with", "can", "you", "tell", "me",
            "about", "how", "much", "many", "when", "why", "where", "who", "should", "someone",
            "anyone", "patient", "patients", "taking", "take", "prescribed", "use", "used", "does",
            "do", "safe", "common", "side", "effect", "effects", "adverse", "reaction", "reactions",
            "contraindication", "contraindications", "contraindicated", "dose", "dosage", "maximum",
            "initial", "starting", "daily", "general", "generally", "explain", "fictional", "medication",
            "medicine", "drug", "drugs", "treatment", "therapy", "disease", "condition", "warning",
            "warnings", "seek", "medical", "attention", "serious", "mild", "severe", "moderate",
            "during", "pregnancy", "pregnant", "lactation", "children", "pediatric", "adult", "adults",
            "alone", "cause", "causes", "causing", "consider", "considering", "indication", "indications",
            "important", "know", "occur", "occurs", "occurring", "relevant", "population", "populations",
            "receive", "receiving", "regard", "regarding", "respect", "suggest", "suggests", "give", "given",
            "giving", "increase", "increases", "increased", "reduce", "reduces", "reduced", "hypoglycemia"
        }
        
        words = re.findall(r'\b[a-zA-Z0-9_-]+\b', query)
        candidates = []
        for w in words:
            wl = w.lower()
            if len(wl) >= 4 and wl not in COMMON_ENGLISH_WORDS and not wl.isdigit():
                if wl not in [c.lower() for c in candidates]:
                    candidates.append(w)
        return candidates

    def compute_complexity(
        self,
        query: str,
        intents: List[ClinicalIntent],
        has_numeric: bool,
        has_negation: bool,
        detected_population: Optional[str]
    ) -> (float, QueryComplexityTier):
        """
        Computes continuous complexity score (0.0 - 1.0) and categorical tier.
        """
        score = 0.1  # baseline
        
        # Intent count weighting
        num_intents = len(intents)
        if num_intents >= 3:
            score += 0.40
        elif num_intents == 2:
            score += 0.25
        elif num_intents == 1 and intents[0] not in [ClinicalIntent.OVERVIEW, ClinicalIntent.GENERAL_FACTUAL]:
            score += 0.15
            
        # Clause count / conjunctions (and, as well as, but)
        conjunctions = len(re.findall(r'\b(?:and|as\s+well\s+as|along\s+with|plus|but|whereas)\b', query, re.IGNORECASE))
        score += min(conjunctions * 0.10, 0.20)
        
        # Constraints
        if has_numeric:
            score += 0.10
        if has_negation:
            score += 0.10
        if detected_population:
            score += 0.15
            
        score = min(max(round(score, 2), 0.0), 1.0)
        
        # Categorize
        if num_intents >= 2 or conjunctions >= 2:
            tier = QueryComplexityTier.MULTI_PART
        elif score >= 0.55:
            tier = QueryComplexityTier.COMPLEX
        elif score >= 0.30:
            tier = QueryComplexityTier.MODERATE
        else:
            tier = QueryComplexityTier.SIMPLE
            
        return score, tier

    def estimate_retrieval_budget(
        self,
        complexity_tier: QueryComplexityTier,
        intents: List[ClinicalIntent]
    ) -> RetrievalBudget:
        """
        Determines dynamic candidate depth, reranking pool, and section diversity requirements.
        """
        # Collect target clinical sections based on detected intents
        target_sections = []
        for i in intents:
            if i in INTENT_SECTION_MAP:
                for sec in INTENT_SECTION_MAP[i]:
                    if sec not in target_sections:
                        target_sections.append(sec)

        if complexity_tier == QueryComplexityTier.MULTI_PART:
            return RetrievalBudget(
                dense_k=30,
                bm25_k=30,
                final_top_k=8,  # Expanded context to fit multiple sections
                require_section_diversity=True,
                target_sections=target_sections
            )
        elif complexity_tier == QueryComplexityTier.COMPLEX:
            return RetrievalBudget(
                dense_k=25,
                bm25_k=25,
                final_top_k=6,
                require_section_diversity=bool(len(target_sections) >= 2),
                target_sections=target_sections
            )
        elif complexity_tier == QueryComplexityTier.MODERATE:
            return RetrievalBudget(
                dense_k=20,
                bm25_k=20,
                final_top_k=5,
                require_section_diversity=False,
                target_sections=target_sections
            )
        else:  # SIMPLE
            return RetrievalBudget(
                dense_k=15,
                bm25_k=15,
                final_top_k=4,  # Focused context for simple factual inquiries
                require_section_diversity=False,
                target_sections=target_sections or ["Indications & Usage"]
            )

    def analyze(self, raw_query: str) -> QueryAnalysis:
        """
        Full end-to-end query understanding pipeline.
        """
        norm_query = self.normalize_query(raw_query)
        intents = self.detect_intents(norm_query)
        entities = self.extract_candidate_entities(norm_query)
        
        # Check constraints
        has_neg = any(rgx.search(norm_query) for rgx in self._compiled_negations)
        has_num = bool(re.search(r'\b(?:\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml)|maximum|starting|initial|daily)\b', norm_query, re.IGNORECASE))
        
        # Check population
        detected_pop = None
        for pop, rgx in self._compiled_populations.items():
            if rgx.search(norm_query):
                detected_pop = pop
                break
                
        # Compute complexity & tier
        complexity_score, tier = self.compute_complexity(
            norm_query, intents, has_num, has_neg, detected_pop
        )
        
        # Multi-part sub-intents decomposition
        is_multi = (tier == QueryComplexityTier.MULTI_PART)
        sub_intents = []
        if is_multi:
            for intent in intents:
                sub_intents.append(intent.value)
                
        # Estimate dynamic retrieval budget
        budget = self.estimate_retrieval_budget(tier, intents)

        # Resolve candidate entities to canonical RxNorm concepts where available
        resolved = []
        for ent in entities:
            res = self.normalizer.normalize_term(ent)
            if res:
                resolved.append(res.model_dump())
        
        return QueryAnalysis(
            raw_query=raw_query,
            normalized_query=norm_query,
            intents=intents,
            is_multi_part=is_multi,
            sub_intents=sub_intents,
            candidate_entities=entities,
            has_negation=has_neg,
            has_numeric=has_num,
            detected_population=detected_pop,
            complexity_score=complexity_score,
            complexity_tier=tier,
            retrieval_budget=budget,
            resolved_entities=resolved
        )
