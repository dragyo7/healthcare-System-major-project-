"""
Supported language definitions, codes, metadata, and fallback logic.
Initial Tier-1 languages: English (en), Hindi (hi), Marathi (mr).
Designed for horizontal extensibility to additional Indic and global languages.
"""
from enum import Enum
from typing import Dict, Any, Optional


class SupportedLanguage(str, Enum):
    ENGLISH = "en"
    HINDI = "hi"
    MARATHI = "mr"
    GUJARATI = "gu"


LANGUAGE_METADATA: Dict[str, Dict[str, Any]] = {
    "en": {
        "code": "en",
        "iso_639_1": "en",
        "name": "English",
        "native_name": "English",
        "script": "Latin",
        "is_canonical": True,
        "direction": "ltr",
        "tier": 1,
    },
    "hi": {
        "code": "hi",
        "iso_639_1": "hi",
        "name": "Hindi",
        "native_name": "हिन्दी",
        "script": "Devanagari",
        "is_canonical": False,
        "direction": "ltr",
        "tier": 1,
    },
    "mr": {
        "code": "mr",
        "iso_639_1": "mr",
        "name": "Marathi",
        "native_name": "मराठी",
        "script": "Devanagari",
        "is_canonical": False,
        "direction": "ltr",
        "tier": 1,
    },
    "gu": {
        "code": "gu",
        "iso_639_1": "gu",
        "name": "Gujarati",
        "native_name": "ગુજરાતી",
        "script": "Gujarati",
        "is_canonical": False,
        "direction": "ltr",
        "tier": 1,
    },
}

DEFAULT_LANGUAGE = "en"


def normalize_language_code(code: Optional[str]) -> str:
    """
    Normalizes language codes and aliases to canonical 2-letter codes.
    Falls back to 'en' for unsupported languages.
    """
    if not code:
        return DEFAULT_LANGUAGE
    
    cleaned = str(code).strip().lower()
    
    aliases = {
        "en": "en", "english": "en", "eng": "en",
        "hi": "hi", "hindi": "hi", "hin": "hi", "हिन्दी": "hi", "हिंदी": "hi",
        "mr": "mr", "marathi": "mr", "mar": "mr", "मराठी": "mr",
        "gu": "gu", "gujarati": "gu", "guj": "gu", "ગુજરાતી": "gu",
    }
    
    return aliases.get(cleaned, DEFAULT_LANGUAGE)


def get_language_info(code: str) -> Dict[str, Any]:
    """Retrieves metadata for a language code, falling back to English if unsupported."""
    norm = normalize_language_code(code)
    return LANGUAGE_METADATA.get(norm, LANGUAGE_METADATA[DEFAULT_LANGUAGE])
