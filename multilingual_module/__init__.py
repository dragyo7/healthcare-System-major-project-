"""
Multilingual Foundation Layer for the Healthcare CDS Platform.
Cross-cutting infrastructure supporting English (en), Hindi (hi), and Marathi (mr).
Maintains strict separation between linguistic localization and authoritative clinical RAG grounding.
"""

from multilingual_module.languages import SupportedLanguage, get_language_info, normalize_language_code
from multilingual_module.detector import detect_language
from multilingual_module.canonicalizer import canonicalize_medical_query
from multilingual_module.safety_templates import (
    get_localized_safety_alert,
    get_localized_emergency_guidance,
    get_localized_interaction_alert,
    SAFETY_TEMPLATE_KEYS
)
from multilingual_module.localizer import localize_cds_response

__all__ = [
    "SupportedLanguage",
    "get_language_info",
    "normalize_language_code",
    "detect_language",
    "canonicalize_medical_query",
    "get_localized_safety_alert",
    "get_localized_emergency_guidance",
    "get_localized_interaction_alert",
    "SAFETY_TEMPLATE_KEYS",
    "localize_cds_response",
]
