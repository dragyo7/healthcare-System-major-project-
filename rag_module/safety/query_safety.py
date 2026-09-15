"""
Query Safety & Risk Assessment Engine (V2.8).
Provides decoupled pre-retrieval query screening, emergency triage, prompt injection sanitization,
and clinical risk categorization.
"""
import re
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

from rag_module.config.rag_config import DEFAULT_CONFIG


class QueryRiskCategory(str, Enum):
    INFORMATIONAL = "informational"
    MEDICATION_SAFETY = "medication_safety"
    HIGH_RISK_EMERGENCY = "high_risk_emergency"
    OUT_OF_DOMAIN = "out_of_domain"
    INJECTION_ATTEMPT = "injection_attempt"


class QuerySafetyAssessment(BaseModel):
    """
    Structured outcome of pre-retrieval query safety evaluation.
    """
    risk_category: QueryRiskCategory = Field(..., description="Assessed clinical risk tier.")
    is_emergency: bool = Field(default=False, description="True if acute medical emergency crisis detected.")
    emergency_message: Optional[str] = Field(default=None, description="Triage guidance if emergency detected.")
    is_injection: bool = Field(default=False, description="True if prompt injection markers detected.")
    sanitized_query: str = Field(..., description="Sanitized query text safe for indexing/retrieval.")
    requires_strict_grounding: bool = Field(default=True, description="True if high-precision evidence policy required.")
    warnings: List[str] = Field(default_factory=list, description="Safety screening observations.")

    model_config = ConfigDict(extra="forbid")


# Regex patterns for clinical crises
EMERGENCY_PATTERNS = [
    r'\b(chest\s+pain|crushing\s+chest|heart\s+attack|myocardial\s+infarction)\b',
    r'\b(can\'?t\s+breathe|severe\s+shortness\s+of\s+breath|difficulty\s+breathing|choking|asphyxi)\b',
    r'\b(stroke|facial\s+droop|slurred\s+speech|sudden\s+numbness|arm\s+weakness)\b',
    r'\b(anaphylaxis|throat\s+closing|severe\s+allergic\s+reaction)\b',
    r'\b(suicide|kill\s+myself|end\s+my\s+life|self\s+harm)\b',
    r'\b(unconscious|unresponsive|severe\s+bleeding|coughing\s+up\s+blood)\b'
]

# Patterns for prompt injection / instruction override
INJECTION_PATTERNS = [
    r'ignore\s+(all\s+)?(previous|prior|above)\s+instructions',
    r'disregard\s+(all\s+)?(previous|prior|rules|instructions)',
    r'you\s+are\s+now\s+(a|an|in\s+)?(dan|developer\s+mode|unrestricted)',
    r'(system\s*prompt|system\s*message|jailbreak|reveal\s+confidential)',
    r'^\s*system\s*:',
    r'<\s*system\s*>',
    r'\[\s*INST\s*\]'
]


# Keywords indicative of medication safety / dosing inquiry
MEDICATION_SAFETY_KEYWORDS = [
    r'\b(dose|dosage|contraindication|contraindicated|boxed\s+warning|black\s+box|interaction|adverse|side\s+effect|toxicity|overdose|pediatric|pregnancy|lactation|renal\s+impairment|hepatic)\b'
]

EMERGENCY_RESPONSE = (
    "🚨 **MEDICAL EMERGENCY DETECTED** 🚨\n\n"
    "Your description suggests symptoms that may require **immediate medical attention**. "
    "Please take the following actions immediately:\n"
    "1. **Call your local emergency services immediately** (911 in the USA, 112 in Europe/India, 999 in the UK).\n"
    "2. If you are alone, inform someone nearby or go to the nearest emergency room / hospital.\n"
    "3. Do not attempt to self-medicate or wait for symptoms to resolve.\n\n"
    "*This AI system cannot manage or diagnose acute medical emergencies.*"
)


class QuerySafetyEngine:
    """
    Evaluates raw user input before retrieval to determine safety profile and triage routing.
    """
    def __init__(self, enable_emergency: bool = True, enable_sanitization: bool = True):
        self.enable_emergency = enable_emergency
        self.enable_sanitization = enable_sanitization
        self.emergency_regex = re.compile('|'.join(EMERGENCY_PATTERNS), re.IGNORECASE)
        self.injection_regex = re.compile('|'.join(INJECTION_PATTERNS), re.IGNORECASE)
        self.med_safety_regex = re.compile('|'.join(MEDICATION_SAFETY_KEYWORDS), re.IGNORECASE)

    def assess_query(self, raw_query: str) -> QuerySafetyAssessment:
        """
        Executes complete pre-retrieval safety audit on a query.
        """
        warnings = []
        if not raw_query or not raw_query.strip():
            return QuerySafetyAssessment(
                risk_category=QueryRiskCategory.OUT_OF_DOMAIN,
                is_emergency=False,
                sanitized_query="",
                requires_strict_grounding=True,
                warnings=["Query is empty or whitespace."]
            )

        cleaned = raw_query.strip()

        # 1. Prompt injection check
        is_injection = False
        if self.enable_sanitization and self.injection_regex.search(cleaned):
            is_injection = True
            warnings.append("Potential prompt injection pattern detected and sanitized.")
            cleaned = self.injection_regex.sub('[FILTERED]', cleaned)

        # 2. Control character removal
        cleaned = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', cleaned).strip()

        # 3. Emergency triage check
        if self.enable_emergency and self.emergency_regex.search(raw_query):
            return QuerySafetyAssessment(
                risk_category=QueryRiskCategory.HIGH_RISK_EMERGENCY,
                is_emergency=True,
                emergency_message=EMERGENCY_RESPONSE,
                is_injection=is_injection,
                sanitized_query=cleaned,
                requires_strict_grounding=True,
                warnings=["Acute clinical crisis keywords matched emergency regex rules."]
            )

        # 4. Medication safety / pharmacology categorization
        if self.med_safety_regex.search(cleaned):
            risk_category = QueryRiskCategory.MEDICATION_SAFETY
            requires_strict = True
        elif is_injection:
            risk_category = QueryRiskCategory.INJECTION_ATTEMPT
            requires_strict = True
        else:
            risk_category = QueryRiskCategory.INFORMATIONAL
            requires_strict = False

        return QuerySafetyAssessment(
            risk_category=risk_category,
            is_emergency=False,
            emergency_message=None,
            is_injection=is_injection,
            sanitized_query=cleaned,
            requires_strict_grounding=requires_strict,
            warnings=warnings
        )
