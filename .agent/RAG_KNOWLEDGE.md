# HEALTHCARE KNOWLEDGE BASE, COVERAGE & PROVENANCE SPECIFICATION

## 1. Active Knowledge Sources & Ingestion Inventory

The RAG platform ingests verified medical knowledge across multiple public, authoritative sources through specialized ingestion adapters.

| Source ID | Source Name | Authoritative Publisher | Validation Status | Ingested Docs | Ingested Chunks | Clinical Domains Covered |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`DailyMed`** | National Library of Medicine DailyMed | U.S. National Library of Medicine / FDA | **REAL DATA VALIDATED** | **159** | **159** | Pharmacology, Boxed Warnings, Dosing, Interactions, Adverse Effects |
| **`medquad_nih`** | MedQuAD Composite NIH Knowledge Base | U.S. National Institutes of Health (NIH) | **REAL DATA VALIDATED** | **16,406** | **23,549** | General Medicine, Disease Overviews, Diagnostic Symptoms, Anatomy |
| **`openFDA`** | FDA Drug Product Labeling API | U.S. Food and Drug Administration | **STRUCTURED FIXTURE VALIDATED** | 19 (Fixture) | 19 (Fixture) | Pharmacological classes, NDC codes, indications |
| **`guidelines_aha_ada`** | Clinical Practice Guidelines | American Heart Association / ADA | **STRUCTURED FIXTURE VALIDATED** | 5 (Fixture) | 5 (Fixture) | Cardiology, Endocrinology guidelines |
| **Total Ingested (Active Corpus)** | — | — | — | **16,565** | **23,708** | — |

---

## 2. In-Depth Source Profiles

### 2.1 DailyMed FDA Drug Monographs (`DailyMed`)
* **Role**: Primary source for authentic prescription drug monographs, official FDA black-box warnings, contraindications, dosage limits, and drug-drug interactions.
* **Pilot Corpus Scope**: 25 high-volume outpatient medications across major therapeutic classes (Lisinopril, Metformin, Atorvastatin, Amoxicillin, Levothyroxine, Sertraline, Tramadol, Ciprofloxacin, Warfarin, etc.).
* **Section Extraction Coverage**: 100% coverage across 6 essential clinical sections:
  1. *Indications & Usage* (25/25 drugs)
  2. *Dosage & Administration* (25/25 drugs)
  3. *Contraindications* (25/25 drugs)
  4. *Warnings & Precautions* (25/25 drugs)
  5. *Adverse Reactions* (25/25 drugs)
  6. *Drug Interactions* (25/25 drugs)
  7. *Boxed Warnings* (9/9 high-risk drugs with FDA black-box warnings)

#### Chunking Distribution & Measurement Reconciliation
* **Raw Clinical Body Text**: Mean = $43.73 \text{ words}$, Median = $43.00 \text{ words}$, Min = $10 \text{ words}$, Max = $121 \text{ words}$.
* **Passage-Formatted Chunk Text**: Mean $\approx 112 \text{ words}$ (including `Drug: ...\nSection: ...\n\n...` contextual framing).
* **Fragmentation Status**: Zero sections exceeded the 250-word chunk threshold; every section was preserved as an intact, atomic chunk.

### 2.2 MedQuAD Composite NIH Knowledge Base (`medquad_nih`)
* **Role**: Broad general medical knowledge corpus covering clinical conditions, diagnostic testing, surgical procedures, and anatomical overviews.
* **Institutes Included**: NIDDK, NINDS, NHLBI, NIAMS, Genetics Home Reference, Cancer.gov, CDC.
* **Ingestion Breakdown**:
  * Total Raw XML Records: 47,457
  * Excluded Records (Copyrighted / Redundant Cancer.gov articles): 31,051
  * Valid Clean Records Ingested: 16,406
  * Semantic Chunks Generated: 23,549 (Mean word count = 114.2 words)
* **Pharmacology Limitation**: MedQuAD explicitly excluded NLM drug monographs during its original curation; hence MedQuAD alone cannot support prescription safety queries.

---

## 3. Source Adapter Implementation Status

```
BaseSourceAdapter (Abstract Contract)
 ├── DailyMedAdapter      [REAL DATA VALIDATED]   --> 25 Authentic FDA XML Labels
 ├── MedQuADAdapter       [REAL DATA VALIDATED]   --> 16,406 NIH Clean Records
 ├── OpenFDAAdapter       [STRUCTURED FIXTURE]    --> Standardized JSON Fixtures
 └── GuidelineAdapter     [STRUCTURED FIXTURE]    --> Clinical Guideline Fixtures
```

---

## 4. Clinical Knowledge Gap Analysis

| Clinical Knowledge Domain | Status in Baseline (V2.0) | Status in Pilot (V2.5.1) | Target State (V2.6+) | Required Expansion Source |
| :--- | :--- | :--- | :--- | :--- |
| **Prescription Monographs** | Missing (0%) | 25 Drugs (12.5% of Top-200) | Top-200 Drugs (100%) | DailyMed Bulk Ingestion |
| **Boxed Warnings** | Missing | 9 High-Risk Drugs | All Top-200 Boxed Warnings | DailyMed SPL XML |
| **Drug Interactions** | Unstructured / Incomplete | Verified for 25 Drugs | Comprehensive Top-200 Matrix | DailyMed + openFDA API |
| **Dosage & Titration Tables** | Missing | Ingested for 25 Drugs | Structured Tabular Dosing | DailyMed Section 2 Parsing |
| **Pediatric / Renal Adjustments**| Incomplete | Partial (25 Drugs) | Structured Renal/Hepatic Dosing | DailyMed Special Populations |
| **Clinical Practice Guidelines** | Missing | Fixture Tested | AHA, ADA, ACC Full Guidelines | Society Guideline PDFs |
| **Biomedical Research Papers** | Missing | Not Ingested | Targeted PubMed Abstracts | PubMed Central API |
| **Multilingual Medical Knowledge**| Missing | English Only | Multilingual Cross-Lingual RAG | WHO Multi-Language Corpus |

---

## 5. Roadmap for Knowledge Base Scaling

1. **V2.6 Milestone**: Scale `DailyMedAdapter` from 25 pilot medications to the **Top-200 most prescribed US outpatient drugs** ($\sim 1,400$ section documents / chunks).
2. **V2.7 Milestone**: Ingest structured clinical guidelines (AHA Hypertension, ADA Diabetes, GOLD COPD) via `GuidelineAdapter`.
3. **V3.0 Milestone**: Ingest open-access PubMed clinical trial reviews and WHO international treatment guidelines.
