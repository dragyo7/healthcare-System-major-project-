# Answer-Level Grounding Audit: Atomic Claim Decomposition

Deconstruction of 10 live generated answers into atomic clinical claims, mapped to accepted chunk IDs.

## Query 1: What are the contraindications for Metformin?
- **Grounding Decision:** `grounded` | **Generation Allowed:** `True`
- **Accepted Chunk IDs:** `['dailymed_060d40e4-b778-43d9-9596-f9478f773489_contraindications-c0', 'dailymed_060d40e4-b778-43d9-9596-f9478f773489_use_in_specific_populations-c0', 'dailymed_060d40e4-b778-43d9-9596-f9478f773489_warnings___precautions-c0']`
- **Fidelity Verdict:** **PASS**

| Atomic Clinical Claim Sentence | Support Status | Overlap Ratio | Supporting Chunks |
|---|---|---|---|
| Drug: Metformin
Section: Contraindications

Severe renal impairment (eGFR < 30 m... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_060d40e4-b778-43d9-9596-f9478f773489_contraindications-c0', 'dailymed_060d40e4-b778-43d9-9596-f9478f773489_use_in_specific_populations-c0', 'dailymed_060d40e4-b778-43d9-9596-f9478f773489_warnings___precautions-c0']` |
| 73m2), metabolic acidosis, acute or chronic DKA... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_060d40e4-b778-43d9-9596-f9478f773489_contraindications-c0', 'dailymed_060d40e4-b778-43d9-9596-f9478f773489_use_in_specific_populations-c0', 'dailymed_060d40e4-b778-43d9-9596-f9478f773489_warnings___precautions-c0']` |
| Drug: Metformin
Section: Use in Specific Populations

Renal Impairment: Contrain... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_060d40e4-b778-43d9-9596-f9478f773489_contraindications-c0', 'dailymed_060d40e4-b778-43d9-9596-f9478f773489_use_in_specific_populations-c0', 'dailymed_060d40e4-b778-43d9-9596-f9478f773489_warnings___precautions-c0']` |
| Drug: Metformin
Section: Warnings & Precautions

Lactic acidosis, iodinated cont... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_060d40e4-b778-43d9-9596-f9478f773489_contraindications-c0', 'dailymed_060d40e4-b778-43d9-9596-f9478f773489_use_in_specific_populations-c0', 'dailymed_060d40e4-b778-43d9-9596-f9478f773489_warnings___precautions-c0']` |

## Query 2: What are the boxed warnings for Lisinopril?
- **Grounding Decision:** `grounded` | **Generation Allowed:** `True`
- **Accepted Chunk IDs:** `['dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_boxed_warning-c0', 'dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_warnings___precautions-c0', 'dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_indications___usage-c0']`
- **Fidelity Verdict:** **PASS**

| Atomic Clinical Claim Sentence | Support Status | Overlap Ratio | Supporting Chunks |
|---|---|---|---|
| Drug: Lisinopril
Section: Boxed Warning

WARNING: FETAL TOXICITY... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_boxed_warning-c0', 'dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_warnings___precautions-c0', 'dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_indications___usage-c0']` |
| When pregnancy is detected, discontinue Lisinopril as soon as possible... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_boxed_warning-c0', 'dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_warnings___precautions-c0', 'dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_indications___usage-c0']` |
| Drugs that act directly on the renin-angiotensin system can cause injury and dea... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_boxed_warning-c0', 'dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_warnings___precautions-c0', 'dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_indications___usage-c0']` |
| Drug: Lisinopril
Section: Warnings & Precautions

Angioedema, anaphylaxis, hypot... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_boxed_warning-c0', 'dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_warnings___precautions-c0', 'dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_indications___usage-c0']` |

## Query 3: What is the starting dose and adverse effects of Amlodipine?
- **Grounding Decision:** `grounded` | **Generation Allowed:** `True`
- **Accepted Chunk IDs:** `['dailymed_c1f7b8a2-9382-4112-9c1e-1284a7df1930_adverse_reactions-c0', 'dailymed_6623f03b-18a8-48b6-9bb2-16a7f0521e66_dosage___administration-c0', 'dailymed_5523f03b-18a8-48b6-9bb2-16a7f0521e55_dosage___administration-c0']`
- **Fidelity Verdict:** **PASS**

| Atomic Clinical Claim Sentence | Support Status | Overlap Ratio | Supporting Chunks |
|---|---|---|---|
| Drug: Amlodipine
Section: Adverse Reactions

Peripheral edema (dose-dependent), ... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_c1f7b8a2-9382-4112-9c1e-1284a7df1930_adverse_reactions-c0', 'dailymed_6623f03b-18a8-48b6-9bb2-16a7f0521e66_dosage___administration-c0', 'dailymed_5523f03b-18a8-48b6-9bb2-16a7f0521e55_dosage___administration-c0']` |
| Drug: Empagliflozin
Section: Dosage & Administration

Recommended starting dose ... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_c1f7b8a2-9382-4112-9c1e-1284a7df1930_adverse_reactions-c0', 'dailymed_6623f03b-18a8-48b6-9bb2-16a7f0521e66_dosage___administration-c0', 'dailymed_5523f03b-18a8-48b6-9bb2-16a7f0521e55_dosage___administration-c0']` |
| eGFR < 20 mL/min: Not recommended... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_c1f7b8a2-9382-4112-9c1e-1284a7df1930_adverse_reactions-c0', 'dailymed_6623f03b-18a8-48b6-9bb2-16a7f0521e66_dosage___administration-c0', 'dailymed_5523f03b-18a8-48b6-9bb2-16a7f0521e55_dosage___administration-c0']` |
| Drug: Glimepiride
Section: Dosage & Administration

Initial starting dose is 1 m... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_c1f7b8a2-9382-4112-9c1e-1284a7df1930_adverse_reactions-c0', 'dailymed_6623f03b-18a8-48b6-9bb2-16a7f0521e66_dosage___administration-c0', 'dailymed_5523f03b-18a8-48b6-9bb2-16a7f0521e55_dosage___administration-c0']` |

## Query 4: What are the severe drug interactions of Warfarin?
- **Grounding Decision:** `grounded` | **Generation Allowed:** `True`
- **Accepted Chunk IDs:** `['dailymed_184b2c12-55d4-4a4b-8e2a-0a8870fb381b_drug_interactions-c0', 'dailymed_1123f03b-18a8-48b6-9bb2-16a7f0521e44_drug_interactions-c0', 'dailymed_9369d7b4-3677-4b68-b807-797746408226_contraindications-c0']`
- **Fidelity Verdict:** **PASS**

| Atomic Clinical Claim Sentence | Support Status | Overlap Ratio | Supporting Chunks |
|---|---|---|---|
| Drug: Aspirin
Section: Drug Interactions

Anticoagulants (warfarin, heparin, api... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_184b2c12-55d4-4a4b-8e2a-0a8870fb381b_drug_interactions-c0', 'dailymed_1123f03b-18a8-48b6-9bb2-16a7f0521e44_drug_interactions-c0', 'dailymed_9369d7b4-3677-4b68-b807-797746408226_contraindications-c0']` |
| NSAIDs (ibuprofen): Interferes with antiplatelet action and increases GI toxicit... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_184b2c12-55d4-4a4b-8e2a-0a8870fb381b_drug_interactions-c0', 'dailymed_1123f03b-18a8-48b6-9bb2-16a7f0521e44_drug_interactions-c0', 'dailymed_9369d7b4-3677-4b68-b807-797746408226_contraindications-c0']` |
| Methotrexate: Severe toxicity... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_184b2c12-55d4-4a4b-8e2a-0a8870fb381b_drug_interactions-c0', 'dailymed_1123f03b-18a8-48b6-9bb2-16a7f0521e44_drug_interactions-c0', 'dailymed_9369d7b4-3677-4b68-b807-797746408226_contraindications-c0']` |
| Drug: Doxycycline
Section: Drug Interactions

Antacids (aluminum, calcium, magne... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_184b2c12-55d4-4a4b-8e2a-0a8870fb381b_drug_interactions-c0', 'dailymed_1123f03b-18a8-48b6-9bb2-16a7f0521e44_drug_interactions-c0', 'dailymed_9369d7b4-3677-4b68-b807-797746408226_contraindications-c0']` |

## Query 5: What are the liver and muscle toxicity warnings for Atorvastatin?
- **Grounding Decision:** `grounded` | **Generation Allowed:** `True`
- **Accepted Chunk IDs:** `['dailymed_7823f03b-18a8-48b6-9bb2-16a7f0521e29_warnings___precautions-c0', 'dailymed_7823f03b-18a8-48b6-9bb2-16a7f0521e29_contraindications-c0', 'dailymed_7823f03b-18a8-48b6-9bb2-16a7f0521e29_indications___usage-c0']`
- **Fidelity Verdict:** **PASS**

| Atomic Clinical Claim Sentence | Support Status | Overlap Ratio | Supporting Chunks |
|---|---|---|---|
| Drug: Atorvastatin
Section: Warnings & Precautions

Myopathy and rhabdomyolysis ... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_7823f03b-18a8-48b6-9bb2-16a7f0521e29_warnings___precautions-c0', 'dailymed_7823f03b-18a8-48b6-9bb2-16a7f0521e29_contraindications-c0', 'dailymed_7823f03b-18a8-48b6-9bb2-16a7f0521e29_indications___usage-c0']` |
| Drug: Atorvastatin
Section: Contraindications

Active liver disease, unexplained... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_7823f03b-18a8-48b6-9bb2-16a7f0521e29_warnings___precautions-c0', 'dailymed_7823f03b-18a8-48b6-9bb2-16a7f0521e29_contraindications-c0', 'dailymed_7823f03b-18a8-48b6-9bb2-16a7f0521e29_indications___usage-c0']` |
| Drug: Atorvastatin
Section: Indications & Usage

Adjunct to diet for primary hyp... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_7823f03b-18a8-48b6-9bb2-16a7f0521e29_warnings___precautions-c0', 'dailymed_7823f03b-18a8-48b6-9bb2-16a7f0521e29_contraindications-c0', 'dailymed_7823f03b-18a8-48b6-9bb2-16a7f0521e29_indications___usage-c0']` |

## Query 6: What are the ICMR treatment recommendations for pneumonia?
- **Grounding Decision:** `grounded` | **Generation Allowed:** `True`
- **Accepted Chunk IDs:** `['icmr_icmr_antimicrobial_2022_respiratory_infections-c0', 'mplus_community_acquired_pneumonia_treatment-c0', 'icmr_icmr_antimicrobial_2022_antimicrobial_stewardship_principles-c0']`
- **Fidelity Verdict:** **PASS**

| Atomic Clinical Claim Sentence | Support Status | Overlap Ratio | Supporting Chunks |
|---|---|---|---|
| ICMR Clinical Guideline: ICMR National Treatment Guidelines for Antimicrobial Us... | `DIRECTLY_SUPPORTED` | 1.0 | `['icmr_icmr_antimicrobial_2022_respiratory_infections-c0', 'mplus_community_acquired_pneumonia_treatment-c0', 'icmr_icmr_antimicrobial_2022_antimicrobial_stewardship_principles-c0']` |
| Alternative: Oral Doxycycline 100 mg twice daily... | `DIRECTLY_SUPPORTED` | 1.0 | `['icmr_icmr_antimicrobial_2022_respiratory_infections-c0', 'mplus_community_acquired_pneumonia_treatment-c0', 'icmr_icmr_antimicrobial_2022_antimicrobial_stewardship_principles-c0']` |
| Outpatient with comorbidities (COPD, diabetes, renal disease): Oral Amoxicillin-... | `DIRECTLY_SUPPORTED` | 1.0 | `['icmr_icmr_antimicrobial_2022_respiratory_infections-c0', 'mplus_community_acquired_pneumonia_treatment-c0', 'icmr_icmr_antimicrobial_2022_antimicrobial_stewardship_principles-c0']` |
| Hospitalized Inpatient (Non-ICU, CURB-65 >= 2): Intravenous Ceftriaxone (1-2 g I... | `DIRECTLY_SUPPORTED` | 1.0 | `['icmr_icmr_antimicrobial_2022_respiratory_infections-c0', 'mplus_community_acquired_pneumonia_treatment-c0', 'icmr_icmr_antimicrobial_2022_antimicrobial_stewardship_principles-c0']` |

## Query 7: What is the boxed warning for Ciprofloxacin regarding tendon rupture?
- **Grounding Decision:** `grounded` | **Generation Allowed:** `True`
- **Accepted Chunk IDs:** `['dailymed_9923f03b-18a8-48b6-9bb2-16a7f0521e33_boxed_warning-c0', 'dailymed_9923f03b-18a8-48b6-9bb2-16a7f0521e33_warnings___precautions-c0', 'dailymed_553c5d67-5511-477a-a43b-748956eb0155_boxed_warning-c0']`
- **Fidelity Verdict:** **PASS**

| Atomic Clinical Claim Sentence | Support Status | Overlap Ratio | Supporting Chunks |
|---|---|---|---|
| Drug: Ciprofloxacin
Section: Boxed Warning

WARNING: SERIOUS ADVERSE REACTIONS I... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_9923f03b-18a8-48b6-9bb2-16a7f0521e33_boxed_warning-c0', 'dailymed_9923f03b-18a8-48b6-9bb2-16a7f0521e33_warnings___precautions-c0', 'dailymed_553c5d67-5511-477a-a43b-748956eb0155_boxed_warning-c0']` |
| Fluoroquinolones are associated with disabling and potentially irreversible seri... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_9923f03b-18a8-48b6-9bb2-16a7f0521e33_boxed_warning-c0', 'dailymed_9923f03b-18a8-48b6-9bb2-16a7f0521e33_warnings___precautions-c0', 'dailymed_553c5d67-5511-477a-a43b-748956eb0155_boxed_warning-c0']` |
| Drug: Ciprofloxacin
Section: Warnings & Precautions

Tendon rupture (Achilles), ... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_9923f03b-18a8-48b6-9bb2-16a7f0521e33_boxed_warning-c0', 'dailymed_9923f03b-18a8-48b6-9bb2-16a7f0521e33_warnings___precautions-c0', 'dailymed_553c5d67-5511-477a-a43b-748956eb0155_boxed_warning-c0']` |
| Drug: Telmisartan
Section: Boxed Warning

WARNING: FETAL TOXICITY... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_9923f03b-18a8-48b6-9bb2-16a7f0521e33_boxed_warning-c0', 'dailymed_9923f03b-18a8-48b6-9bb2-16a7f0521e33_warnings___precautions-c0', 'dailymed_553c5d67-5511-477a-a43b-748956eb0155_boxed_warning-c0']` |

## Query 8: Can Clopidogrel be safely combined with Omeprazole?
- **Grounding Decision:** `grounded` | **Generation Allowed:** `True`
- **Accepted Chunk IDs:** `['dailymed_3323f03b-18a8-48b6-9bb2-16a7f0521e33_drug_interactions-c0', 'dailymed_3323f03b-18a8-48b6-9bb2-16a7f0521e33_adverse_reactions-c0', 'rxnorm_7646-c0']`
- **Fidelity Verdict:** **PASS**

| Atomic Clinical Claim Sentence | Support Status | Overlap Ratio | Supporting Chunks |
|---|---|---|---|
| Drug: Clopidogrel
Section: Drug Interactions

CYP2C19 Inhibitors (omeprazole, es... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_3323f03b-18a8-48b6-9bb2-16a7f0521e33_drug_interactions-c0', 'dailymed_3323f03b-18a8-48b6-9bb2-16a7f0521e33_adverse_reactions-c0', 'rxnorm_7646-c0']` |
| Anticoagulants (warfarin, apixaban) / NSAIDs: Increased major bleeding risk... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_3323f03b-18a8-48b6-9bb2-16a7f0521e33_drug_interactions-c0', 'dailymed_3323f03b-18a8-48b6-9bb2-16a7f0521e33_adverse_reactions-c0', 'rxnorm_7646-c0']` |
| Drug: Clopidogrel
Section: Adverse Reactions

Bleeding, purpura, bruising, epist... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_3323f03b-18a8-48b6-9bb2-16a7f0521e33_drug_interactions-c0', 'dailymed_3323f03b-18a8-48b6-9bb2-16a7f0521e33_adverse_reactions-c0', 'rxnorm_7646-c0']` |
| Medication Concept: Omeprazole Delayed-Release Capsule
RxCUI: 7646
Active Ingred... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_3323f03b-18a8-48b6-9bb2-16a7f0521e33_drug_interactions-c0', 'dailymed_3323f03b-18a8-48b6-9bb2-16a7f0521e33_adverse_reactions-c0', 'rxnorm_7646-c0']` |

## Query 9: What are the pregnancy warnings for Losartan?
- **Grounding Decision:** `grounded` | **Generation Allowed:** `True`
- **Accepted Chunk IDs:** `['dailymed_893c5d67-5511-477a-a43b-748956eb012a_boxed_warning-c0', 'dailymed_893c5d67-5511-477a-a43b-748956eb012a_warnings___precautions-c0', 'dailymed_893c5d67-5511-477a-a43b-748956eb012a_use_in_specific_populations-c0']`
- **Fidelity Verdict:** **PASS**

| Atomic Clinical Claim Sentence | Support Status | Overlap Ratio | Supporting Chunks |
|---|---|---|---|
| Drug: Losartan
Section: Boxed Warning

WARNING: FETAL TOXICITY... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_893c5d67-5511-477a-a43b-748956eb012a_boxed_warning-c0', 'dailymed_893c5d67-5511-477a-a43b-748956eb012a_warnings___precautions-c0', 'dailymed_893c5d67-5511-477a-a43b-748956eb012a_use_in_specific_populations-c0']` |
| Discontinue Losartan immediately when pregnancy is detected... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_893c5d67-5511-477a-a43b-748956eb012a_boxed_warning-c0', 'dailymed_893c5d67-5511-477a-a43b-748956eb012a_warnings___precautions-c0', 'dailymed_893c5d67-5511-477a-a43b-748956eb012a_use_in_specific_populations-c0']` |
| Renin-angiotensin blockers cause fetal injury, oligohydramnios, and death... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_893c5d67-5511-477a-a43b-748956eb012a_boxed_warning-c0', 'dailymed_893c5d67-5511-477a-a43b-748956eb012a_warnings___precautions-c0', 'dailymed_893c5d67-5511-477a-a43b-748956eb012a_use_in_specific_populations-c0']` |
| Drug: Losartan
Section: Warnings & Precautions

Fetal toxicity, hypotension in v... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_893c5d67-5511-477a-a43b-748956eb012a_boxed_warning-c0', 'dailymed_893c5d67-5511-477a-a43b-748956eb012a_warnings___precautions-c0', 'dailymed_893c5d67-5511-477a-a43b-748956eb012a_use_in_specific_populations-c0']` |

## Query 10: What are the clinical signs of Digoxin toxicity?
- **Grounding Decision:** `grounded` | **Generation Allowed:** `True`
- **Accepted Chunk IDs:** `['dailymed_2223f03b-18a8-48b6-9bb2-16a7f0521e22_drug_interactions-c0', 'dailymed_553c5d67-5511-477a-a43b-748956eb0155_drug_interactions-c0', 'dailymed_7723f03b-18a8-48b6-9bb2-16a7f0521e77_drug_interactions-c0']`
- **Fidelity Verdict:** **PASS**

| Atomic Clinical Claim Sentence | Support Status | Overlap Ratio | Supporting Chunks |
|---|---|---|---|
| Drug: Furosemide
Section: Drug Interactions

Aminoglycosides (gentamicin, amikac... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_2223f03b-18a8-48b6-9bb2-16a7f0521e22_drug_interactions-c0', 'dailymed_553c5d67-5511-477a-a43b-748956eb0155_drug_interactions-c0', 'dailymed_7723f03b-18a8-48b6-9bb2-16a7f0521e77_drug_interactions-c0']` |
| Digoxin: Hypokalemia potentiates digitalis arrhythmias... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_2223f03b-18a8-48b6-9bb2-16a7f0521e22_drug_interactions-c0', 'dailymed_553c5d67-5511-477a-a43b-748956eb0155_drug_interactions-c0', 'dailymed_7723f03b-18a8-48b6-9bb2-16a7f0521e77_drug_interactions-c0']` |
| Lithium: Toxicity... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_2223f03b-18a8-48b6-9bb2-16a7f0521e22_drug_interactions-c0', 'dailymed_553c5d67-5511-477a-a43b-748956eb0155_drug_interactions-c0', 'dailymed_7723f03b-18a8-48b6-9bb2-16a7f0521e77_drug_interactions-c0']` |
| NSAIDs: Antagonize diuretic effect... | `DIRECTLY_SUPPORTED` | 1.0 | `['dailymed_2223f03b-18a8-48b6-9bb2-16a7f0521e22_drug_interactions-c0', 'dailymed_553c5d67-5511-477a-a43b-748956eb0155_drug_interactions-c0', 'dailymed_7723f03b-18a8-48b6-9bb2-16a7f0521e77_drug_interactions-c0']` |
