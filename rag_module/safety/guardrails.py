"""
Clinical Safety, Emergency Triage, Abstention and Prompt Injection Guardrails.
Provides deterministic safety boundaries before and after retrieval and generation.
"""
import re
from typing import Dict, Any, Tuple, Optional, List
from rag_module.config.rag_config import DEFAULT_CONFIG

# Emergency regex patterns for acute life-threatening medical crises
EMERGENCY_PATTERNS = [
    r'\b(chest\s+pain|crushing\s+chest|heart\s+attack|myocardial\s+infarction)\b',
    r'\b(can\'?t\s+breathe|severe\s+shortness\s+of\s+breath|difficulty\s+breathing|choking|asphyxi)\b',
    r'\b(stroke|facial\s+droop|slurred\s+speech|sudden\s+numbness|arm\s+weakness)\b',
    r'\b(anaphylaxis|throat\s+closing|severe\s+allergic\s+reaction)\b',
    r'\b(suicide|kill\s+myself|end\s+my\s+life|self\s+harm)\b',
    r'\b(unconscious|unresponsive|severe\s+bleeding|coughing\s+up\s+blood)\b'
]

# Prompt injection and delimiter hijacking patterns
PROMPT_INJECTION_PATTERNS = [
    r'ignore\s+(all\s+)?(previous|prior|above)\s+instructions',
    r'you\s+are\s+now\s+(in\s+)?(dan|developer\s+mode|unrestricted)',
    r'(system\s*prompt|system\s*message|jailbreak|disregard\s+rules)',
    r'<\s*system\s*>',
    r'\[\s*INST\s*\]'
]

CLINICAL_DISCLAIMER = (
    "\n\n*Clinical Disclaimer: This healthcare AI assistant is an educational Major Project prototype "
    "and does not provide formal medical diagnoses, prescriptive orders, or emergency clinical advice. "
    "For health concerns or medication changes, always consult a licensed physician or healthcare professional.*"
)

EMERGENCY_RESPONSE = (
    "🚨 **MEDICAL EMERGENCY DETECTED** 🚨\n\n"
    "Your description suggests symptoms that may require **immediate medical attention**. "
    "Please take the following actions immediately:\n"
    "1. **Call your local emergency services immediately** (911 in the USA, 112 in Europe/India, 999 in the UK).\n"
    "2. If you are alone, inform someone nearby or go to the nearest emergency room / hospital.\n"
    "3. Do not attempt to self-medicate or wait for symptoms to resolve.\n\n"
    "*This AI system cannot manage or diagnose acute medical emergencies.*"
)


class SafetyGuardrails:
    """
    Multilayer safety and security guardrails for healthcare RAG.
    """
    def __init__(self, config: Optional[DEFAULT_CONFIG.__class__] = None):
        self.config = config or DEFAULT_CONFIG
        self.emergency_regex = re.compile('|'.join(EMERGENCY_PATTERNS), re.IGNORECASE)
        self.injection_regex = re.compile('|'.join(PROMPT_INJECTION_PATTERNS), re.IGNORECASE)

    def check_emergency(self, query: str) -> Optional[str]:
        """
        Scans user query for acute medical crisis keywords.
        Returns emergency response if detected, else None.
        """
        if not self.config.ENABLE_EMERGENCY_TRIAGE:
            return None

        if self.emergency_regex.search(query):
            return EMERGENCY_RESPONSE
        return None

    def sanitize_input(self, user_text: str) -> str:
        """
        Sanitizes user query to prevent prompt injection and delimiter escaping.
        """
        if not user_text:
            return ""

        # Remove control characters
        sanitized = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', user_text)
        
        # Neutralize potential system instruction override markers
        sanitized = self.injection_regex.sub('[FILTERED]', sanitized)
        
        return sanitized.strip()

    def check_abstention(
        self,
        retrieved_chunks: List[Dict[str, Any]],
        similarity_threshold: Optional[float] = None
    ) -> Tuple[bool, str]:
        """
        Evaluates whether retrieved evidence is strong enough to answer.
        Returns (should_abstain, abstention_message).
        """
        if not self.config.ENABLE_ABSTENTION:
            return False, ""

        threshold = similarity_threshold or self.config.SIMILARITY_THRESHOLD

        if not retrieved_chunks:
            return True, (
                "I could not find verified medical information in my trusted clinical knowledge base "
                "to answer this specific question. Please consult a qualified doctor."
            )

        # Check top candidate score
        top_chunk = retrieved_chunks[0]
        # Check dense_score or cosine similarity
        dense_score = top_chunk.get("dense_score")
        
        # If best dense similarity is below threshold, evidence is out-of-domain
        if dense_score is not None and dense_score < threshold:
            return True, (
                "I am not fully confident in the relevance of the available medical sources for this inquiry. "
                "To ensure patient safety, I cannot provide an unverified answer. Please consult a qualified doctor."
            )

        # In hybrid mode without dense score, if fused score is extremely low, abstain
        fused_score = top_chunk.get("fused_score")
        if fused_score is not None and fused_score < 0.005:
            return True, (
                "I am not fully confident in the relevance of the available medical sources for this inquiry. "
                "To ensure patient safety, I cannot provide an unverified answer. Please consult a qualified doctor."
            )

        return False, ""


    def append_disclaimer(self, answer_text: str) -> str:
        """Appends mandatory clinical disclaimer to generated answers."""
        return f"{answer_text.strip()}{CLINICAL_DISCLAIMER}"
