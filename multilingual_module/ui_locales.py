"""
UI Localization Dictionaries for Doctor and Patient Portals.
Supports: English (en), Hindi (hi), Marathi (mr).
Covers:
- Navigation and menu labels
- Dashboard cards and headers
- Patient dossier tabs
- Appointment status badges
- CDS Assistant buttons and verification status badges
"""
from typing import Dict, Any


UI_LOCALES: Dict[str, Dict[str, str]] = {
    # -------------------------------------------------------------
    # Navigation & General
    # -------------------------------------------------------------
    "nav_dashboard": {
        "en": "Dashboard",
        "hi": "डैशबोर्ड",
        "mr": "डॅशबोर्ड",
        "gu": "ડેશબોર્ડ",
    },
    "nav_patients": {
        "en": "Patients",
        "hi": "मरीज",
        "mr": "रुग्ण",
        "gu": "દર્દીઓ",
    },
    "nav_appointments": {
        "en": "Appointments",
        "hi": "मुलाकातें / अपॉइंटमेंट्स",
        "mr": "भेटी / अपॉइंटमेंट्स",
        "gu": "મુલાકાતો / એપોઇન્ટમેન્ટ્સ",
    },
    "nav_schedule": {
        "en": "Schedule",
        "hi": "समय सारिणी (शेड्यूल)",
        "mr": "वेळापत्रक (शेड्यूल)",
        "gu": "સમયપત્રક (શેડ્યૂલ)",
    },
    "nav_prescriptions": {
        "en": "Prescriptions",
        "hi": "दवा के पर्चे",
        "mr": "औषधोपचार पत्रक",
        "gu": "દવાઓનું પ્રિસ્ક્રિપ્શન",
    },
    "nav_profile": {
        "en": "Profile",
        "hi": "प्रोफाइल",
        "mr": "प्रोफाइल",
        "gu": "પ્રોફાઇલ",
    },
    "nav_logout": {
        "en": "Log Out",
        "hi": "लॉग आउट",
        "mr": "लॉग आउट",
        "gu": "લૉગ આઉટ",
    },

    # -------------------------------------------------------------
    # Dashboard Cards
    # -------------------------------------------------------------
    "dash_total_patients": {
        "en": "Total Patients",
        "hi": "कुल मरीज",
        "mr": "एकूण रुग्ण",
        "gu": "કુલ દર્દીઓ",
    },
    "dash_today_completed": {
        "en": "Today's Completed",
        "hi": "आज पूर्ण हुई मुलाकातें",
        "mr": "आज पूर्ण झालेल्या भेटी",
        "gu": "આજની પૂર્ણ મુલાકાતો",
    },
    "dash_upcoming_appointments": {
        "en": "Upcoming Appointments",
        "hi": "आगामी मुलाकातें",
        "mr": "पुढील भेटी",
        "gu": "આગામી મુલાકાતો",
    },

    # -------------------------------------------------------------
    # Patient Dossier Tabs & Sections
    # -------------------------------------------------------------
    "dossier_vitals": {
        "en": "Vital Signs & Demographics",
        "hi": "महत्वपूर्ण लक्षण एवं विवरण",
        "mr": "महत्त्वाची शारीरिक लक्षणे व तपशील",
        "gu": "મહત્વપૂર્ણ લક્ષણો અને વિગતો",
    },
    "dossier_symptoms": {
        "en": "Reported Symptoms",
        "hi": "बताए गए लक्षण",
        "mr": "नोंदवलेली लक्षणे",
        "gu": "નોંધાયેલ લક્ષણો",
    },
    "dossier_medical_history": {
        "en": "Past Medical History",
        "hi": "पिछला चिकित्सीय इतिहास",
        "mr": "मागील वैद्यकीय इतिहास",
        "gu": "પાછલો તબીબી ઇતિહાસ",
    },
    "dossier_prescriptions": {
        "en": "Past Prescriptions",
        "hi": "पिछले पर्चे",
        "mr": "मागील औषधोपचार",
        "gu": "પાછલા પ્રિસ્ક્રિપ્શન",
    },
    "dossier_reports": {
        "en": "Medical Reports",
        "hi": "मेडिकल रिपोर्ट्स",
        "mr": "वैद्यकीय अहवाल",
        "gu": "મેડિકલ રિપોર્ટ્સ",
    },

    # -------------------------------------------------------------
    # CDS Assistant Interface
    # -------------------------------------------------------------
    "cds_title": {
        "en": "Clinical Decision Support Assistant",
        "hi": "क्लिनिकल निर्णय सहायता सहायक (CDS)",
        "mr": "क्लिनिकल निर्णय साहाय्यक (CDS)",
        "gu": "ક્લિનિકલ ડિસિઝન સપોર્ટ આસિસ્ટન્ટ (CDS)",
    },
    "cds_subtitle": {
        "en": "Evidence-grounded medical guidance with fail-closed safety verification.",
        "hi": "आधिकारिक चिकित्सा प्रमाणों पर आधारित सुरक्षित मार्गदर्शन।",
        "mr": "अधिकृत वैद्यकीय पुराव्यांवर आधारित सुरक्षित मार्गदर्शन.",
        "gu": "સત્તાવાર તબીબી પુરાવાઓ પર આધારિત સલામત માર્ગદર્શન.",
    },
    "cds_evaluate_button": {
        "en": "Evaluate with CDS Assistant",
        "hi": "CDS सहायक से मूल्यांकन करें",
        "mr": "CDS साहाय्यकाद्वारे तपासणी करा",
        "gu": "CDS સહાયક સાથે મૂલ્યાંકન કરો",
    },
    "cds_placeholder": {
        "en": "Ask clinical question or check candidate medications...",
        "hi": "चिकित्सीय प्रश्न पूछें या दवाओं की परस्पर क्रिया जांचें...",
        "mr": "वैद्यकीय प्रश्न विचारा किंवा औषधांची सुरक्षितता तपासा...",
        "gu": "તબીબી પ્રશ્ન પૂછો અથવા દવાની ક્રિયાપ્રતિક્રિયા તપાસો...",
    },

    # -------------------------------------------------------------
    # Verification Status Badges
    # -------------------------------------------------------------
    "badge_grounded": {
        "en": "✓ Grounded & Verified",
        "hi": "✓ प्रमाणित एवं सत्यापित",
        "mr": "✓ पुराव्यानुसार सत्यापित",
        "gu": "✓ પ્રમાણિત અને ચકાસાયેલ",
    },
    "badge_partially_grounded": {
        "en": "⚠ Partially Grounded",
        "hi": "⚠ आंशिक रूप से प्रमाणित",
        "mr": "⚠ अंशतः सत्यापित",
        "gu": "⚠ આંશિક રીતે પ્રમાણિત",
    },
    "badge_abstained": {
        "en": "🛡️ Policy Abstention",
        "hi": "🛡️ नीतिगत सुरक्षित अस्वीकृति",
        "mr": "🛡️ धोरणानुसार सुरक्षित नकार",
        "gu": "🛡️ નીતિગત સુરક્ષિત અસ્વીકૃતિ",
    },
    "badge_emergency": {
        "en": "🚨 Emergency Triage",
        "hi": "🚨 आपातकालीन चेतावनी",
        "mr": "🚨 तातडीची आणीबाणी",
        "gu": "🚨 કટોકટી ચેતવણી",
    },
    "badge_injection_blocked": {
        "en": "🛡️ Security Block",
        "hi": "🛡️ सुरक्षा अवरोध",
        "mr": "🛡️ सुरक्षा निर्बंध",
        "gu": "🛡️ સુરક્ષા બ્લોક",
    },

    # -------------------------------------------------------------
    # Appointment Statuses
    # -------------------------------------------------------------
    "status_scheduled": {
        "en": "Scheduled",
        "hi": "निर्धारित",
        "mr": "नियोजित",
        "gu": "શેડ્યૂલ કરેલ",
    },
    "status_completed": {
        "en": "Completed",
        "hi": "पूर्ण",
        "mr": "पूर्ण झाले",
        "gu": "પૂર્ણ થયેલ",
    },
    "status_cancelled": {
        "en": "Cancelled",
        "hi": "रद्द",
        "mr": "रद्द केले",
        "gu": "રદ થયેલ",
    },
}


def get_ui_text(key: str, lang: str = "en") -> str:
    """Retrieves localized UI text string for key, falling back to English."""
    loc = UI_LOCALES.get(key, {})
    return loc.get(lang) or loc.get("en", key)
