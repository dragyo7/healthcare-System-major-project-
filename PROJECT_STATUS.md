# PROJECT_STATUS.md — Living State & Verification Snapshot

> **Status Reference**: Authoritative Living Project Status  
> **Repository**: `dragyo7/healthcare-System-major-project-`  
> **Current Branch**: `main`  
> **Current HEAD Commit**: `b28ddb7`  
> **Remote Synchronization**: Synchronized with `origin/main` (Clean working tree)  
> **Last Verification Run**: October 2026  

---

## 1. Verified vs. Reported Subsystem Status

| Subsystem / Layer | Implementation Status | Verification Standard | Evidence & Notes |
| :--- | :---: | :---: | :--- |
| **Unified Frontend (Port 5173)** | Complete | **Verified** | Single React 19 + Vite 8 SPA. Houses Doctor, Patient, Receptionist, and Activation routes. Builds cleanly (`0 errors in 1.03s`). |
| **Express EHR Gateway (Port 5000)** | Complete | **Verified** | Server-side RBAC, BOLA isolation, Zero-PII sanitization, MySQL advisory locking (`rx_lock`), and offline OCR coordination. |
| **FastAPI CDS Gateway (Port 8000)** | Complete | **Verified** | Centralized clinical orchestrator (`POST /cds/evaluate`, `POST /cds/screen-prescription`). Stripped of PII. |
| **MySQL Database (Port 3306)** | Complete | **Verified** | 13 normalized relational tables + 4 tracked migrations (`001` to `004`). Seeded synthetic test personas. |
| **Frozen Medical RAG v2.10** | Hard Frozen | **Verified** | 2,204 DailyMed chunks in FAISS. Hybrid BM25+Dense retrieval, Cross-Encoder rerank, TinyLlama-1.1B, and fail-closed grounding verifier. Passed **193 tests, 2 skipped, 0 failed** (Task-6523). |
| **Deterministic Drug Safety** | Complete | **Verified** | Compiled DrugBank 8-rule graph & SIDER 20-profile adverse effect engine. Evaluates combinations in **< 15ms**. |
| **Indic Multilingual Engine** | Complete | **Verified** | Supports English, Hindi, Marathi, Gujarati. Entity-preserving normalization keeps drug names and dosages intact. 16/16 tests pass. |
| **Prescription OCR Pipeline** | Complete | **Verified** | Tesseract.js offline extraction. Enforces strict human clinician review invariant (`needs_review: true`). 12/12 tests pass. |

---

## 2. Test Execution Evidence & Pass Rates

| Test Suite / Runner | Target Boundary | Pass / Total | Exit Code | Last Verified Evidence |
| :--- | :--- | :---: | :---: | :--- |
| `python -m pytest rag_module/tests/ -q` | Frozen RAG Core, retrieval, verifier, safety | **193 / 195** (2 skipped) | `0` | Verified in Task-6523 (278.43s, 0 failed) |
| `python -m pytest cds_module/ -v` | CDS Gateway orchestration, triage, injection | **9 / 9** | `0` | `cds_module/test_cds_gateway.py` |
| `python -m pytest multilingual_module/tests/ -v` | Language detection, canonicalizer, templates | **16 / 16** | `0` | `multilingual_module/tests/test_multilingual.py` |
| `node tests/integration/test_route_authorization_matrix.js` | BOLA, IDOR, parameter tampering, RBAC | **27 / 27** | `0` | `tests/integration/test_route_authorization_matrix.js` |
| `node tests/integration/test_pdf_ownership_and_lock_failure.js` | PDF ownership authorization, advisory lock timeout | **6 / 6** | `0` | Verified 0 bytes streamed on 403, 503 on lock timeout |
| `node tests/integration/test_concurrent_prescription_idempotency.js` | MySQL session advisory lock race-condition | **5 / 5** | `0` | 1 Created, 4 Deduplicated on concurrent burst |
| `node scratch/test_activation_and_role_mismatch.js` | 32-byte single-use token, replay defense, RBAC | **20 / 20** | `0` | Verified replay returns HTTP 400 |
| `node scratch/test_patient_registration_validation.js` | DOB range validation, phone number sanitization | **9 / 9** | `0` | Validates 1900-today, 10-digit phone |
| `node scratch/test_doctor_portal_e2e.js` | Doctor dashboard, patient dossier, prescriptions | **26 / 26** | `0` | Full E2E clinical workflow verified |
| `node scratch/test_full_system_multi_role_e2e.js` | Multi-role synthetic lifecycle across all 3 roles | **20 / 20** | `0` | Cross-role journey verified |
| `cd frontend; npm run build` | Vite 8 + React 19 production bundle | **2,245 modules** | `0` | Clean build in 1.03s, 0 errors |

---

## 3. Known Limitations & Operating Boundaries

1. **Hardware Generative Latency**:
   - `TinyLlama-1.1B` running on local CPU requires 25–30 seconds for deep conversational generation.
   - Routine prescription screening bypasses this latency completely, executing in **< 15ms** via deterministic graph lookup.
2. **First-Request Cold Start**:
   - The Cross-Encoder reranker (`ms-marco-MiniLM-L-6-v2`) lazy-loads into memory on the first request (~1.5s cold-start), then remains fast in-memory.
3. **Bounded Deterministic Safety Rules**:
   - The deterministic engine evaluates an auditable set of **8 high-severity DrugBank rules** and **20 SIDER profiles**. Unindexed drug pairs rely on RAG retrieval or trigger fail-closed policy abstentions.
4. **Knowledge Corpus Boundary**:
   - The production FAISS index contains **2,204 verified chunks** (2,176 DailyMed FDA monographs, MedlinePlus summaries, ICMR guidelines). Unindexed entities trigger safe fail-closed abstentions (`abstained_policy`).
5. **Prescription OCR Review Invariant**:
   - Scanned prescription OCR is treated strictly as an unconfirmed draft (`needs_review: true`) and cannot be saved without clinician signature.

---

## 4. Current Documentation Architecture & Active Task

### Active Documentation Status
- [x] `README.md`: Updated to commit `b28ddb7` with Mermaid topology and sequence diagrams, runbook, route matrix, and test commands.
- [x] `AGENTS.md`: Authoritative operations manual aligned to `main`.
- [x] `FINAL_GOAL.md`: Product completion contract authored.
- [x] `PROJECT_STATUS.md`: Authoritative living status authored.
- [ ] `DECISIONS.md`: Engineering decisions log (DEC-001 through DEC-012) to be created in root.
- [ ] `FLOW.md`: Function-by-function execution and data-flow map to be created in root.
- [ ] `.agent/` archive: Obsolete September 2026 files to be safely archived to `docs/archive/legacy_agent/`.

### Active Blockers / Dependencies
- None blocking code execution. Live testing requires starting the background services (`MySQL 3306`, `FastAPI 8000`, `Express 5000`, `Vite 5173`).
