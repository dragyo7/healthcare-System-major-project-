# SOURCE TO CHUNK PROVENANCE MAP

**Scope**: Production Curated Knowledge Base (236 Chunks across 5 Authoritative Sources)  
**Date**: September 15, 2026  

---

## Provenance Architecture

```
[ Authoritative Publisher (FDA SPL / ICMR / MoHFW / NLM) ]
                           │
                           ▼
             [ Canonical Source Record / URL ]
                           │
                           ▼
          [ Stored Artifacts (data/knowledge_bases/) ]
                           │
                           ▼
        [ Ingestion Adapters (rag_module/ingestion/) ]
                           │
                           ▼
          [ Normalized Document & Section Parser ]
                           │
                           ▼
             [ Semantic Chunking Engine ]
                           │
                           ▼
     [ Manifest & Metadata (data/faiss_index/meta_v2.json) ]
                           │
                           ▼
         [ FAISS (IndexFlatIP) + BM25Okapi Indexes ]
```

---

## Source Inventory & Representative Provenance Traces

### 1. National Library of Medicine DailyMed (FDA SPL)
- **Publisher**: U.S. National Library of Medicine / FDA
- **Official Portal**: `https://dailymed.nlm.nih.gov`
- **Total Production Chunks**: 188
- **Representative Trace 1 (Metformin)**:
  - **Set ID**: `060d40e4-b778-43d9-9596-f9478f773489`
  - **Section**: `Contraindications`
  - **Chunk ID**: `dailymed_060d40e4-b778-43d9-9596-f9478f773489_contraindications-c0`
  - **URL**: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=060d40e4-b778-43d9-9596-f9478f773489`
  - **Core Text**: *"Severe renal impairment (eGFR < 30 mL/min/1.73m2), metabolic acidosis, acute or chronic DKA."*
- **Representative Trace 2 (Lisinopril)**:
  - **Set ID**: `4b2c1256-42d4-4a4b-8e2a-0a8870fb381b`
  - **Section**: `Boxed Warning`
  - **Chunk ID**: `dailymed_4b2c1256-42d4-4a4b-8e2a-0a8870fb381b_boxed_warning-c0`
  - **URL**: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=4b2c1256-42d4-4a4b-8e2a-0a8870fb381b`
  - **Core Text**: *"WARNING: FETAL TOXICITY. When pregnancy is detected, discontinue Lisinopril as soon as possible..."*

---

### 2. Indian Council of Medical Research (ICMR)
- **Publisher**: Indian Council of Medical Research (Govt of India)
- **Official Portal**: `https://main.icmr.nic.in`
- **Total Production Chunks**: 8
- **Representative Trace 1 (Antimicrobial - Respiratory Infections)**:
  - **Guideline**: ICMR National Treatment Guidelines for Antimicrobial Use in Infectious Diseases (2022)
  - **Section**: `Empiric Therapy for Community-Acquired Pneumonia (CAP)` (Page 42)
  - **Chunk ID**: `icmr_icmr_antimicrobial_2022_respiratory_infections-c0`
  - **URL**: `https://main.icmr.nic.in/content/national-treatment-guidelines-antimicrobial-use`
  - **Core Text**: *"Outpatient CAP (Mild, CURB-65 = 0-1, no comorbidities): First-line: Oral Amoxicillin 500 mg - 1000 mg three times daily for 5 days. Alternative: Oral Doxycycline 100 mg twice daily..."*
- **Representative Trace 2 (Antimicrobial - Urinary Tract Infections)**:
  - **Section**: `Empiric Therapy for Uncomplicated Acute Cystitis` (Page 68)
  - **Chunk ID**: `icmr_icmr_antimicrobial_2022_urinary_tract_infections-c0`
  - **Core Text**: *"First-line empiric therapy for acute uncomplicated cystitis in adult females: Nitrofurantoin 100 mg orally twice daily for 5 days..."*

---

### 3. Ministry of Health & Family Welfare (MoHFW STG)
- **Publisher**: Ministry of Health and Family Welfare (Govt of India)
- **Official Portal**: `https://mohfw.gov.in`
- **Total Production Chunks**: 4
- **Representative Trace (Hypertension Protocol)**:
  - **Guideline**: MoHFW Standard Treatment Guidelines - Hypertension
  - **Section**: `Primary Health Centre (PHC) Management Protocol`
  - **Chunk ID**: `mohfw_mohfw_stg_hypertension_primary_health_centre_protocol-c0`
  - **URL**: `https://mohfw.gov.in/sites/default/files/STG_Hypertension.pdf`
  - **Core Text**: *"Primary Health Centre Protocol: Initiate lifestyle modification and monotherapy with Amlodipine 5 mg OD or Telmisartan 40 mg OD..."*

---

### 4. MedlinePlus Health Topics
- **Publisher**: National Library of Medicine (NLM / NIH)
- **Official Portal**: `https://medlineplus.gov`
- **Total Production Chunks**: 16
- **Representative Trace (Tuberculosis Overview)**:
  - **Topic**: Tuberculosis
  - **Section**: `Overview`
  - **Chunk ID**: `mplus_tuberculosis_overview-c0`
  - **URL**: `https://medlineplus.gov/tuberculosis.html`
  - **Core Text**: *"Tuberculosis (TB) is a contagious infection that usually attacks the lungs. It is caused by Mycobacterium tuberculosis..."*

---

### 5. RxNorm Clinical Drug Terminology
- **Publisher**: National Library of Medicine (NLM / NIH)
- **Official Portal**: `https://www.nlm.nih.gov/research/umls/rxnorm`
- **Total Production Chunks**: 20
- **Representative Trace (Warfarin Sodium)**:
  - **RxCUI**: `11289`
  - **Brand Aliases**: Coumadin, Jantoven
  - **Chunk ID**: `rxnorm_11289-c0`
  - **URL**: `https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=11289`
  - **Core Text**: *"RxNorm Concept: 11289 (warfarin). Generic: warfarin sodium. Brand Aliases: Coumadin, Jantoven. Dose Form: Oral Tablet..."*
