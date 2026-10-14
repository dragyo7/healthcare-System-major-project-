# Clinical Knowledge Corpus: Provenance, Integrity & Artifact Verification

> **Authoritative Technical Document: Data Provenance, Chunk Accounting & Frozen Artifact Hashes**  
> **Repository Root**: `E:\Major Project Code`  
> **Corpus Baseline**: Frozen RAG V2.10 (Commit `497a547`)  
> **Production Vectors**: 2,204 Chunks  
> **Index Location**: `data/faiss_index/` & `rag_module/data/faiss_index/`  
> **Date**: October 2026  

---

## 1. Corpus Inventory & Accounting

Independent verification of `data/faiss_index/meta_v2.pkl` and `data/manifests/source_catalog.json` confirms:
* **Total Chunks in Production**: **2,204**
* **Duplicate Chunk IDs**: **0**
* **Orphan Vectors (FAISS vs. Metadata)**: **0** (FAISS index size `ntotal = 2,204`, metadata count `N = 2,204`)
* **Embedding Model**: `BAAI/bge-small-en` (384 dimensions)
* **Dense Metric**: Inner Product (Cosine similarity on L2-normalized embeddings)

### Source Breakdown by Clinical Authority

| Clinical Authority / Publisher | Scope / Focus Area | Verified Chunk Count | Percentage | Provenance Type |
| :--- | :--- | :--- | :--- | :--- |
| **DailyMed (NLM / NIH)** | FDA-Approved Drug Package Inserts | **2,176** | 98.73% | Direct Drug SPL Labels |
| **MedlinePlus (NLM / NIH)** | Patient Medical & Diagnostic Overviews | **16** | 0.73% | Official Condition Topics |
| **ICMR (Govt of India)** | Indian Clinical Guidelines (Cardio / Endocrine) | **8** | 0.36% | Official National Guidelines |
| **MoHFW STG (Govt of India)** | Standard Treatment Guidelines | **4** | 0.18% | Standard Care Guidelines |
| **Total Production Corpus** | Multi-Source Clinical Knowledge Base | **2,204** | **100.00%** | **Audited & Frozen** |

---

## 2. Cryptographic Integrity Hashes (Before & After Verification)

To guarantee that no step of the evaluation, audit, test suites, or cleanup altered the frozen knowledge core, SHA-256 checksums were calculated before and after test execution:

| Artifact Path | Format | Role | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| `data/indices/production/index_v2.bin` & `rag_module/data/faiss_index/index_v2.bin` | Binary | Dense FAISS Vector Index (2,204 x 384) | `70c7b0f4ec73effe49a9478aa2c3d3748753e7379f92fe0578b3d82932a1c35f` |
| `data/indices/production/meta_v2.pkl` & `rag_module/data/faiss_index/meta_v2.pkl` | Pickle | Chunk Metadata & Clinical Taxonomies | `8e309931b87f8c944409839e4e44a39d3d213a992dd7bc3feeb6df7363e50d3e` |
| `data/indices/production/bm25_index.pkl` & `rag_module/data/faiss_index/bm25_index.pkl` | Pickle | Sparse Lexical Retrieval Index | `26330911f65a40b17f5165f655a5a6cff83786bfc77cdb1a18843137394caeca` |

*Verification Result*: **100% Identical.** Zero bytes in the production RAG index were modified.

---

## 3. Data Integrity & Content Audit

### 3.1 Preservation of Clinical Units and Quantities
An inspection of chunk text across cardiovascular, endocrine, and antibiotic categories confirms preservation of:
* **Metric units**: `mg`, `mcg`, `g`, `mL`, `mg/dL`, `mmol/L`
* **Dosing frequencies**: `once daily`, `twice daily (BID)`, `with meals`, `at bedtime`
* **Contraindications**: Explicit black-box warnings, pregnancy categories, hepatic/renal impairment qualifiers.

### 3.2 Provenance Gaps & Maintenance Ledger
* **Document-Specific URLs vs Domain URLs**: DailyMed chunks map directly to structured drug identifiers. Regional ICMR and MoHFW chunks point to authoritative repository document sources.
* **Currency**: The frozen baseline represents knowledge current through the approved V2.10 freeze date. Re-indexing or online synchronization is strictly disabled to guarantee deterministic evaluation reproducibility.
