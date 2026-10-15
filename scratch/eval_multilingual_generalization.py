import re
import difflib
from multilingual_module.canonicalizer import (
    canonicalize_medical_query,
    match_corpus_drug_phonetically,
    CORPUS_DRUGS_SET
)
from multilingual_module.detector import detect_language

# -----------------------------------------------------------------------------
# EXPANDED HELD-OUT MULTILINGUAL GENERALIZATION BENCHMARK (24 Cases)
# Balanced across 4 languages: English (6), Hindi (6), Marathi (6), Gujarati (6)
# Covering:
# - Native Indic scripts (Devanagari, Gujarati)
# - Latin-script transliterations (Hinglish, Marathish, Gujaratish)
# - Code-switching & Mixed-language preambles
# - Lookalike / Soundalike distinct drug disambiguation
# - Clinical negation & contraindication reversal preservation
# - Dosing, units, administration timing
# - Unseen fictitious / unsupported medications (0 False Positive invariant)
# -----------------------------------------------------------------------------
HELD_OUT_TEST_CASES = [
    # ========================== ENGLISH (6 Cases) ==========================
    {
        "id": "TC-EN-01",
        "lang_code": "en",
        "category": "Standard Clinical Query",
        "query": "What are the clinical indications and contraindications of Lisinopril 10mg?",
        "expected_lang": "en",
        "expected_drugs": ["lisinopril"],
        "expected_dosage": "10mg",
        "expected_intents": ["indications", "contraindications"],
        "is_negated": False,
        "is_unsupported": False
    },
    {
        "id": "TC-EN-02",
        "lang_code": "en",
        "category": "Clinical Negation",
        "query": "Patients with acute renal failure must not take Metformin 850mg.",
        "expected_lang": "en",
        "expected_drugs": ["metformin"],
        "expected_dosage": "850mg",
        "expected_intents": ["not", "renal"],
        "is_negated": True,
        "is_unsupported": False
    },
    {
        "id": "TC-EN-03",
        "lang_code": "en",
        "category": "Lookalike Disambiguation",
        "query": "Compare Amlodipine 5mg and Felodipine 5mg mechanisms of action.",
        "expected_lang": "en",
        "expected_drugs": ["amlodipine", "felodipine"],
        "expected_dosage": "5mg",
        "expected_intents": ["mechanism"],
        "is_negated": False,
        "is_unsupported": False
    },
    {
        "id": "TC-EN-04",
        "lang_code": "en",
        "category": "Timing & Administration",
        "query": "Should Omeprazole 20mg capsules be swallowed before breakfast?",
        "expected_lang": "en",
        "expected_drugs": ["omeprazole"],
        "expected_dosage": "20mg",
        "expected_intents": ["breakfast"],
        "is_negated": False,
        "is_unsupported": False
    },
    {
        "id": "TC-EN-05",
        "lang_code": "en",
        "category": "Pediatric / Dosing",
        "query": "What is the maximum daily dose of Amoxicillin 250mg suspension?",
        "expected_lang": "en",
        "expected_drugs": ["amoxicillin"],
        "expected_dosage": "250mg",
        "expected_intents": ["dose"],
        "is_negated": False,
        "is_unsupported": False
    },
    {
        "id": "TC-EN-06",
        "lang_code": "en",
        "category": "Unsupported Fictitious Entity",
        "query": "What are the therapeutic side effects of Cardiorexol 50mg?",
        "expected_lang": "en",
        "expected_drugs": [],
        "expected_dosage": "50mg",
        "expected_intents": ["side effects"],
        "is_negated": False,
        "is_unsupported": True
    },

    # ========================== HINDI (6 Cases) ==========================
    {
        "id": "TC-HI-01",
        "lang_code": "hi",
        "category": "Native Script Drug",
        "query": "ओंडैनसेट्रॉन 4mg उल्टी के लिए कैसे लें?",
        "expected_lang": "hi",
        "expected_drugs": ["ondansetron"],
        "expected_dosage": "4mg",
        "expected_intents": ["vomiting", "how to administer and take"],
        "is_negated": False,
        "is_unsupported": False
    },
    {
        "id": "TC-HI-02",
        "lang_code": "hi",
        "category": "Latin Transliteration (Hinglish)",
        "query": "Metformin 500mg khane ke baad lena chahiye ya pehle?",
        "expected_lang": "en", # Latin script
        "expected_drugs": ["metformin"],
        "expected_dosage": "500mg",
        "expected_intents": [],
        "is_negated": False,
        "is_unsupported": False
    },
    {
        "id": "TC-HI-03",
        "lang_code": "hi",
        "category": "Code-Switching Mixed Script",
        "query": "Doctor sahab please batayein क्या Pantoprazole 40mg खाली पेट लेना सुरक्षित है?",
        "expected_lang": "hi",
        "expected_drugs": ["pantoprazole"],
        "expected_dosage": "40mg",
        "expected_intents": [],
        "is_negated": False,
        "is_unsupported": False
    },
    {
        "id": "TC-HI-04",
        "lang_code": "hi",
        "category": "Clinical Negation",
        "query": "गर्भावस्था के दौरान बिना सलाह इबुप्रोफेन 400mg नहीं लेना चाहिए।",
        "expected_lang": "hi",
        "expected_drugs": ["ibuprofen"],
        "expected_dosage": "400mg",
        "expected_intents": ["pregnancy", "not"],
        "is_negated": True,
        "is_unsupported": False
    },
    {
        "id": "TC-HI-05",
        "lang_code": "hi",
        "category": "Timing & Administration",
        "query": "एमलोडिपिन 5mg उच्च रक्तचाप के लिए सुबह लें?",
        "expected_lang": "hi",
        "expected_drugs": ["amlodipine"],
        "expected_dosage": "5mg",
        "expected_intents": ["hypertension"],
        "is_negated": False,
        "is_unsupported": False
    },
    {
        "id": "TC-HI-06",
        "lang_code": "hi",
        "category": "Unsupported Fictitious Entity",
        "query": "हेपाटोफ्लक्स 250mg यकृत के लिए उपयोगी है?",
        "expected_lang": "hi",
        "expected_drugs": [],
        "expected_dosage": "250mg",
        "expected_intents": ["liver"],
        "is_negated": False,
        "is_unsupported": True
    },

    # ========================== MARATHI (6 Cases) ==========================
    {
        "id": "TC-MR-01",
        "lang_code": "mr",
        "category": "Native Script Drug",
        "query": "सिटिरिज़िन 10 mg रात्री घेतल्यास झोप येते का?",
        "expected_lang": "mr",
        "expected_drugs": ["cetirizine"],
        "expected_dosage": "10 mg",
        "expected_intents": ["night", "jhop"],
        "is_negated": False,
        "is_unsupported": False
    },
    {
        "id": "TC-MR-02",
        "lang_code": "mr",
        "category": "Latin Transliteration (Marathish)",
        "query": "Lisinopril 10mg BP saathi kadhi ghyaychi?",
        "expected_lang": "en",
        "expected_drugs": ["lisinopril"],
        "expected_dosage": "10mg",
        "expected_intents": [],
        "is_negated": False,
        "is_unsupported": False
    },
    {
        "id": "TC-MR-03",
        "lang_code": "mr",
        "category": "Lookalike Disambiguation",
        "query": "अम्लोडिपिन 5mg आणि फेलोडिपिन मधील फरक काय आहे?",
        "expected_lang": "mr",
        "expected_drugs": ["amlodipine", "felodipine"],
        "expected_dosage": "5mg",
        "expected_intents": [],
        "is_negated": False,
        "is_unsupported": False
    },
    {
        "id": "TC-MR-04",
        "lang_code": "mr",
        "category": "Clinical Negation",
        "query": "रक्तदाब वाढल्यास लिसिनोप्रिल बंद करू नका",
        "expected_lang": "mr",
        "expected_drugs": ["lisinopril"],
        "expected_dosage": None,
        "expected_intents": ["blood pressure", "do not"],
        "is_negated": True,
        "is_unsupported": False
    },
    {
        "id": "TC-MR-05",
        "lang_code": "mr",
        "category": "Adverse Reaction Inquiry",
        "query": "अटोर्वास्टॅटिन 20mg चे दुष्परिणाम काय आहेत?",
        "expected_lang": "mr",
        "expected_drugs": ["atorvastatin"],
        "expected_dosage": "20mg",
        "expected_intents": ["side effects and adverse reactions"],
        "is_negated": False,
        "is_unsupported": False
    },
    {
        "id": "TC-MR-06",
        "lang_code": "mr",
        "category": "Unsupported Fictitious Entity",
        "query": "मिराक्लोरिन 50mg चे दुष्परिणाम काय आहेत?",
        "expected_lang": "mr",
        "expected_drugs": [],
        "expected_dosage": "50mg",
        "expected_intents": ["side effects and adverse reactions"],
        "is_negated": False,
        "is_unsupported": True
    },

    # ========================== GUJARATI (6 Cases) ==========================
    {
        "id": "TC-GU-01",
        "lang_code": "gu",
        "category": "Native Script Drug",
        "query": "અટોર્વાસ્ટેટિન 20mg ના મુખ્ય ફાયદા શું છે?",
        "expected_lang": "gu",
        "expected_drugs": ["atorvastatin"],
        "expected_dosage": "20mg",
        "expected_intents": ["therapeutic benefits and indications"],
        "is_negated": False,
        "is_unsupported": False
    },
    {
        "id": "TC-GU-02",
        "lang_code": "gu",
        "category": "Latin Transliteration (Gujaratish)",
        "query": "Metformin 500mg jamya pachi levani ke pehla?",
        "expected_lang": "en",
        "expected_drugs": ["metformin"],
        "expected_dosage": "500mg",
        "expected_intents": [],
        "is_negated": False,
        "is_unsupported": False
    },
    {
        "id": "TC-GU-03",
        "lang_code": "gu",
        "category": "Code-Switching Gujarati + English",
        "query": "Doctor, શું amlodipine 5mg સાથે grapefruit ખાવું safe છે?",
        "expected_lang": "gu",
        "expected_drugs": ["amlodipine"],
        "expected_dosage": "5mg",
        "expected_intents": [],
        "is_negated": False,
        "is_unsupported": False
    },
    {
        "id": "TC-GU-04",
        "lang_code": "gu",
        "category": "Clinical Negation",
        "query": "ગર્ભાવસ્થા દરમિયાન આઇબુપ્રોફેન ન લેવી",
        "expected_lang": "gu",
        "expected_drugs": ["ibuprofen"],
        "expected_dosage": None,
        "expected_intents": ["pregnancy", "do not take"],
        "is_negated": True,
        "is_unsupported": False
    },
    {
        "id": "TC-GU-05",
        "lang_code": "gu",
        "category": "Drug Interaction Inquiry",
        "query": "પેરાસિટામોલ 500mg અને આઇબુપ્રોફેન વચ્ચે શું ઇન્ટરેક્શન છે?",
        "expected_lang": "gu",
        "expected_drugs": ["paracetamol", "ibuprofen"],
        "expected_dosage": "500mg",
        "expected_intents": ["drug interactions"],
        "is_negated": False,
        "is_unsupported": False
    },
    {
        "id": "TC-GU-06",
        "lang_code": "gu",
        "category": "Unsupported Fictitious Entity",
        "query": "કાર્ડિયોમેક્સિન 100mg હાર્ટ માટે કેવી રીતે કામ કરે છે?",
        "expected_lang": "gu",
        "expected_drugs": [],
        "expected_dosage": "100mg",
        "expected_intents": ["mechanism of action"],
        "is_negated": False,
        "is_unsupported": True
    }
]

print("=" * 80)
print("EXPANDED HELD-OUT MULTILINGUAL GENERALIZATION BENCHMARK (24 Cases)")
print("=" * 80)

per_lang_stats = {
    "en": {"total": 0, "lang_ok": 0, "drugs_ok": 0, "dosage_ok": 0, "intent_ok": 0, "unsupported_ok": 0, "fp_count": 0},
    "hi": {"total": 0, "lang_ok": 0, "drugs_ok": 0, "dosage_ok": 0, "intent_ok": 0, "unsupported_ok": 0, "fp_count": 0},
    "mr": {"total": 0, "lang_ok": 0, "drugs_ok": 0, "dosage_ok": 0, "intent_ok": 0, "unsupported_ok": 0, "fp_count": 0},
    "gu": {"total": 0, "lang_ok": 0, "drugs_ok": 0, "dosage_ok": 0, "intent_ok": 0, "unsupported_ok": 0, "fp_count": 0}
}

global_metrics = {
    "total": len(HELD_OUT_TEST_CASES),
    "lang_detected_correct": 0,
    "drug_matched_correct": 0,
    "supported_cases_count": 0,
    "dosage_preserved": 0,
    "dosage_applicable_count": 0,
    "intent_or_negation_preserved": 0,
    "unsupported_rejection_correct": 0,
    "unsupported_cases_count": 0,
    "false_positive_drug_matches": 0
}

for tc in HELD_OUT_TEST_CASES:
    raw_query = tc["query"]
    target_lang = tc["lang_code"]
    per_lang_stats[target_lang]["total"] += 1
    
    det = detect_language(raw_query)
    canon = canonicalize_medical_query(raw_query)
    
    # 1. Language Detection
    lang_ok = (det["language"] == tc["expected_lang"])
    if lang_ok:
        global_metrics["lang_detected_correct"] += 1
        per_lang_stats[target_lang]["lang_ok"] += 1
        
    # 2. Drug Entity Matching / Fictitious Rejection
    extracted = canon.get("extracted_drugs", [])
    if tc["is_unsupported"]:
        global_metrics["unsupported_cases_count"] += 1
        if len(extracted) == 0:
            drug_ok = True
            global_metrics["unsupported_rejection_correct"] += 1
            per_lang_stats[target_lang]["unsupported_ok"] += 1
        else:
            drug_ok = False
            global_metrics["false_positive_drug_matches"] += 1
            per_lang_stats[target_lang]["fp_count"] += 1
    else:
        global_metrics["supported_cases_count"] += 1
        # Check all expected drugs are found
        all_expected_found = all(exp in extracted for exp in tc["expected_drugs"])
        if all_expected_found:
            drug_ok = True
            global_metrics["drug_matched_correct"] += 1
            per_lang_stats[target_lang]["drugs_ok"] += 1
        else:
            drug_ok = False
            
    # 3. Dosage & Unit Preservation
    dosages = canon.get("extracted_dosages", [])
    if tc["expected_dosage"]:
        global_metrics["dosage_applicable_count"] += 1
        exp_clean = tc["expected_dosage"].replace(" ", "").lower()
        found_clean = [d.replace(" ", "").lower() for d in dosages]
        dose_ok = (exp_clean in found_clean)
        if dose_ok:
            global_metrics["dosage_preserved"] += 1
            per_lang_stats[target_lang]["dosage_ok"] += 1
    else:
        dose_ok = True
        
    # 4. Semantic Intent & Clinical Negation Preservation
    canon_text = canon.get("canonical_query", "").lower()
    intent_ok = True
    if tc["is_negated"]:
        if "not" not in canon_text and "do not" not in canon_text:
            intent_ok = False
    for intent in tc["expected_intents"]:
        if intent.lower() not in canon_text:
            intent_ok = False
    if intent_ok:
        global_metrics["intent_or_negation_preserved"] += 1
        per_lang_stats[target_lang]["intent_ok"] += 1

    overall_ok = (lang_ok and drug_ok and dose_ok and intent_ok)
    tag = "PASS" if overall_ok else "PARTIAL"

    print(f"[{tag}] {tc['id']} ({tc['lang_code'].upper()} - {tc['category']}): \"{raw_query}\"")
    print(f"       Detected Lang: {det['language']} (Expected: {tc['expected_lang']})")
    print(f"       Extracted Drugs: {extracted} (Expected: {tc['expected_drugs']})")
    print(f"       Dosages: {dosages} (Expected: {tc['expected_dosage']})")
    print(f"       Canonical: {canon.get('canonical_query')}")
    print()

print("=" * 80)
print("OVERALL HELD-OUT GENERALIZATION SUMMARY")
print("=" * 80)
print(f"Total Test Cases: {global_metrics['total']}")
print(f"Language Detection Accuracy: {global_metrics['lang_detected_correct']}/{global_metrics['total']} ({global_metrics['lang_detected_correct']/global_metrics['total']*100:.1f}%)")
print(f"Medication Extraction Precision/Recall on Supported: {global_metrics['drug_matched_correct']}/{global_metrics['supported_cases_count']} ({global_metrics['drug_matched_correct']/global_metrics['supported_cases_count']*100:.1f}%)")
print(f"Correct Rejection of Unsupported/Fictitious Drugs: {global_metrics['unsupported_rejection_correct']}/{global_metrics['unsupported_cases_count']} ({global_metrics['unsupported_rejection_correct']/global_metrics['unsupported_cases_count']*100:.1f}%)")
print(f"Unsafe False-Positive Matches on Fictitious Entities: {global_metrics['false_positive_drug_matches']}")
print(f"Dosage & Unit Preservation: {global_metrics['dosage_preserved']}/{global_metrics['dosage_applicable_count']} ({global_metrics['dosage_preserved']/global_metrics['dosage_applicable_count']*100:.1f}%)")
print(f"Intent & Clinical Negation Preservation: {global_metrics['intent_or_negation_preserved']}/{global_metrics['total']} ({global_metrics['intent_or_negation_preserved']/global_metrics['total']*100:.1f}%)\n")

print("-" * 80)
print("PER-LANGUAGE BREAKDOWN MATRIX")
print("-" * 80)
print(f"{'Language':<12} | {'Cases':<6} | {'Lang Acc':<10} | {'Drug Extr':<10} | {'Fictitious Rej':<14} | {'Dosage Pres':<12} | {'Intent Pres'}")
print("-" * 80)
for lcode, data in per_lang_stats.items():
    supp_in_lang = 5  # 5 supported, 1 unsupported per language
    unsupp_in_lang = 1
    dose_cases_in_lang = 5 if lcode in ["mr", "gu"] else 6
    print(
        f"{lcode.upper():<12} | "
        f"{data['total']:<6} | "
        f"{data['lang_ok']}/{data['total']} ({data['lang_ok']/data['total']*100:.0f}%) | "
        f"{data['drugs_ok']}/{supp_in_lang} ({data['drugs_ok']/supp_in_lang*100:.0f}%) | "
        f"{data['unsupported_ok']}/{unsupp_in_lang} ({data['unsupported_ok']/unsupp_in_lang*100:.0f}%) | "
        f"{data['dosage_ok']}/{dose_cases_in_lang} ({data['dosage_ok']/dose_cases_in_lang*100:.0f}%) | "
        f"{data['intent_ok']}/{data['total']} ({data['intent_ok']/data['total']*100:.0f}%)"
    )
print("-" * 80)
