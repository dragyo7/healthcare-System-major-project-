# Canonical Repository Cleanup Manifest

> **Project**: Modular AI-Powered Clinical Decision Support System (CDSS)  
> **Status**: Completed, Verified & Retained  
> **Date**: October 2026  

---

## 1. Executive Summary

In accordance with the repository consolidation and cleanup protocol, this document records all redundant archives, temporary build artifacts, and extracted duplicates identified, verified, and safely removed from the repository.

All removals satisfied the non-negotiable safety conditions:
1. Every component, schema, and routine contained in an archive was extracted and verified working in the canonical source tree before removal.
2. Zero source documentation, research papers, migration files, SQL dumps, or test fixtures were deleted.
3. No destructive Git commands (`git clean -f`, `git reset --hard`) were executed.

---

## 2. Redundant Archives Removed

| Archive Path | Size (Bytes) | Size (MB) | Purpose & Contents | Verification Evidence of Redundancy | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `Portal Major P/Bhumi/Doctor portal.zip` | 31,859,981 | 31.8 MB | Initial ZIP snapshot of Bhumi's Doctor Portal backend and frontend. | Complete backend active in `Portal Major P/Bhumi/Doctor portal/backend/` (running Express on port 5000); complete frontend modularized and verified in canonical `frontend/src/pages/Doctor/`. | **Safely Removed** |
| `Portal Major P/Ketki/healthcare_project.zip` | 78,766,887 | 78.7 MB | Initial ZIP snapshot of Ketki's Receptionist portal and schemas. | Complete MySQL schemas preserved in `Portal Major P/Ketki/` and migrations; frontend modularized and verified in canonical `frontend/src/pages/Receptionist/`. | **Safely Removed** |

**Total Storage Reclaimed**: **110,626,868 bytes (~110.6 MB)**

---

## 3. Temporary Test & Build Files Cleaned

| File Path | Description | Reason for Removal | Status |
| :--- | :--- | :--- | :--- |
| `tests/benchmark_pipeline_stage_timings.json.bak` | Temporary backup created during pipeline profiling benchmark. | Redundant backup. Active results retained in `benchmark_pipeline_stage_timings.json`. | **Removed** |
| `scratch/mysql_data/` | Transient MySQL InnoDB runtime transaction files and binlogs. | Added to `.gitignore` to prevent database runtime data from polluting Git. | **Ignored** |
| `uploads/prescriptions/*.png` | Temporary OCR test image uploads from synthetic automated test suite. | Added to `.gitignore` to prevent synthetic test artifacts from polluting Git. | **Ignored** |

---

## 4. Preserved Core Assets (Retained Invariants)

The following essential assets were explicitly audited and **preserved**:
1. **Frozen RAG V2.10 Core**: FAISS index (`data/faiss_index/index_v2.bin`, `meta_v2.pkl`, 2,204 chunks) and embedding configuration.
2. **Database Migrations & Schemas**: `migrations/001_initial_schema.sql`, `002_discharge_care.sql`, `003_prescription_ocr_jobs.sql`, `004_account_activations.sql`, and `scratch/pre_cleanup_backup.sql`.
3. **Deterministic Safety Rules**: `data/rules/medication_interactions/medication_interactions.json` (8 verified bidirectional DrugBank rules) and `sider_side_effects.json`.
4. **All Regression Suites**: 193 pytest unit tests, 12 master integration test suites, and multi-role synthetic end-to-end journey tests.
5. **Teammate Attribution & Project History**: All original teammate source directories in `Portal Major P/` remain intact for academic and forensic review.
