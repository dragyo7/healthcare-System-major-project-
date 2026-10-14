"""
Deterministic, lightweight Language Detection for Clinical Queries.
Accurately detects English, Hindi, and Marathi with zero external dependencies.
Distinguishes Devanagari script between Hindi and Marathi using characteristic lexical and grammatical markers.
"""
import re
from typing import Dict, Any, Tuple
from multilingual_module.languages import SupportedLanguage, DEFAULT_LANGUAGE


# Devanagari Unicode block: U+0900 to U+097F
DEVANAGARI_REGEX = re.compile(r"[\u0900-\u097F]")
# Gujarati Unicode block: U+0A80 to U+0AFF
GUJARATI_REGEX = re.compile(r"[\u0A80-\u0AFF]")
LATIN_REGEX = re.compile(r"[a-zA-Z]")

# Distinctive grammatical and lexical markers for Marathi
# Unique characters: ळ (U+0933) is heavily used in Marathi and absent in modern standard Hindi
MARATHI_SPECIFIC_CHARS = {"ळ", "ऱ्ह", "ऱ"}

MARATHI_MARKERS = {
    # Auxiliary verbs & copulas
    "आहे", "आहेत", "होते", "नाही", "नाहीत", "असावे", "असेल", "झाले",
    # Postpositions & case markers
    "साठी", "मधील", "वरून", "कडे", "पेक्षा", "मुळे", "बद्दल",
    # Question words & conjunctions
    "काय", "कसे", "कधी", "कुठे", "कोणते", "आणि", "किंवा", "पण",
    # Verbal forms & imperatives
    "करावे", "घ्यावे", "घेऊ", "वापरायचे", "सांगा", "माहिती", "औषध", "औषधे",
    "दुष्परिणाम", "तपासणी", "लक्षणे", "उपचार", "डोस", "प्रमाण",
}

# Distinctive grammatical markers for Hindi
HINDI_MARKERS = {
    # Auxiliary verbs & copulas
    "है", "हैं", "था", "थी", "थे", "नहीं", "होगी", "होगा", "हुआ",
    # Postpositions
    "के", "की", "का", "को", "से", "में", "पर", "लिए", "द्वारा",
    # Question words & conjunctions
    "क्या", "कैसे", "कब", "कहाँ", "कौन", "और", "या", "लेकिन",
    # Verbal forms
    "करना", "लेना", "दीजिए", "बताइए", "चाहिए", "सकता", "सकती", "दवा", "दवाई",
    "नुकसान", "फायदे", "खुराक", "लक्षण", "इलाज",
}

# Distinctive grammatical markers for Gujarati
GUJARATI_MARKERS = {
    # Auxiliary verbs & copulas
    "છે", "છો", "હતા", "હતી", "હતું", "નથી", "થાય", "થશે",
    # Postpositions & case markers
    "માટે", "માં", "થી", "પર", "દ્વારા", "વિશે",
    # Question words & conjunctions
    "શું", "કેવી", "કેવી રીતે", "ક્યારે", "ક્યાં", "કોણ", "અને", "અથવા", "પણ",
    # Verbal forms & clinical words
    "લેવી", "કરવું", "આપો", "જણાવો", "જોઈએ", "શકે", "દવા", "દવાઓ",
    "આડઅસર", "આડઅસરો", "દુષ્પરિણામ", "ડોઝ", "માત્રા", "લક્ષણો", "ઉપચાર", "ફાયદા",
}


def detect_language(text: str) -> Dict[str, Any]:
    """
    Detects language of input text (English, Hindi, Marathi, or Gujarati).
    
    Returns:
        {
            "language": "en" | "hi" | "mr" | "gu",
            "confidence": float (0.0 to 1.0),
            "script": "Latin" | "Devanagari" | "Gujarati" | "Mixed" | "Unknown",
            "is_indic": bool
        }
    """
    if not text or not text.strip():
        return {
            "language": DEFAULT_LANGUAGE,
            "confidence": 1.0,
            "script": "Latin",
            "is_indic": False
        }

    raw = text.strip()
    devanagari_chars = len(DEVANAGARI_REGEX.findall(raw))
    gujarati_chars = len(GUJARATI_REGEX.findall(raw))
    latin_chars = len(LATIN_REGEX.findall(raw))
    total_alpha = devanagari_chars + gujarati_chars + latin_chars

    # 1. Pure or predominantly Latin script -> English
    if (devanagari_chars == 0 and gujarati_chars == 0) or (latin_chars / max(total_alpha, 1) > 0.75):
        return {
            "language": SupportedLanguage.ENGLISH.value,
            "confidence": 0.98 if (devanagari_chars == 0 and gujarati_chars == 0) else 0.85,
            "script": "Latin",
            "is_indic": False
        }

    # 2. Distinct Gujarati script block present
    if gujarati_chars > 0 and gujarati_chars >= devanagari_chars:
        script = "Gujarati" if latin_chars == 0 else "Mixed"
        return {
            "language": SupportedLanguage.GUJARATI.value,
            "confidence": 0.98 if latin_chars == 0 else 0.88,
            "script": script,
            "is_indic": True
        }

    # 3. Devanagari script present -> Distinguish Hindi vs Marathi
    script = "Devanagari" if latin_chars == 0 else "Mixed"

    # Fast character-level check: ळ is specifically Marathi in northern/western Indic
    if any(ch in raw for ch in MARATHI_SPECIFIC_CHARS):
        return {
            "language": SupportedLanguage.MARATHI.value,
            "confidence": 0.95,
            "script": script,
            "is_indic": True
        }

    # Token-level lexical scoring
    tokens = [t.strip(",.!?।;:\"'()[]{}") for t in raw.split()]
    marathi_score = sum(1 for t in tokens if t in MARATHI_MARKERS)
    hindi_score = sum(1 for t in tokens if t in HINDI_MARKERS)

    if marathi_score > hindi_score:
        confidence = min(0.60 + (marathi_score * 0.15), 0.98)
        return {
            "language": SupportedLanguage.MARATHI.value,
            "confidence": round(confidence, 2),
            "script": script,
            "is_indic": True
        }
    elif hindi_score > marathi_score:
        confidence = min(0.60 + (hindi_score * 0.15), 0.98)
        return {
            "language": SupportedLanguage.HINDI.value,
            "confidence": round(confidence, 2),
            "script": script,
            "is_indic": True
        }
    else:
        # Default tie-breaker for ambiguous Devanagari: Hindi (standard national fallback)
        return {
            "language": SupportedLanguage.HINDI.value,
            "confidence": 0.70,
            "script": script,
            "is_indic": True
        }


# Indic Emergency patterns (Hindi + Marathi + Gujarati)
INDIC_EMERGENCY_PATTERNS = [
    # Chest pain / Heart attack (Hi, Mr, Gu)
    r"(?:छाती(?:त|\s*में)?\s*(?:खूप\s*)?(?:तीव्र\s*)?(?:वेदना|दुखणे|दर्द))",
    r"(?:છાતી(?:માં)?\s*(?:ખૂબ\s*)?(?:તીવ્ર\s*)?(?:દુખાવો|દર્દ))",
    r"(?:हार्ट\s*(?:अटॅक|अटैक)|हृदयविकाराचा\s*झटका|दिल\s*का\s*दौरा|હાર્ટ\s*એટેક|હૃદયરોગનો\s*હુમલો)",
    # Breathing difficulties
    r"(?:श्वास\s*(?:घेता\s*येत\s*नाही|घेण्यास\s*त्रास|घुटमळणे))",
    r"(?:સાંસ\s*(?:नहीं\s*ले\s*(?:पा\s*रहा|सकते)|लेने\s*में\s*(?:तकलीफ|कठिनाई|दिक्कत)|फूल\s*रही))",
    r"(?:શ્વાસ\s*(?:લેવામાં\s*(?:તકલીફ|મુશ્કેલી)|નથી\s*લઈ\s*શકાતો|ગૂંગળામણ))",
    # Unconsciousness / Stroke
    r"(?:बेहोश|बेहोशी|शुद्ध\s*हरपणे|अर्धांगवायू|स्ट्रोक|બેભાન|ચક્કર|લકવો|સ્ટ્રોક)",
    # Bleeding / Poisoning / Vomiting blood
    r"(?:रक्तस्त्राव|रक्त\s*उलटी|खून\s*की\s*उल्टी|विषबाधा|जहर|विष|રક્તસ્રાવ|લોહીની\s*ઉલટી|ઝેર|ઝેરી)",
    # Self-harm
    r"(?:आत्महत्या|स्वतःला\s*मारून|खुद\s*को\s*मारने|આત્મહત્યા)",
]

# Indic Prompt Injection patterns (Hindi + Marathi + Gujarati)
INDIC_INJECTION_PATTERNS = [
    r"(?:निर्देशों?\s*को\s*(?:अनदेखा|भूल|नजरअंदाज))",
    r"(?:सूचना\s*(?:दुर्लक्षित|विसरा))",
    r"(?:સૂચનાઓ\s*(?:અવગણો|ભૂલી\s*જાઓ))",
    r"(?:सिस्टम\s*(?:प्रॉम्प्ट|संदेश|निर्देश)|સિસ્ટમ\s*(?:પ્રોમ્પ્ટ|સંદેશ))",
    r"(?:गुप्त\s*माहिती\s*दाखवा|प्रॉम्प्ट\s*दिखाएं|ગુપ્ત\s*માહિતી\s*બતાવો)",
    r"(?:मागील\s*सर्व\s*नियम|पिछले\s*सभी\s*नियम|પાછલા\s*તમામ\s*નિયમો)",
]


def is_indic_emergency(text: str) -> bool:
    """Returns True if input text matches Indic acute emergency crisis patterns."""
    if not text:
        return False
    return any(bool(re.search(pat, text, re.IGNORECASE)) for pat in INDIC_EMERGENCY_PATTERNS)


def is_indic_prompt_injection(text: str) -> bool:
    """Returns True if input text matches Indic prompt injection patterns."""
    if not text:
        return False
    return any(bool(re.search(pat, text, re.IGNORECASE)) for pat in INDIC_INJECTION_PATTERNS)
