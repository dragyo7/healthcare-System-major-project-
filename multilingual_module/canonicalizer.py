"""
Canonical Query Representation & Medical Normalization.
Converts multilingual (Hindi, Marathi, Gujarati, English) clinical inquiries into
canonical English medical representations suitable for the frozen English DailyMed / ICMR RAG knowledge base.

Core Invariants:
1. Exact drug names, brand names, and dosages (e.g. 500mg, 5mg, 10ml) are preserved.
2. Clinical negations (e.g. नहीं, नाही, न, don't, avoid, never) are preserved.
3. Medical conditions, symptoms, and clinical intentions are normalized to canonical terminology.
4. Generalizable phonetic transliteration & vocabulary mapping over all 199+ corpus drugs.
5. NO tokens are dropped merely because they are not in a dictionary.
6. NO canned questions are fabricated when normalization fails.
7. Metadata exposing normalization provenance is returned for transparency and empirical evaluation.
"""
import os
import re
import difflib
from typing import Dict, Any, List, Set, Optional
from multilingual_module.detector import detect_language


# -----------------------------------------------------------------------------
# 1. Corpus Drug Knowledge
# -----------------------------------------------------------------------------
CORPUS_DRUGS_PATH = os.path.join(os.path.dirname(__file__), "..", "rag_module", "data", "corpus_drugs.txt")

def _load_corpus_drugs() -> List[str]:
    drugs: List[str] = []
    if os.path.exists(CORPUS_DRUGS_PATH):
        with open(CORPUS_DRUGS_PATH, "r", encoding="utf-8") as f:
            for line in f:
                d = line.strip().lower()
                if d and d not in drugs:
                    drugs.append(d)
    if not drugs:
        drugs = [
            "acyclovir", "albuterol", "allopurinol", "alprazolam", "amlodipine", "amoxicillin",
            "aspirin", "atenolol", "atorvastatin", "azithromycin", "carvedilol", "ciprofloxacin",
            "clopidogrel", "diltiazem", "furosemide", "glimepiride", "gliclazide", "hydrochlorothiazide",
            "ibuprofen", "lisinopril", "losartan", "metformin", "metoprolol", "omeprazole",
            "pantoprazole", "paracetamol", "prednisone", "ramipril", "rosuvastatin", "salbutamol",
            "simvastatin", "telmisartan", "tramadol", "valsartan", "warfarin"
        ]
    return drugs

CORPUS_DRUGS: List[str] = _load_corpus_drugs()
CORPUS_DRUGS_SET: Set[str] = set(CORPUS_DRUGS)


# -----------------------------------------------------------------------------
# 2. Phonetic Transliteration Tables (Devanagari & Gujarati -> Latin)
# -----------------------------------------------------------------------------
DEVA_TO_LATIN = {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
    'ष': 'sh', 'स': 's', 'ह': 'h', 'ळ': 'l', 'क्ष': 'ksh', 'ज्ञ': 'gy',
    'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u',
    'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', '्': '',
    'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u',
    'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
    'ऑ': 'o', 'ॅ': 'e', 'ॉ': 'o', 'ऍ': 'e', 'ऋ': 'ri',
    '़': '', 'ज़': 'z', 'फ़': 'f', 'क़': 'q', 'ख़': 'kh', 'ग़': 'gh'
}

GUJ_TO_LATIN = {
    'ક': 'k', 'ખ': 'kh', 'ગ': 'g', 'ઘ': 'gh', 'ઙ': 'ng',
    'ચ': 'ch', 'છ': 'chh', 'જ': 'j', 'ઝ': 'jh', 'ઞ': 'ny',
    'ટ': 't', 'ઠ': 'th', 'ડ': 'd', 'ઢ': 'dh', 'ણ': 'n',
    'ત': 't', 'થ': 'th', 'દ': 'd', 'ધ': 'dh', 'ન': 'n',
    'પ': 'p', 'ફ': 'ph', 'બ': 'b', 'ભ': 'bh', 'મ': 'm',
    'ય': 'y', 'ર': 'r', 'લ': 'l', 'વ': 'v', 'શ': 'sh',
    'ષ': 'sh', 'સ': 's', 'હ': 'h', 'ળ': 'l', 'ક્ષ': 'ksh', 'જ્ઞ': 'gy',
    'ા': 'a', 'િ': 'i', 'ી': 'i', 'ુ': 'u', 'ૂ': 'u',
    'ે': 'e', 'ૈ': 'ai', 'ો': 'o', 'ૌ': 'au', 'ં': 'n', '્': '',
    'અ': 'a', 'આ': 'a', 'ઇ': 'i', 'ઈ': 'i', 'ઉ': 'u', 'ઊ': 'u',
    'એ': 'e', 'ઐ': 'ai', 'ઓ': 'o', 'ઔ': 'au',
    'ૉ': 'o', 'ૅ': 'e', '઼': ''
}


def transliterate_token(token: str) -> str:
    """Dynamically transliterates an Indic script token (Devanagari/Gujarati) into Latin phonetics."""
    chars = []
    # Replace composite nukta characters first
    t = token.replace('ज़', 'z').replace('फ़', 'f').replace('क़', 'q').replace('ख़', 'kh').replace('ग़', 'gh')
    for c in t:
        if c in DEVA_TO_LATIN:
            chars.append(DEVA_TO_LATIN[c])
        elif c in GUJ_TO_LATIN:
            chars.append(GUJ_TO_LATIN[c])
        else:
            chars.append(c)
    return "".join(chars)


def match_corpus_drug_phonetically(token: str) -> Optional[str]:
    """
    Attempts to match an Indic or Latin transliterated token to the authoritative 199-drug DailyMed corpus.
    Uses phonetic rule substitutions (ph->f, v->w, em->am) and fuzzy string similarity.
    """
    t_clean = re.sub(r"^[\s,.!?।;:\"'()\[\]{}]+|[\s,.!?।;:\"'()\[\]{}]+$", "", token).lower()
    if not t_clean or len(t_clean) < 3:
        return None

    # Direct match
    if t_clean in CORPUS_DRUGS_SET:
        return t_clean

    trans = transliterate_token(t_clean)
    candidate = trans.replace("ph", "f").replace("ee", "i").replace("oo", "u").replace("़", "").replace("઼", "")

    # Generate phonetic variants
    variants = []
    if candidate.startswith("em"):
        variants.append("am" + candidate[2:])
        variants.append(candidate)
    else:
        variants.append(candidate)

    if candidate.startswith("v"):
        variants.append("w" + candidate[1:])
    if "j" in candidate:
        variants.append(candidate.replace("j", "z"))
    if candidate.startswith("s"):
        variants.append("c" + candidate[1:])
    if candidate.startswith("s") and ("j" in candidate or "z" in candidate):
        variants.append("c" + candidate[1:].replace("j", "z"))
    if candidate.startswith("ai"):
        variants.append("i" + candidate[2:])

    for var in variants:
        if var in CORPUS_DRUGS_SET:
            return var
        matches = difflib.get_close_matches(var, CORPUS_DRUGS, n=1, cutoff=0.72)
        if matches:
            return matches[0]

    return None


# -----------------------------------------------------------------------------
# 3. Clinical Intent & Negation Mapping
# -----------------------------------------------------------------------------
CLINICAL_INTENT_MAP = {
    # Conditions & Inflected Case Forms
    "मधुमेहासाठी": "for diabetes mellitus", "मधुमेहावर": "for diabetes mellitus",
    "मधुमेहाचा": "of diabetes mellitus", "मधुमेहाचे": "of diabetes mellitus", "मधुमेहाची": "of diabetes mellitus",
    "मधुमेह": "diabetes mellitus", "डायबिटीज": "diabetes mellitus", "ડાયાબિટીસ": "diabetes mellitus",
    "ડાયાબિટીસ માટે": "for diabetes mellitus", "ડાયાબિટીસવાળા": "with diabetes mellitus",
    "प्रौढांसाठी": "for adults", "प्रौढांकरिता": "for adults", "वयस्कों के लिए": "for adults",
    "वयस्कों में": "in adults", "પુખ્ત વયના લોકો માટે": "for adults", "પુખ્ત વયના લોકો": "adults", "પુખ્ત વયના": "adult",
    "टाइप 2": "type 2", "टाइप २": "type 2", "ટાઈપ 2": "type 2", "ટાઈપ ૨": "type 2",
    "उच्च रक्तचाप": "hypertension", "उच्च रक्तदाब": "hypertension", "बीपी": "blood pressure",
    "रक्तदाबाच्या": "blood pressure", "रक्तदाब": "blood pressure", "रक्तचाप": "blood pressure",
    "બ્લડ પ્રેશર": "blood pressure", "હાઈ બ્લડ પ્રેશર": "hypertension", "હાઈ બીપી": "hypertension",
    "हार्ट अटॅक": "heart attack", "हार्ट अटैक": "heart attack", "હાર્ટ એટેક": "heart attack",
    "किडनी": "kidney", "गुर्दा": "kidney", "मूत्रपिंड": "renal / kidney", "કિડની": "kidney",
    "यकृत": "liver", "लिवर": "liver", "जिगर": "liver",
    "दमा": "asthma", "अस्थमा": "asthma", "અસ્થમા": "asthma",
    "ताप": "fever", "बुखार": "fever",
    "डोकेदुखी": "headache", "सिरदर्द": "headache", "માથાનો દુખાવો": "headache",

    "दुष्परिणाम": "side effects and adverse reactions",
    "दुष्प्रभाव": "side effects and adverse reactions",
    "આડઅસરો": "side effects and adverse reactions",
    "આડઅસર": "side effects",
    "आडअसरो": "side effects and adverse reactions",
    "आडअसर": "side effects",
    "आडपरिणाम": "adverse effects",
    "નુકસાન": "adverse effects and risks",
    "नुकसान": "adverse effects and risks",
    "साइड इफेक्ट्स": "side effects",
    "साइड इफेक्ट": "side effects",
    "સાઇડ ઇફેક્ટ્સ": "side effects",
    "સાઇડ ઇફેક્ટ": "side effects",
    "शुरुआती खुराक": "starting dosage and administration",
    "सुरुवातीचा डोस": "starting dosage and administration",
    "सुरुवातीची खुराक": "starting dosage and administration",
    "પ્રારંભિક ડોઝ": "starting dosage and administration",
    "शुरुआती": "starting initial", "सुरुवातीचा": "starting initial", "सुरुवातीची": "starting initial", "પ્રારંભિક": "starting initial",
    "खुराक": "dosage and administration",
    "डोस": "dosage", "ડોઝ": "dosage",
    "मधुमेह वाले": "diabetes mellitus patients", "डायबिटीज वाले": "diabetes mellitus patients",
    "वयस्कों": "adults",
    "के लिए": "for", "वाले": "with", "की": "of", "का": "of", "के": "of",
    "साठी": "for", "करिता": "for", "માટે": "for",
    "काय आहे": "what is", "શું છે": "what is", "क्या है": "what is",
    "वापर आणि संकेत": "indications and clinical usage",
    "उपयोग और संकेत": "indications and clinical usage",
    "ઉપયોગ અને સંકેતો": "indications and clinical usage",
    "ઉપયોગ અને સંકેત": "indications and clinical usage",
    "किसके लिए प्रयोग किया जाता है": "indications and clinical usage",
    "किसके लिए प्रयोग": "indications and clinical usage",
    "प्रयोग किया जाता है": "indications and clinical usage",
    "किस काम आती है": "indications and clinical usage",
    "किस बीमारी में दी जाती है": "indications and clinical usage",
    "कशासाठी वापरतात": "indications and clinical usage",
    "कशासाठी वापरले जाते": "indications and clinical usage",
    "कशासाठी आहे": "indications and clinical usage",
    "શેના માટે છે": "indications and clinical usage",
    "શેના માટે વપરાય છે": "indications and clinical usage",
    "દવા શેના માટે": "indications and clinical usage",
    "દવા શેના માટે છે": "indications and clinical usage",
    "संकेत": "indications",
    "संकेतों": "indications",
    "સંકેત": "indications",
    "સંકેતો": "indications",
    "वापर": "indications and clinical usage",
    "उपयोग": "indications and clinical usage",
    "खाने के बाद लेना चाहिए या पहले": "timing of administration with meals or food",
    "खाने के बाद या पहले": "timing of administration with meals or food",
    "जेवणानंतर की आधी": "timing of administration with meals or food",
    "જમ્યા પછી કે પહેલાં": "timing of administration with meals or food",
    "फायदे": "therapeutic benefits and indications",
    "ફાયદા": "therapeutic benefits and indications",
    "कसे घ्यावे": "how to administer and take",
    "कैसे लें": "how to administer and take",
    "કેવી રીતે લેવી": "how to administer and take",
    "ક્યારે લેવી": "administration timing",
    "ક્યારે લેવું": "administration timing",
    "कधी घ्यावे": "administration timing",
    "केव्हा घ्यावे": "administration timing",
    "कधी घ्यावी": "administration timing",
    "कब लें": "administration timing",
    "कब लेना": "administration timing",
    "सुबह": "morning", "सकाळी": "morning", "સવારે": "morning",
    "रात": "night", "रात्री": "night", "રાત્રે": "night",
    "સાંજે": "evening", "संध्याकाळी": "evening", "शाम": "evening",
    "પાણી સાથે": "with water", "पाण्यासोबत": "with water", "पानी के साथ": "with water",
    "ખોરાક સાથે": "with food", "जेवणासोबत": "with food", "खाने के साथ": "with food",
    "ખાધા પછી": "after food", "जेवणानंतर": "after food", "खाने के बाद": "after food",
    "ખાધા પહેલાં": "before food", "जेवणापूर्वी": "before food", "खाने से पहले": "before food",
    "कशी काम करते": "mechanism of action",
    "कैसे काम करती है": "mechanism of action",
    "કેવી રીતે કામ કરે છે": "mechanism of action",
    "कार्यपद्धती": "mechanism of action",
    "विरोधाभास": "contraindications",
    "વિરોધાભાસ": "contraindications",
    "कधी घेऊ नये": "contraindications",
    "कब नहीं लेना चाहिए": "contraindications",
    "ક્યારે ન લેવી": "contraindications",
    "परस्परसंवाद": "drug interactions",
    "ઇન્ટરેક્શન": "drug interactions",
    "इंटरॅक्शन": "drug interactions",
    "इंटरैक्शन": "drug interactions",
    "सावधगिरी": "warnings and precautions",
    "सावधानियां": "warnings and precautions",
    "ચેતવણીઓ": "warnings and precautions",
    "સાવચેતી": "warnings and precautions",

    # Co-Prescribing & Concomitant Inquiries (Only actual combination markers)
    "સાથે લેવી": "together co-prescribe",
    "સાથે લઈ શકાય": "together co-prescribe",
    "સાથે": "together co-prescribe",
    "એકસાથે": "together co-prescribe",
    "एकत्र": "together co-prescribe",
    "सोबत": "together co-prescribe",
    "साथ में": "together co-prescribe",
    "एक साथ": "together co-prescribe",

    # Permissibility & Administration Inquiries (Unlinked from co-prescribe)
    "घेता येईल का": "can take",
    "घेऊ शकतो का": "can take",
    "घेऊ शकते का": "can take",
    "घेता येईल": "can take",
    "घेऊ शकतो": "can take",
    "घेऊ शकते": "can take",
    "ले सकते हैं": "can take",
    "ले सकता हूँ": "can take",
    "ले सकती हूँ": "can take",
    "ले सकता": "can take",
    "ले सकती": "can take",
    "दे सकते हैं": "can administer",
    "दे सकते": "can administer",
    "दे सकता हूँ": "can administer",
    "दे सकती हूँ": "can administer",
    "લઈ શકાય": "can take",
    "લઈ શકું": "can take",

    # Allergy & Hypersensitivity Tokens
    "पेनिसिलिनची ऍलर्जी आहे": "penicillin allergy",
    "पेनिसिलिनची ऍलर्जी": "penicillin allergy",
    "पेनिसिलिन ऍलर्जी": "penicillin allergy",
    "पेनिसिलिनची एलर्जी": "penicillin allergy",
    "पेनिसिलिन": "penicillin",
    "पेन्सिलिन": "penicillin",
    "penisilin": "penicillin",
    "सल्फा ऍलर्जी": "sulfa allergy",
    "सल्फा एलर्जी": "sulfa allergy",
    "સલ્ફા એલર્જી": "sulfa allergy",
    "सल्फा": "sulfa",
    "સલ્ફા": "sulfa",
    "slpha": "sulfa",
    "ऍलर्जी": "allergy",
    "अलर्जी": "allergy",
    "एलर्जी": "allergy",
    "એલર્જી": "allergy",
    "alerji": "allergy",
    "elrji": "allergy",
    "allergy": "allergy",

    # Dosage Frequency & Timing Tokens
    "दिन में दो बार": "twice daily",
    "din me do baar": "twice daily",
    "दिवसातून दोनदा": "twice daily",
    "divsatun donda": "twice daily",
    "દિવસમાં બે વાર": "twice daily",
    "दिन में एक बार": "once daily",
    "din me ek baar": "once daily",
    "दिवसातून एकदा": "once daily",
    "divsatun ekda": "once daily",
    "દિવસમાં એક વાર": "once daily",
    "दिन में तीन बार": "three times daily",
    "दिवसातून तीन वेळा": "three times daily",
    "દિવસમાં ત્રણ વાર": "three times daily",
    "din me kitni baar": "daily dosage frequency",
    "दिन में कितनी बार": "daily dosage frequency",
    "कितनी बार": "dosage frequency",
    "kitni baar": "dosage frequency",
    "किती वेळा": "dosage frequency",
    "kiti vela": "dosage frequency",
    "કેટલી વાર": "dosage frequency",
    "खाली पेट": "on an empty stomach",
    "khali pet": "on an empty stomach",
    "उपाशी पोटी": "on an empty stomach",
    "upashi poti": "on an empty stomach",
    "ભૂખ્યા પેટે": "on an empty stomach",
    "khane ke baad lena chahiye ya pehle": "timing of administration with meals or food",
    "khane ke baad ya pehle": "timing of administration with meals or food",
    "kiske liye use hota hai": "indications and clinical usage",
    "kiske liye use hoti hai": "indications and clinical usage",
    "सोने से पहले": "at bedtime",
    "sone se pehle": "at bedtime",
    "झोपण्यापूर्वी": "at bedtime",
    "ઊંઘતા પહેલા": "at bedtime",
    "शराब के साथ": "with alcohol",
    "sharab ke sath": "with alcohol",
    "अल्कोहोलसोबत": "with alcohol",
    "alcohol ke sath": "with alcohol",
    "દારૂ સાથે": "with alcohol",
    "डोस विसरल्यास": "missed dose",
    "डोस चुकल्यास": "missed dose",
    "खुराक भूल जाने पर": "missed dose",
    "डबल डोस": "double dose",
    "डबल": "double",

    # Clinical Medical Terms & Nouns
    "दवा के": "medicine", "दवा की": "medicine", "दवाएं": "medicine", "दवाई": "medicine", "दवा": "medicine",
    "દવાના": "medicine", "દવાની": "medicine", "દવાઓ": "medicine", "દવા ના": "medicine", "દવા": "medicine",
    "औषधाचे": "medicine", "औषधांच्या": "medicine", "औषधाची": "medicine", "औषधे": "medicine", "औषध": "medicine",
    "गोळ्यांचे": "tablets", "गोळ्या": "tablets", "गोळीचे": "tablets", "गोळी": "tablets", "गोली के": "tablets", "गोली": "tablets", "गोलियां": "tablets",
    "ગોળીઓ": "tablets", "ગોળીના": "tablets", "ગોળી": "tablets",
    "ટેબ્લેટ": "tablets", "ટેબલેટ": "tablets", "ટૅબ્લેટ": "tablets", "टैबलेट": "tablets",
    "સામાન્ય": "common", "सामान्य": "common",
    "શું છે": "what are", "શું હોઈ શકે": "what are", "શું": "what are",
    "काय आहे": "what are", "काय आहेत": "what are", "काय": "what are",
    "क्या है": "what are", "क्या हैं": "what are", "क्या": "what are",
    "લેવી જોઈએ": "to take", "લેવી પડે": "to take", "લેવી": "to take", "લેવાય": "to take",
    "घेणे": "to take", "घ्यावी": "to take", "घ्यावे": "to take",
    "लेना": "to take", "लेनी चाहिए": "to take", "लें": "to take",
    "માટે": "for", "साठी": "for", "के लिए": "for",
    "કેવી રીતે": "how to", "कसे": "how to", "कैसे": "how to",
    "ક્યારે": "when", "कधी": "when", "कब": "when",
    "શા માટે": "why", "कशासाठी": "why", "किसलिए": "why", "क्यों": "why",
    "કોઈપણ": "any", "કોઈ": "any", "कोणते": "any", "काही": "any", "कोई": "any",
    "છે": "are", "છો": "are",
    "आहे": "is", "आहेत": "are",
    "है": "is", "हैं": "are",
    "અને": "and", "आणि": "and", "और": "and",
    "અથવા": "or", "किंवा": "or", "या": "or",

    # Latin-script Transliteration & Code-Switching Patterns
    "kya nuksan hain": "side effects and adverse reactions",
    "kya nuksan hai": "side effects and adverse reactions",
    "kya side effects hain": "side effects and adverse reactions",
    "side effects kya hain": "side effects and adverse reactions",
    "kadhi ghyavi": "administration timing",
    "kadhi ghyave": "administration timing",
    "kyare levi": "administration timing",
    "kyare levanu": "administration timing",
    "kashasathi": "indications and clinical usage",
    "kiske liye": "indications and clinical usage",
    "sha mate": "indications and clinical usage",
    "pani ke sath": "with water",
    "pani sathe": "with water",
    "panyasobat": "with water",
    "khana khane ke baad": "after food",
    "jamya pachhi": "after food",
    "jevananantar": "after food",
    "ek sath": "together co-prescribe",
    "saath me": "together co-prescribe",
    "ekatra": "together co-prescribe",
    "sathe levi": "together co-prescribe",
    "le sakte hain": "can take",
    "gheu shakto ka": "can take",
    "lai shakay": "can take",

    # English & Cross-Lingual Clinical Query Intent Mappings
    "commonly used for": "indications and clinical usage",
    "commonly used": "indications and clinical usage",
    "used for": "indications and clinical usage",
    "what is it used for": "indications and clinical usage",
    "what about its side effects": "side effects and adverse reactions of",
    "what about their side effects": "side effects and adverse reactions of",
    "explain that boxed warning": "boxed warning and clinical precautions",
    "explain that warning": "warnings and precautions",
    "summarize the instructions": "discharge instructions and care plan summary",
    "summarize the care instructions": "discharge instructions and care plan summary",
    "what serious adverse effects": "serious adverse reactions and warnings",
    "dosing and administration guidelines for": "dosage and administration guidelines for",
    "approved indications for": "indications and clinical usage for",
    "what are the approved indications": "indications and clinical usage",

    # Clinical Conditions & Intentions
    "गर्भावस्था": "pregnancy", "ગર્ભાવસ્થા": "pregnancy",
    "उल्टी": "vomiting and nausea", "ઉલટી": "vomiting and nausea", "उलटी": "vomiting and nausea",

    # Negations & Contraindications (MUST BE PRESERVED)
    "नहीं": "not", "नही": "not", "नाही": "not", "न": "do not",
    "ન": "do not", "નથી": "not", "નહીં": "not", "नका": "do not", "नको": "do not",
    "ન લેવી": "do not take", "નથી લેવી": "do not take", "ન લેવું": "do not take",
    "न लें": "do not take", "नका घेऊ": "do not take", "घेऊ नका": "do not take",
    "नहीं लेना चाहिए": "do not take", "नही लेना चाहिए": "do not take",
    "नाही घ्यावे": "do not take", "नाही घ्यावी": "do not take",
    "बंध": "discontinue", "बंद": "discontinue",
    "बिना": "without", "शिवाय": "without", "વિના": "without"
}


def extract_dosage_tokens(text: str) -> List[str]:
    """Extracts dosage expressions like 500mg, 5 mg, 10ml, etc."""
    pattern = re.compile(r"\b\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|tablets?|capsules?)\b", re.IGNORECASE)
    return pattern.findall(text)


def canonicalize_medical_query(raw_query: str, forced_lang: str = None) -> Dict[str, Any]:
    """
    Transforms Hindi, Marathi, Gujarati, or English medical queries into canonical English
    representations for the retrieval engine without dropping unmatched tokens or fabricating canned queries.

    Returns:
        {
            "canonical_query": str,
            "original_query": str,
            "detected_language": str,
            "extracted_drugs": List[str],
            "extracted_dosages": List[str],
            "preserved_tokens": List[str],
            "was_canonicalized": bool,
            "normalization_strategy": str
        }
    """
    if not raw_query or not raw_query.strip():
        return {
            "canonical_query": "",
            "original_query": "",
            "detected_language": "en",
            "extracted_drugs": [],
            "extracted_dosages": [],
            "preserved_tokens": [],
            "was_canonicalized": False,
            "normalization_strategy": "empty_query"
        }

    raw = raw_query.strip()
    detection = detect_language(raw)
    lang = forced_lang or detection["language"]

    # Extract dosages first
    extracted_dosages = extract_dosage_tokens(raw)

    # If detected as English, check whether Romanized Indic or clinical intent markers exist
    if lang == "en":
        # Check if the query contains Romanized Indic or transliterated intent phrases
        has_romanized_intent = any(
            re.search(rf"(?<![^\s\.,\?!।\(\)]){re.escape(k)}(?![^\s\.,\?!।\(\)])", raw, re.IGNORECASE)
            for k in CLINICAL_INTENT_MAP
            if re.search(r"[a-zA-Z]", k) and len(k) >= 3 and k.lower() not in {"and", "or", "for", "any", "not"}
        )
        if not has_romanized_intent:
            extracted_drugs = []
            for word in re.findall(r"\b[a-zA-Z]{3,}\b", raw.lower()):
                if word in CORPUS_DRUGS_SET and word not in extracted_drugs:
                    extracted_drugs.append(word)
            return {
                "canonical_query": raw,
                "original_query": raw,
                "detected_language": "en",
                "extracted_drugs": extracted_drugs,
                "extracted_dosages": extracted_dosages,
                "preserved_tokens": raw.split(),
                "was_canonicalized": False,
                "normalization_strategy": "passthrough_english"
            }

    # Multilingual Normalization Pipeline
    working_text = raw
    extracted_drugs: List[str] = []

    # 1. Map known multi-word clinical phrases & intentions (with punctuation & boundary protection)
    for indic_phrase, english_equiv in sorted(CLINICAL_INTENT_MAP.items(), key=lambda x: -len(x[0])):
        # Match only at word boundaries (whitespace or punctuation)
        pattern = re.compile(rf"(?<![^\s\.,\?!।\(\)]){re.escape(indic_phrase)}(?![^\s\.,\?!।\(\)])", re.IGNORECASE)
        if pattern.search(working_text):
            working_text = pattern.sub(f" {english_equiv} ", working_text)

    # 2. Tokenize and identify drugs dynamically (transliteration + fuzzy match)
    tokens = working_text.split()
    processed_tokens: List[str] = []

    for tok in tokens:
        clean_tok = re.sub(r"^[\s,.!?।;:\"'()\[\]{}]+|[\s,.!?।;:\"'()\[\]{}]+$", "", tok)
        # Check if this token matches a corpus drug
        matched_drug = match_corpus_drug_phonetically(clean_tok)
        if matched_drug:
            if matched_drug not in extracted_drugs:
                extracted_drugs.append(matched_drug)
            processed_tokens.append(matched_drug)
        else:
            # Check if token is already Latin or numeric
            if re.search(r"[a-zA-Z0-9]", tok):
                processed_tokens.append(tok)
            else:
                # Transliterate Indic token rather than silently dropping it
                translit = transliterate_token(clean_tok)
                if translit and len(translit) >= 1:
                    processed_tokens.append(translit)

    canonical_result = " ".join(processed_tokens).strip()
    canonical_result = re.sub(r"\s+", " ", canonical_result)

    # Normalize inverted Indic interrogative syntax for RAG retrieval & generator prompt clarity
    # e.g., "amlodipine medicine common side effects what are" -> "what are common side effects of amlodipine"
    what_match = re.search(r"^(.*?)\s+(what\s+(?:is|are))\s*$", canonical_result, re.IGNORECASE)
    if what_match:
        rest = what_match.group(1).strip()
        q_word = what_match.group(2).strip()
        tokens_rest = rest.split()
        if tokens_rest and tokens_rest[0].lower() in CORPUS_DRUGS_SET:
            drug = tokens_rest[0]
            postpositions = {"medicine", "medicines", "tablet", "tablets", "ke", "ki", "ka", "che", "chi", "chya", "na", "ni", "nu"}
            other = " ".join([t for t in tokens_rest[1:] if t.lower() not in postpositions])
            canonical_result = f"{q_word} {other} of {drug}"
        else:
            canonical_result = f"{q_word} {rest}"

    # Fallback safety: If result is empty, keep original query
    if not canonical_result:
        canonical_result = raw

    return {
        "canonical_query": canonical_result,
        "original_query": raw,
        "detected_language": lang,
        "extracted_drugs": list(set(extracted_drugs)),
        "extracted_dosages": extracted_dosages,
        "preserved_tokens": processed_tokens,
        "was_canonicalized": True,
        "normalization_strategy": "dynamic_transliteration_and_corpus_alignment"
    }
