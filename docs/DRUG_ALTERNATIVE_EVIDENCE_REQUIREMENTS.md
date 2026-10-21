# Evidence-Backed Drug Alternative Engine & Dataset Requirements

> **Module**: Drug Safety & Candidate Alternative Engine
> **Status**: Verified Deterministic Engine (`DEC-014`)
> **Source Baseline**: DailyMed Structured Product Labeling (SPL)
> **Date**: October 2026

---

## 1. Clinical Principles & Non-Negotiable Invariants

1. **Zero Free-Form LLM Hallucinations**:
   - The system NEVER prompts a large language model to invent or guess alternative medications.
   - All candidate recommendations originate from verified clinical product labeling guidelines.

2. **Indication & Therapeutic Intent Preservation**:
   - Every candidate alternative preserves the intended therapeutic class and goal:
     - Analgesia / Antipyresis: `Paracetamol` replaces `Ibuprofen` / `NSAIDs`.
     - Antimicrobial: `Azithromycin` replaces `Clarithromycin` in macrolide-statin co-prescriptions.
     - Gastroprotection: `Pantoprazole` or `Famotidine` replaces `Omeprazole` in CYP2C19-clopidogrel co-prescriptions.

3. **Multi-Constraint Safety Re-Screening**:
   - Every candidate is screened against:
     - **Patient Allergies**: If the patient is allergic to the candidate moiety (e.g. Paracetamol allergy), the candidate is completely suppressed.
     - **Concurrent Active Medications**: If the candidate would trigger a secondary interaction with another concurrent medication, it is disqualified.
     - **Other Proposed Medications**: Evaluated against the entire proposed regimen.

4. **Clinician Authorization Invariant**:
   - Alternatives are NEVER automatically prescribed, substituted, or saved to the database.
   - The clinician must explicitly inspect the candidate card, click **Apply Alternative**, review the adjusted prescription, and sign off.

---

## 2. Currently Verified DailyMed Rules & Alternative Mappings

The interaction engine incorporates 8 verified DailyMed interaction rules (`RUL-INT-001` through `RUL-INT-008`). Of these, 4 rules have verified candidate alternative medication suggestions in `data/rules/medication_interactions/candidate_alternatives.json`:

| Rule ID | Interacting Pair | Target Drug | Candidate Alternative | Evidence Strength | Therapeutic Intent | Source Citation & Rationale |
|---|---|---|---|---|---|---|
| `RUL-INT-001` | Aspirin + Warfarin | Aspirin | Paracetamol | `CLINICAL_CONSENSUS_INFERRED` | Analgesia & Antipyresis | DailyMed Warfarin Sodium Label (SetID `9369d7b4-3677-4b68-b807-797746408226`, Section 7.2): Avoid concomitant NSAID/salicylate use. Non-NSAID analgesic inferred for mild pain/fever; does not substitute for antiplatelet indications. |
| `RUL-INT-002` | Ibuprofen + Warfarin | Ibuprofen | Paracetamol | `CLINICAL_CONSENSUS_INFERRED` | Analgesia & Antipyresis | DailyMed Ibuprofen Label (SetID `7823f03b-18a8-48b6-9bb2-16a7f0521e33`, Section 7): Avoid NSAIDs in anticoagulated patients. Non-NSAID analgesic inferred for pain; lacks anti-inflammatory efficacy. |
| `RUL-INT-007` | Clarithromycin + Atorvastatin | Clarithromycin | Azithromycin | `CLINICAL_CONSENSUS_INFERRED` | Alternative Macrolide Antibacterial | DailyMed Atorvastatin Label (SetID `7823f03b-18a8-48b6-9bb2-16a7f0521e29`, Section 7.1): Clarithromycin strongly inhibits CYP3A4. Azithromycin does not inhibit CYP3A4, but has different coverage (not for *H. pylori*). |
| `RUL-INT-008` | Omeprazole + Clopidogrel | Omeprazole | Pantoprazole, Famotidine | `FDA_LABEL_EXPLICIT_MENTION` | Gastroprotection (PPI / H2RA) | DailyMed Clopidogrel Label (SetID `3323f03b-18a8-48b6-9bb2-16a7f0521e33`, Section 7.1): Explicitly names pantoprazole and famotidine as alternatives not significantly blunting clopidogrel antiplatelet activity. |

### Rules Without Automated Drug Alternatives (Status: `INSUFFICIENT_LOCAL_EVIDENCE`)
The remaining rules in the verified dataset do not provide automated candidate medication substitutes because doing so would risk clinical misdirection:
- `RUL-INT-003` (**Lisinopril + Ibuprofen** - Moderate): ACE inhibitor blunting and hyperkalemia risk. Management requires blood pressure and renal function monitoring, hydration, or clinician-selected non-NSAID analgesia depending on indication. No automated substitution is generated (`[]`).
- `RUL-INT-004` (**Amoxicillin + Methotrexate** - Major): Reduced renal clearance of methotrexate. Requires avoiding combination or hematological monitoring. No automated drug substitute.
- `RUL-INT-005` (**Metformin + Alcohol** - Major): Risk of life-threatening lactic acidosis. Management is lifestyle counseling / alcohol cessation, not a replacement drug.
- `RUL-INT-006` (**Paracetamol + Alcohol** - Major): Glutathione depletion and severe hepatotoxicity. Management is dose limitation or alcohol cessation, not a replacement drug.

*(Note: "Lisinopril + Potassium Chloride" is a conversational RAG CDS assistant clinical query example in `frontend/src/pages/Doctor/CDS.jsx`, not a rule ID in the interaction engine.)*

---

## 3. Dataset Requirements for Expanding Alternative Coverage

To expand the alternative medication suggestion engine beyond the initial verified DailyMed rules to a general hospital formulary, the following clinical datasets are requested:

### A. Hospital Formulary & Indication Mapping
- **Intended Path**: `data/rules/clinical_formulary_indications.json`
- **Format**: JSON Array
- **Required Fields**:
  ```json
  [
    {
      "generic_name": "amlodipine",
      "brand_aliases": ["Norvasc", "Amlod", "Amlovas"],
      "atc_code": "C08CA01",
      "therapeutic_class": "Calcium Channel Blocker (Dihydropyridine)",
      "primary_indications": ["hypertension", "angina"],
      "verified_formulary_alternatives": [
        {
          "alternative_drug": "felodipine",
          "atc_code": "C08CA02",
          "indication": "hypertension",
          "line_of_therapy": "first-line",
          "provenance": "WHO Model List of Essential Medicines 2023"
        }
      ]
    }
  ]
  ```

### B. Comprehensive Drug-Drug Interaction Rules (RxNorm / DailyMed SPL)
- **Intended Path**: `data/rules/medication_interactions/expanded_ddi_rules.json`
- **Required Fields**:
  ```json
  [
    {
      "rule_id": "RUL-INT-XXX",
      "drug_pair": ["drug_a", "drug_b"],
      "severity": "major",
      "mechanism": "CYP3A4 competitive inhibition",
      "clinical_management": "Avoid co-administration or reduce dosage",
      "evidence_level": "FDA Label / SPL Section 7",
      "suggested_substitutions": [
        {
          "substitute_for": "drug_a",
          "recommended_candidates": ["drug_c"],
          "evidence_citation": "DailyMed SPL SetID ..."
        }
      ]
    }
  ]
  ```

### C. Multi-Ingredient Combination Product Table
- **Intended Path**: `data/rules/combination_products.json`
- **Required Fields**:
  - `brand_name`: String
  - `active_ingredients`: Array of strings
  - `strengths`: Array of strings (e.g. `["400mg", "325mg"]`)
  - `dosage_form`: String (`tablet`, `syrup`, `injection`)
  - `ndc_or_rxnorm_id`: String
