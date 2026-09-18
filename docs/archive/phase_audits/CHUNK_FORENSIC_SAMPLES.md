# Chunk Content Forensics & Clinical Integrity Samples

Detailed inspection of representative chunks in `meta_v2.json` / `index_v2.bin` ($N=236$).

| Index | Chunk ID | Source | Section | Drug / Entity | Dosage/Units | Contraindication | Renal/Pregnancy | Clinical Verdict |
|---|---|---|---|---|---|---|---|---|
| 0 | `dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_indications___usage-c0` | DailyMed | `Indications & Usage` | **N/A** | YES | NO | NO | `COMPLETE_AND_COHERENT` |
| 5 | `dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_drug_interactions-c0` | DailyMed | `Drug Interactions` | **N/A** | YES | NO | YES | `COMPLETE_AND_COHERENT` |
| 10 | `dailymed_c1f7b8a2-9382-4112-9c1e-1284a7df1930_contraindications-c0` | DailyMed | `Contraindications` | **N/A** | YES | YES | NO | `COMPLETE_AND_COHERENT` |
| 25 | `dailymed_553c5d67-5511-477a-a43b-748956eb0155_contraindications-c0` | DailyMed | `Contraindications` | **N/A** | YES | YES | NO | `COMPLETE_AND_COHERENT` |
| 50 | `dailymed_9923f03b-18a8-48b6-9bb2-16a7f0521e99_drug_interactions-c0` | DailyMed | `Drug Interactions` | **N/A** | YES | NO | NO | `COMPLETE_AND_COHERENT` |
| 100 | `dailymed_5523f03b-18a8-48b6-9bb2-16a7f0521e55_indications___usage-c0` | DailyMed | `Indications & Usage` | **N/A** | YES | NO | NO | `COMPLETE_AND_COHERENT` |
| 150 | `dailymed_1123f03b-18a8-48b6-9bb2-16a7f0521e44_indications___usage-c0` | DailyMed | `Indications & Usage` | **N/A** | YES | NO | NO | `COMPLETE_AND_COHERENT` |
| 190 | `mplus_type2_diabetes_diagnosis-c0` | MedlinePlus | `Diagnosis` | **N/A** | YES | NO | NO | `COMPLETE_AND_COHERENT` |
| 210 | `icmr_icmr_hypertension_2020_hypertension_definition-c0` | ICMR | `Diagnosis and Screening Protocol in Indian Primary Care` | **N/A** | YES | NO | NO | `COMPLETE_AND_COHERENT` |
| 230 | `rxnorm_6918-c0` | RxNorm | `Clinical Concept Summary` | **N/A** | YES | NO | NO | `COMPLETE_AND_COHERENT` |

## Forensic Text Excerpts

### Chunk: `dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_indications___usage-c0` (DailyMed - Indications & Usage)
**Drug Entity:** N/A
**Text Content:**
> Drug: Lisinopril
Section: Indications & Usage

Lisinopril is indicated for the treatment of hypertension in adults and children >= 6 years; adjunct therapy in heart failure; acute myocardial infarction within 24 hours.

### Chunk: `dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_drug_interactions-c0` (DailyMed - Drug Interactions)
**Drug Entity:** N/A
**Text Content:**
> Drug: Lisinopril
Section: Drug Interactions

Diuretics: Additive hypotension. Potassium-sparing diuretics/potassium supplements: Hyperkalemia risk. NSAIDs: Renal dysfunction and reduced antihypertensive effect. Lithium: Toxicity.

### Chunk: `dailymed_c1f7b8a2-9382-4112-9c1e-1284a7df1930_contraindications-c0` (DailyMed - Contraindications)
**Drug Entity:** N/A
**Text Content:**
> Drug: Amlodipine
Section: Contraindications

Hypersensitivity to amlodipine.

### Chunk: `dailymed_553c5d67-5511-477a-a43b-748956eb0155_contraindications-c0` (DailyMed - Contraindications)
**Drug Entity:** N/A
**Text Content:**
> Drug: Telmisartan
Section: Contraindications

Hypersensitivity; concomitant aliskiren in diabetes.

### Chunk: `dailymed_9923f03b-18a8-48b6-9bb2-16a7f0521e99_drug_interactions-c0` (DailyMed - Drug Interactions)
**Drug Entity:** N/A
**Text Content:**
> Drug: Metoprolol Succinate
Section: Drug Interactions

CYP2D6 inhibitors (fluoxetine, paroxetine, diphenhydramine): Increase metoprolol levels. Calcium channel blockers (verapamil, diltiazem): Additive bradycardia and AV block. Digoxin.
