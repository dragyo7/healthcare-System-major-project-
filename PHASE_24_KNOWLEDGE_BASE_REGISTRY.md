# PHASE 24 — KNOWLEDGE BASE REGISTRY

## Overview
The Knowledge Base Registry (`data/registry/knowledge_base_registry.json`) provides a central, machine-readable inventory of all authorized knowledge sources in the CDS system.

---

## Complete Source Registry (17 Registered Sources)

| Source ID | Publisher | Tier | Primary URL | Description |
| :--- | :--- | :---: | :--- | :--- |
| **`DailyMed`** | NLM / FDA | Tier 1 Regulatory | `https://dailymed.nlm.nih.gov` | Official FDA drug labeling (SPL) package inserts. |
| **`ICMR`** | Indian Council of Medical Research | Tier 1 National | `https://main.icmr.nic.in` | Clinical practice guidelines for India. |
| **`MoHFW_STG`** | Ministry of Health & Family Welfare | Tier 1 National | `https://clinicalestablishments.gov.in` | Standard Treatment Guidelines for PHC/CHC. |
| **`MedlinePlus`** | National Library of Medicine | Tier 1 Federal | `https://medlineplus.gov` | Patient-centric disease and condition overviews. |
| **`RxNorm`** | National Library of Medicine | Tier 1 Terminology | `https://www.nlm.nih.gov/research/umls/rxnorm/` | Standardized clinical drug terminology & RxCUI lookup. |
| **`openFDA`** | U.S. FDA | Tier 1 Regulatory | `https://open.fda.gov` | Dynamic drug adverse event and recall data. |
| **`CancerGov`** | National Cancer Institute (NIH) | Tier 1 Federal | `https://www.cancer.gov` | Comprehensive oncology and chemotherapy guidance. |
| **`GARD`** | NCATS / NIH | Tier 1 Federal | `https://rarediseases.info.nih.gov` | Genetic and Rare Diseases Information Center. |
| **`GHR`** | National Library of Medicine | Tier 1 Federal | `https://medlineplus.gov/genetics/` | Genetics Home Reference (now part of MedlinePlus). |
| **`MPlus_Health_Topics`** | National Library of Medicine | Tier 1 Federal | `https://medlineplus.gov/healthtopics.html` | Specific MedlinePlus health topic overviews. |
| **`NIDDK`** | NIDDK / NIH | Tier 1 Federal | `https://www.niddk.nih.gov` | Diabetes, digestive, and kidney diseases. |
| **`NINDS`** | NINDS / NIH | Tier 1 Federal | `https://www.ninds.nih.gov` | Neurological disorders and stroke. |
| **`SeniorHealth`** | NIH Senior Health | Tier 1 Federal | `https://nihseniorhealth.gov` | Geriatric healthcare considerations. |
| **`NHLBI`** | NHLBI / NIH | Tier 1 Federal | `https://www.nhlbi.nih.gov` | Heart, lung, and blood disease guidelines. |
| **`CDC`** | Centers for Disease Control | Tier 1 Public Health | `https://www.cdc.gov` | Infectious disease and vaccination guidance. |
| **`MedQuAD`** | NIH (Legacy Q&A) | Tier 4 (Quarantine) | `https://github.com/abachaa/MedQuAD` | Quarantined legacy dataset (excluded from production). |
| **`ClinicalGuidelines`** | Consensus Guidelines | Tier 2 Clinical | `https://guidelines.gov` | General clinical practice guidelines. |

---

## Machine-Readable Registry File
The persistent registry is saved at:
[`data/registry/knowledge_base_registry.json`](file:///e:/Major%20Project%20Code/data/registry/knowledge_base_registry.json)
