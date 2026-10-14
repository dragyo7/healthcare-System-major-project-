# Multilingual CDS Architecture Specification

> **Document Type**: Cross-Cutting Architectural Specification & Engineering Standard  
> **Subsystem**: `multilingual_module` (Multilingual Foundation Layer)  
> **Status**: **IMPLEMENTED & VERIFIED (PASS 16/16 Unit & Integration Tests)**  
> **Supported Languages**: English (`en`), Hindi (`hi`), Marathi (`mr`)  
> **Date**: October 2026  

---

## 1. Architectural Philosophy & Invariants

The Multilingual Foundation Layer is designed as a **clean, independent cross-cutting pipeline** wrapped around the frozen medical intelligence stack.

```text
User Input (en / hi / mr)
       │
       ▼
┌──────────────────────────────────────────┐
│      1. Language Identification          │  (Deterministic Script + Marker N-grams)
└──────────────────────┬───────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────┐
│    2. Indic Safety Early Diversion       │  (Emergency Triage & Prompt Injection)
└──────────────────────┬───────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────┐
│   3. Canonical Medical Representation    │  (Transliteration + Concept Mapping)
└──────────────────────┬───────────────────┘
                       │  Canonical English Query
                       ▼
┌──────────────────────────────────────────┐
│    4. FROZEN MEDICAL RAG V2.10           │
│   • 2,204 DailyMed SPL Chunks            │  (AUTHORITATIVE SINGLE SOURCE OF TRUTH)
│   • FAISS + BM25 + RRF + Cross-Encoder   │  (ZERO SEPARATE INDIC INDICES)
│   • Deterministic Verifier               │
└──────────────────────┬───────────────────┘
                       │  Verified Grounded Claims & SPL Citations
                       ▼
┌──────────────────────────────────────────┐
│       5. Response Localization           │  (Controlled Translation Glossaries)
└──────────────────────┬───────────────────┘
                       │
                       ▼
Localized Grounded Response (en / hi / mr)
```

### Non-Negotiable Invariants
1. **RAG Is Frozen**: No Hindi or Marathi FAISS vector indices are created. The English DailyMed SPL knowledge base (2,204 chunks) remains the single authoritative source of medical truth.
2. **Zero Unverified Translations**: The system never translates unverified or hallucinated text into regional languages to present as grounded medical advice.
3. **Safety-Critical Message Protection**: Emergency instructions, prompt injection blocks, and deterministic drug interaction alerts are rendered from **authoritative, pre-verified multilingual templates** rather than unconstrained generative models.
4. **Preservation of Critical Clinical Tokens**:
   * Drug generic and brand names (`Metformin`, `Lisinopril`, `Aspirin`, `Warfarin`)
   * Dosages and units (`500mg`, `5 mg`, `10ml`, `once daily`)
   * Clinical negations (`nahi`, `nahin`, `avoid`, `contraindicated`)
   * Provenance URLs and DailyMed source identifiers

---

## 2. Subsystem Components & Responsibilities

The multilingual foundation is cleanly encapsulated within `multilingual_module/`:

| Module Component | File Path | Primary Function |
| :--- | :--- | :--- |
| **Language Definitions** | `multilingual_module/languages.py` | Supported enum (`en`, `hi`, `mr`), ISO code normalization, fallback handling. |
| **Language Detector** | `multilingual_module/detector.py` | Deterministic identification of script (Latin vs Devanagari) and distinguishing Hindi vs Marathi via unique lexical markers (`ळ`, auxiliary verbs). |
| **Indic Safety Filters** | `multilingual_module/detector.py` | `is_indic_emergency()` and `is_indic_prompt_injection()` regex engines for immediate triage interception. |
| **Canonicalizer** | `multilingual_module/canonicalizer.py` | Maps Devanagari drug names and clinical inquiry intents into canonical English queries for DailyMed RAG retrieval. |
| **Safety Templates** | `multilingual_module/safety_templates.py` | Authoritative trilingual templates for emergency guidance (112 / 108), injection blocks, policy abstentions, and interaction alerts. |
| **Response Localizer** | `multilingual_module/localizer.py` | Transforms verified English clinical statements into structured target language explanations with attached DailyMed citations. |
| **UI Locales** | `multilingual_module/ui_locales.py` | Centralized translation dictionaries for UI buttons, badges, navigation headers, and modal text. |

---

## 3. Detailed Request-Response Walkthrough

### Scenario A: Hindi Clinical Query
1. **User Submits**: `"मेटफॉर्मिन के उपयोग और संकेत क्या हैं?"` (`language="hi"`)
2. **Language Detector**: Identifies Devanagari script, matches Hindi copula `"हैं"`, outputs `detected_language="hi"`.
3. **Early Safety Check**: Neither emergency nor injection detected.
4. **Canonicalizer**:
   * Transliterates `"मेटफॉर्मिन"` $\to$ `"metformin"`
   * Maps `"उपयोग और संकेत"` $\to$ `"indications and clinical usage"`
   * Canonical Query: `"metformin indications and clinical usage"`
5. **Frozen RAG Execution**:
   * Retrieves top DailyMed chunks (`fused_score`, Cross-Encoder rerank)
   * Generates grounded English clinical claims
   * `AnswerGroundingVerifier` verifies token-level attribution against DailyMed SPL chunks
6. **Localizer**:
   * Attaches Hindi preamble: `"**चिकित्सीय संदर्भ एवं सारांश (दवा मोनोग्राफ के आधार पर):**"`
   * Replaces mapped terminology (`Type 2 Diabetes Mellitus`, `oral administration`)
   * Preserves exact DailyMed source citations (`DM-MET-IND-001`, URL)
7. **Client Receives**: Complete, grounded Hindi response backed by verified FDA/DailyMed citations.

### Scenario B: Marathi Emergency Crisis
1. **User Submits**: `"माझ्या छातीत खूप तीव्र वेदना होत आहेत आणि मला श्वास घेता येत नाही"`
2. **Language Detector**: Detects Devanagari + Marathi postposition `"होत आहेत"`, sets `detected_language="mr"`.
3. **Indic Safety Filter**: `is_indic_emergency()` matches `"छातीत ... तीव्र वेदना"` (chest pain) and `"श्वास घेता येत नाही"` (can't breathe).
4. **Early Triage Interception**: Intercepts request before retrieval or generation (`emergency_diverted`).
5. **Localized Safety Template**: Injects authoritative Marathi emergency guidance:
   * `"🚨 **वैद्यकीय आणीबाणी आढळली** 🚨"`
   * Directs user immediately to **112 / 108** ambulance services.
   * `citations=[]`, `abstained=False`, `is_emergency=True`.

---

## 4. Safety-Critical Translation Protocol

To eliminate medical risk from generative LLM hallucinations, safety-critical messages strictly avoid unconstrained open-ended translation:

```text
Safety-Critical Event
        │
        ├── Acute Emergency Triage ─────────────► Authoritative Emergency Template (112/108)
        │
        ├── Adversarial Prompt Injection ───────► Authoritative Security Alert Template
        │
        ├── Unsupported Drug / Out-of-Domain ───► Authoritative Policy Abstention Template
        │
        └── Major Drug-Drug Interaction ────────► Controlled Formatter:
                                                  [SEVERITY] + [Drug A] + [Drug B] + [Action]
```

### Verified Preservation Invariants:
* **Numbers & Contacts**: Emergency numbers `112` and `108` are present in all Indic emergency guidance templates.
* **Drug Entity Preservation**: Drug names are protected by case-insensitive boundary preservation and never phonetically distorted.
* **Severity Invariant**: Major/Moderate severity indicators remain prominently capitalized in all target languages.

---

## 5. Future Language Expansion Strategy

The modular design allows straightforward expansion to additional Indian and global languages (e.g., Tamil `ta`, Bengali `bn`, Telugu `te`, Spanish `es`):

1. **Step 1: Register Language Code**: Add the new language to `multilingual_module/languages.py` (`SupportedLanguage` enum).
2. **Step 2: Add Script & Lexical Markers**: Update `multilingual_module/detector.py` with the script Unicode range and distinctive grammatical particles.
3. **Step 3: Extend Lexicon Dictionaries**: Add regional drug transliterations and medical concept roots to `multilingual_module/canonicalizer.py`.
4. **Step 4: Authorize Safety Templates**: Populate the new language in `multilingual_module/safety_templates.py` with certified clinician-reviewed safety phrasing and local emergency telephone numbers.
5. **Step 5: Run Multilingual Test Suite**: Run `test_multilingual.py` to verify that detection, canonicalization, and fail-closed safety behaviors hold.

---

## 6. Verification & Test Summary

The multilingual subsystem was verified using `multilingual_module/tests/test_multilingual.py`:
* **Total Tests Executed**: 16
* **Results**: **16 PASSED, 0 FAILED** (Duration: 56.94s)
* **Coverage**:
  * Language detection for Latin and Devanagari scripts
  * Marathi unique character detection (`ळ`)
  * Canonicalization with dosage and entity preservation
  * Trilingual safety template integrity and emergency number validation
  * End-to-end CDS evaluation in Hindi and Marathi
  * Adversarial prompt injection neutralization in Indic script
