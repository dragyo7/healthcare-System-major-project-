# UNVERIFIED ITEMS & PROVENANCE BOUNDARIES

This document lists items that were audited and determines their verification status or explicit exclusion boundaries.

---

## 1. Excluded & Quarantined Items

| Item / Resource | Reason for Quarantine / Exclusion | Status |
|---|---|---|
| **Legacy MedQuAD (26,143 Q&As)** | Large scrape without structured clinical contraindication LOINC sections; potential patient QA noise. | **QUARANTINED** (Excluded from production index; 2 skipped tests confirm bypass). |
| **Raw DrugBank & SIDER Scrapes** | Potential unverified secondary scrapes; superseded by direct FDA DailyMed SPL packages. | **EXCLUDED** from production vectors. |
| **Deferred Source: openFDA Dynamic API** | Registered in `SourceRegistry` for future live REST lookup, but static corpus ingestion currently yields 0 chunks. | **DEFERRED** (Does not pollute production vector index). |

---

## 2. Verified Authoritative Assets

| Item | Proof of Verification | Status |
|---|---|---|
| **DailyMed (188 chunks)** | Traced to FDA SPL Set IDs and LOINC sections. | **VERIFIED** |
| **ICMR Guidelines (8 chunks)** | Traced to official ICMR 2022 Antimicrobial and T2DM national treatment guidelines. | **VERIFIED** |
| **MoHFW STG (4 chunks)** | Traced to Ministry of Health Standard Treatment Guidelines. | **VERIFIED** |
| **MedlinePlus (16 chunks)** | Traced to NIH/NLM topic pages (Pneumonia, TB, Diabetes, Hypertension). | **VERIFIED** |
| **RxNorm Concepts (20 chunks)** | Traced to NLM RxCUI prescribable relational dictionary. | **VERIFIED** |
