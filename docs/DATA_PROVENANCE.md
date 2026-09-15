# Data Provenance, Governance & Traceability (Phase 24)

## 1. Provenance Philosophy & Governance Model

In a Clinical Decision Support (CDS) system, algorithmic confidence is meaningless without **verifiable source grounding**. The system enforces a strict provenance hierarchy to eliminate hallucinations, prevent unverified web scrapers or toy datasets from reaching clinical workflows, and provide full auditability for regulatory and academic defense.

```
       ┌─────────────────────────────────────────────────────────┐
       │   Tier 1: Regulatory & Official Clinical Guidelines     │
       │   DailyMed SPL (FDA), MedlinePlus (NIH), RxNorm (NLM)   │
       │   ICMR Treatment Guidelines, MoHFW Standard Treatment  │
       └────────────────────────────┬────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │      Tier 2: Peer-Reviewed Secondary Medical Knowledge  │
       │      PubMed Central, openFDA Pharmacovigilance          │
       └────────────────────────────┬────────────────────────────┘
                                    │
                                    ▼
       ┌─────────────────────────────────────────────────────────┐
       │         Tier 3: Experimental / Local Guidelines         │
       │         Institutional SOPs, Hospital Formulary          │
       └────────────────────────────┬────────────────────────────┘
                                    │
                                    ▼ [REJECTED FROM PRODUCTION CDS]
       ┌─────────────────────────────────────────────────────────┐
       │             Tier 4: Synthetic / Unverified Data         │
       │     Legacy toy CSVs, synthetic dialogues, unverified   │
       │     Status: QUARANTINED (Zero production ingestion)     │
       └─────────────────────────────────────────────────────────┘
```

---

## 2. Ingested Datasets & Verification Catalog

### Frozen Golden Baseline (236 Chunks)
| Source Key | Authority / Agency | Verification Level | Document Count | Total Chunks | Access / License |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `DailyMed` | US Food & Drug Administration (FDA) / NLM | **Official Tier-1** | 25 monographs | 188 | US Public Domain |
| `MedlinePlus` | National Library of Medicine (NIH) | **Official Tier-1** | 10 topics | 16 | US Public Domain |
| `ICMR` | Indian Council of Medical Research | **Official Tier-1** | 8 guidelines | 8 | Official Indian Guidelines |
| `MoHFW_STG` | Ministry of Health & Family Welfare (India) | **Official Tier-1** | 4 guidelines | 4 | Official Indian Guidelines |
| `RxNorm` | National Library of Medicine (NLM) | **Official Tier-1** | 20 concepts | 20 | NLM UMLS Terms |
| **Total** | — | — | **67 Documents** | **236 Chunks** | **100% Verified** |

### Expanded Authoritative Corpus (2,204 Chunks)
| Source Key | Authority / Agency | Verification Level | Document Count | Total Chunks | Valid Provenance |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `DailyMed` | US Food & Drug Administration (FDA) / NLM | **Official Tier-1** | 231 full SPLs | 2,176 | 100.0% (2,176/2,176) |
| `ICMR` | Indian Council of Medical Research | **Official Tier-1** | 8 guidelines | 8 | 100.0% (8/8) |
| `MoHFW_STG` | Ministry of Health & Family Welfare (India) | **Official Tier-1** | 4 guidelines | 4 | 100.0% (4/4) |
| `MedlinePlus` | National Library of Medicine (NIH) | **Official Tier-1** | 16 topics | 16 | 100.0% (16/16) |
| **Total Expanded** | — | — | **259 Documents** | **2,204 Chunks** | **100.0% (0 Invalid)** |

---

## 3. Provenance Verification Algorithm

Every chunk ingested into FAISS and BM25 carries strict metadata validated by `rag_module/knowledge/document_model.py` and `rag_module/safety/provenance_validator.py`:

```python
class ProvenanceValidator:
    @staticmethod
    def validate_evidence_item(item: Dict[str, Any]) -> ProvenanceValidationResult:
        """
        Validates that a chunk contains:
        1. Non-empty chunk ID and content
        2. Recognized authoritative source_id
        3. Authoritative publisher and source URL
        4. Section name or LOINC code
        5. Exact SHA-256 content hash
        """
        # Returns is_valid=True only if all fields meet strict criteria
```

### End-to-End Lineage Invariant
Every production chunk satisfies the cryptographic invariant:
$$\text{Source Document} \xrightarrow{\text{parse}} \text{Section} \xrightarrow{\text{chunk}} \text{Passage} \xrightarrow{\text{SHA-256}} \text{Hash} \xrightarrow{\text{BGE-small-en}} \mathbf{v} \in \mathbb{R}^{384} \xrightarrow{\text{FAISS}} \text{Index Position}$$
