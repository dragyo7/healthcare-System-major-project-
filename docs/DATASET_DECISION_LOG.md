# Dataset & Knowledge Base Decision Log

This document records all architectural, provenance, licensing, and clinical scope decisions regarding knowledge sources evaluated for the Healthcare Clinical Decision Support System (CDS-RAG).

---

## Decision Summary Matrix

| Decision ID | Knowledge Source | Publisher / Owner | Role in CDS | Decision | Audit Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DS-001** | DailyMed FDA Structured Product Labels (SPL) | U.S. National Library of Medicine / FDA | Primary Medication Evidence | **ACCEPT** | VERIFIED |
| **DS-002** | MedlinePlus Health Topics & Genetics | NLM / National Institutes of Health | General Clinical & Consumer Reference | **ACCEPT** | VERIFIED |
| **DS-003** | ICMR Clinical Practice Guidelines | Indian Council of Medical Research | Indian Clinical Practice Evidence | **ACCEPT** | VERIFIED |
| **DS-004** | MoHFW Standard Treatment Guidelines (STG) | Ministry of Health & Family Welfare, India | Indian Primary & Secondary Care Guidance | **ACCEPT** | VERIFIED |
| **DS-005** | RxNorm Prescribable Content | U.S. National Library of Medicine | Structured Terminology & Normalization | **ACCEPT** | VERIFIED |
| **DS-006** | openFDA Drug Label & Event API | U.S. Food & Drug Administration | Regulatory API Evidence (Non-causal) | **ACCEPT** | VERIFIED |
| **DS-007** | MedQuAD Composite NIH Knowledge Base | 9 NIH Institutes (NCI, GARD, NIDDK, etc.) | Comprehensive Pathology & Rare Disease | **ACCEPT** | VERIFIED (HISTORICAL) |
| **DS-008** | Legacy 8-Row `drugbank.csv` | Unknown / Hand-authored sample | Medication Interactions | **REJECT** | UNVERIFIED / DEPRECATED |
| **DS-009** | Legacy 18-Row `sider.csv` | Unknown / Hand-authored sample | Drug Side Effects | **REJECT** | UNVERIFIED / DEPRECATED |
| **DS-010** | MIMIC-IV / PhysioNet Restricted EHRs | PhysioNet / MIT-LCP | Inpatient Clinical Trajectories | **DEFER** | RESTRICTED LICENSE |
| **DS-011** | Full PubMed / PMC XML Dump | NCBI / NLM | Unrestricted Biomedical Literature | **DEFER** | OUT OF BOUNDED SCOPE |
| **DS-012** | Multimodal Medical Imaging Datasets (X-Ray/CT) | Various (NIH ChestX-ray14, CheXpert, etc.) | Imaging Diagnostic RAG | **DEFER** | OUT OF SCOPE (SEE P2) |
| **DS-013** | Random Web-Scraped Health Blogs / Kaggle CSVs | Anonymous / Unverified Web | General Medical Advice | **REJECT** | UNVERIFIED PROVENANCE |

---

## Detailed Source Evaluations

### DS-001: DailyMed / FDA Structured Product Labeling (SPL)
* **Official Publisher**: National Library of Medicine (NLM) in collaboration with FDA.
* **Official URL**: `https://dailymed.nlm.nih.gov` / `https://labels.fda.gov`
* **Evidence Role**: Primary regulatory drug monograph evidence (indications, dosages, contraindications, boxed warnings, drug interactions, adverse reactions).
* **Access / License**: U.S. Government Public Domain / Open Data.
* **Scope**: Bounded set of 50–100 essential cardiovascular, endocrine, antimicrobial, analgesic, and central nervous system medicines.
* **Decision**: **ACCEPT**. Essential for authentic medication safety and prescribing evidence.

### DS-002: MedlinePlus Health Topics & Genetics
* **Official Publisher**: National Library of Medicine (NLM), NIH.
* **Official URL**: `https://medlineplus.gov`
* **Evidence Role**: General medical reference, disease overviews, symptoms, patient education.
* **Access / License**: U.S. Government Public Domain.
* **Scope**: Validated health topics spanning major chronic and acute conditions.
* **Decision**: **ACCEPT**. High-authority, clean, patient-grounded evidence.

### DS-003: ICMR Clinical Practice Guidelines
* **Official Publisher**: Indian Council of Medical Research (ICMR), Department of Health Research, Ministry of Health and Family Welfare, Government of India.
* **Official URL**: `https://main.icmr.nic.in`
* **Evidence Role**: India-specific clinical guidelines, diagnostic thresholds, and national treatment protocols.
* **Access / License**: Government of India Open Access / Public Health Guidance.
* **Scope**: Bounded clinical guidelines covering Type 2 Diabetes, Hypertension, Antimicrobial Stewardship, and Priority Communicable Diseases.
* **Decision**: **ACCEPT**. Provides indispensable national context for Indian healthcare practice.

### DS-004: MoHFW Standard Treatment Guidelines (STG)
* **Official Publisher**: Ministry of Health and Family Welfare (MoHFW) / National Health Mission (NHM), Government of India.
* **Official URL**: `https://clinicalestablishments.gov.in` / `https://mohfw.gov.in`
* **Evidence Role**: India-specific standard treatment guidelines for primary, secondary, and tertiary care facilities.
* **Access / License**: Government of India Public Document.
* **Scope**: STGs for Hypertension, Diabetes Mellitus, Respiratory Infections, and Common Inpatient Emergencies.
* **Decision**: **ACCEPT**. Highly structured, page-referenced clinical guidance.

### DS-005: RxNorm Prescribable Content
* **Official Publisher**: National Library of Medicine (NLM).
* **Official URL**: `https://www.nlm.nih.gov/research/umls/rxnorm/`
* **Evidence Role**: Structured terminology and entity normalization (RxCUI, canonical generic ingredients, brand aliases, dosage forms, strengths).
* **Access / License**: Open Access / UMLS Metathesaurus Open Terms (Prescribable subset freely distributable).
* **Role Note**: Stored as structured relational lookup dictionaries, **not** vectorized as unstructured free-text passages.
* **Decision**: **ACCEPT**. Crucial bridge between user query strings, prescription entities, and rule engines.

### DS-006: openFDA Regulatory API
* **Official Publisher**: U.S. Food and Drug Administration.
* **Official URL**: `https://open.fda.gov`
* **Evidence Role**: Dynamic regulatory drug labeling and reported adverse event summaries.
* **Access / License**: Public Domain (CC0 Equivalent).
* **Safety Constraint**: Adverse event reports are strictly labelled as voluntary post-marketing reports and **never** presented as causal clinical evidence.
* **Decision**: **ACCEPT**.

### DS-007: MedQuAD Composite NIH Knowledge Base
* **Official Publisher**: 9 Institutes of the National Institutes of Health (NCI, GARD, GHR, NIDDK, NINDS, SeniorHealth, NHLBI, CDC, MedlinePlus).
* **Official URL**: `https://github.com/abachaa/MedQuAD` / Official NIH source domains.
* **Evidence Role**: Verified question-answer clinical summaries across 16,358 medical documents.
* **Access / License**: US Government Public Domain / CC BY 4.0.
* **Decision**: **ACCEPT (HISTORICAL / PROD)**. Provenance verified across 9 federal institutes.

### DS-008 & DS-009: Legacy `drugbank.csv` & `sider.csv`
* **Finding**: The 8-row `drugbank.csv` and 18-row `sider.csv` in `drug_module/datasets/` contain hand-typed sample rows without documented provenance, official citations, or verified licensing terms.
* **Decision**: **REJECT & QUARANTINE**. Replaced by verified rule database in `data/rules/medication_interactions/` and `data/rules/contraindications/` traceable to DailyMed and FDA SPL citations.

### DS-010: MIMIC-IV / PhysioNet
* **Reason for Deferral**: Requires individual credentialed DUA (Data Use Agreement), HIPAA CITI training, and restricted hosting environments. The CDS-RAG prototype focuses on knowledge retrieval and clinical guidance rather than inpatient EHR prediction.
* **Decision**: **DEFER**.

### DS-012: Multimodal Medical Imaging Datasets
* **Reason for Deferral**: The scope of this phase is text, structured medication normalization, and India-specific guideline retrieval. Diagnostic image classification (X-Ray/CT) is out of scope. Documented in `docs/FUTURE_MULTIMODAL.md`.
* **Decision**: **DEFER**.
