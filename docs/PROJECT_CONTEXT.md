# PROJECT CONTEXT — Comprehensive Engineering Manual

> **Target Audience**: Senior Software Engineers, Systems Architects, and AI Coding Agents  
> **Project**: Modular AI-Powered Multilingual Clinical Decision Support (CDS) System (4th-Year Major Project)  
> **Current Branch**: `feature/cds-gateway`  
> **Authoritative Baseline Reference**: Commit `7b0867b` (Frozen RAG V2.10 + CDS Gateway + Verified Doctor Portal + Multilingual Foundation)  
> **Date**: October 2026  

---

## 1. Problem Statement & Mission

Modern hospital environments suffer from fragmented clinical data, dangerous polypharmacy drug-drug interactions, and language barriers for patients communicating in regional languages.

This project delivers a **Modular Clinical Decision Support (CDS) System** uniting:
1. **Evidence-Grounded Clinical Intelligence**: Providing verified medical guideline information from DailyMed SPL monographs with token-level grounding verification.
2. **Deterministic Drug Safety Screening**: Evaluating candidate prescriptions against rule-based DrugBank interaction matrices and SIDER adverse effect profiles.
3. **Electronic Health Record Management**: Enabling role-based workflows for Doctors, Patients, and Receptionists with server-side authorization.
4. **Multilingual Access**: Enabling non-English clinical inquiries (Hindi, Marathi) via a cross-cutting normalization pipeline that queries the authoritative medical knowledge base without creating duplicate regional vector databases.

---

## 2. Global Architecture & Network Topology

The system operates across three network tiers:

```text
                                  TIER 1: FRONTENDS
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                          ▼
        Doctor Portal              Patient Portal          Receptionist Portal
     (React / Vite :5173)         (Pending Teammate)        (Pending Teammate)
              │                          │                          │
              └──────────────────────────┼──────────────────────────┘
                                         │ HTTP (localhost:5000)
                                         ▼
                                  TIER 2: GATEWAY
                           ┌────────────────────────────┐
                           │    Express EHR Gateway     │ (Node.js on :5000)
                           │  • JWT Authentication      │
                           │  • RBAC & BOLA Defenses    │
                           │  • Zero-PII Context Sanit. │
                           └──────┬──────────────┬──────┘
                                  │              │
                       SQL (3306) │              │ HTTP Forward (Zero PII)
                                  ▼              ▼
                     ┌───────────────────┐  ┌─────────────────────────────────┐
                     │  MySQL Database   │  │    FastAPI CDS Gateway (:8000)  │
                     │ (rag_healthcare)  │  │  • Multilingual Engine          │
                     │ • users           │  │  • Deterministic Drug Safety    │
                     │ • patients        │  │  • Frozen Medical RAG V2.10     │
                     │ • prescriptions   │  │  • AnswerGroundingVerifier      │
                     │ • appointments    │  └─────────────────────────────────┘
                     │ • schedules       │
                     └───────────────────┘
```

**Non-Negotiable Network Invariant**: The browser NEVER communicates directly with FastAPI on port 8000. All browser requests must route through Express on port 5000.

---

## 3. Repository Structure & Module Locations

```text
E:\Major Project Code\
├── cds_module/                       # Central CDS Gateway & Orchestrator
│   ├── models.py                     # Pydantic request/response schemas (Zero PII)
│   ├── orchestrator.py               # Multilingual, Drug Safety & RAG Coordinator
│   ├── router.py                     # FastAPI routes (/cds/evaluate, /cds/screen-prescription)
│   └── test_cds_gateway.py           # 9 Gateway integration tests
│
├── rag_module/                       # Frozen Medical RAG V2.10 Core
│   ├── api.py                        # FastAPI root app (Port 8000)
│   ├── rag_pipeline.py               # Hybrid retrieval & generation pipeline
│   ├── service.py                    # RAG Service boundary layer
│   ├── config/rag_config.py          # Configuration parameters
│   ├── retrieval/                    # Dense (FAISS), BM25, and Hybrid (RRF) retrievers
│   ├── reranking/                    # Cross-Encoder second-stage reranker
│   ├── safety/                       # Guardrails, EvidencePolicyEngine, AnswerGroundingVerifier
│   ├── generation/                   # TinyLlama-1.1B generator
│   ├── data/faiss_index/             # Production FAISS index (index_v2.bin, meta_v2.pkl)
│   └── tests/                        # 192 RAG regression tests (190 pass, 2 skip)
│
├── drug_module/                      # Deterministic Medication Safety Engine
│   ├── api.py                        # Standalone API routes
│   ├── data_loader.py                # DrugBank & SIDER JSON loader
│   ├── interaction_engine.py         # Multi-drug interaction rule evaluator
│   └── side_effect_engine.py         # Adverse effect profile matcher
│
├── prescription_module/              # Free-Text Clinical Prescription Extractor
│   ├── api.py                        # Standalone API routes
│   ├── extractor.py                  # Dosing & frequency extraction
│   └── regex_rules.py                # Regex extraction patterns
│
├── multilingual_module/              # Cross-Cutting Multilingual Foundation
│   ├── languages.py                  # SupportedLanguage enum (en, hi, mr)
│   ├── detector.py                   # Script & lexical marker detection, Indic emergency/injection regexes
│   ├── canonicalizer.py              # Indic-to-English medical normalization & concept lexicon
│   ├── safety_templates.py           # Authoritative trilingual safety templates (112/108)
│   ├── localizer.py                  # Grounded answer & alert response localization
│   ├── ui_locales.py                 # UI localization translation tables
│   └── tests/test_multilingual.py    # 16 Unit and integration tests
│
├── Portal Major P/Bhumi/
│   └── Doctor portal/                # Teammate Doctor Portal Subsystem
│       ├── backend/                  # Express EHR Application (Port 5000)
│       │   ├── src/controllers/      # authController, doctorController, patientController
│       │   ├── src/middleware/       # authMiddleware (JWT, RBAC)
│       │   ├── src/services/         # cdsBridgeService (Sanitizes PII, calls FastAPI)
│       │   ├── src/routes/           # authRoutes, doctorRoutes, patientRoutes
│       │   ├── src/config/db.js      # MySQL connection pool
│       │   └── server.js             # Express entry point
│       └── frontend/                 # Doctor Portal React Application (Port 5173)
│           ├── src/App.jsx           # Doctor portal views & in-dossier CDS Assistant
│           └── src/config/api.js     # Points exclusively to http://localhost:5000
│
├── data/                             # Production Clinical Knowledge & Rules
│   ├── faiss_index/                  # Production FAISS vector index (2,204 chunks)
│   └── rules/medication_interactions/# DrugBank interaction rules & SIDER profiles
│
├── docs/                             # Authoritative System Documentation & Archive
├── scratch/                          # Verification test scripts & temporary database dumps
└── AGENTS.md                         # Authoritative agent operations manual
```

---

## 4. What Is Frozen (DO NOT MODIFY)

1. **RAG V2.10 Core**:
   * FAISS dense index (`index_v2.bin`, 2,204 DailyMed SPL chunks, 384 dimensions)
   * `BAAI/bge-small-en` embeddings
   * BM25 sparse lexical index
   * Reciprocal Rank Fusion (`k=60`)
   * Cross-Encoder reranker (`cross-encoder/ms-marco-MiniLM-L-6-v2`)
   * `EvidencePolicyEngine` and `AnswerGroundingVerifier`
   * Grounding verification thresholds and fail-closed safety policy
2. **Deterministic Drug Safety Engine**:
   * Verified DrugBank rules (`RUL-INT-001` through `RUL-INT-008`)
3. **Network Tier Isolation**:
   * Express remains the sole public-facing EHR and RBAC boundary.

---

## 5. Security & Authorization Architecture

* **Broken Object Level Authorization (BOLA)**:
  * Express executes server-side validation against `doctor_patients` (for doctors) and `patients.user_id` (for patients) before executing any sensitive EHR query.
  * Attempting to query an unlinked patient ID returns **HTTP 403 Forbidden**.
* **Zero-PII Gateway Forwarding**:
  * `sanitizePatientContext()` in `cdsBridgeService.js` explicitly strips patient name, email, phone, physical address, and database primary keys.
  * Only minimum necessary clinical tokens (`age`, `gender`, `symptoms`, `allergies`, `active_medications`, `diagnoses`) are forwarded to FastAPI.
* **Knowledge Base Invariant**:
  * Patient clinical records are strictly ephemeral and request-scoped. They NEVER enter the persistent FAISS vector index or BM25 index.

---

## 6. Multilingual Architecture

The multilingual foundation is a **cross-cutting layer**, NOT a separate vector knowledge base.

```text
User Input (en / hi / mr)
       │
       ▼
1. Language Detection (Deterministic Script + Marker N-Grams)
       │
       ▼
2. Indic Safety Diversion (Emergency Triage & Prompt Injection)
       │
       ▼
3. Canonical Medical Representation (Preserves Drugs, Doses, Units, Negations)
       │
       ▼
4. Frozen RAG V2.10 Core (DailyMed 2,204 Chunks)
       │
       ▼
5. Response Localization & Safe Template Injection
       │
       ▼
Client Receives Verified Grounded Response in Target Language
```

* **Trilingual Safety Templates**: Emergency advice (112/108), prompt injection blocks, and drug interactions are formatted from pre-verified deterministic templates.
* **Corpus Invariant**: The single English DailyMed SPL index remains authoritative.

---

## 7. Current Test Baseline

All of the following suites pass 100% in the live environment:

| Test Suite | Execution Command | Result |
| :--- | :--- | :---: |
| RAG Regression Suite | `pytest rag_module/tests/ -q` | **190 Passed, 2 Skipped, 0 Failed** |
| CDS Gateway Suite | `pytest cds_module/ -v` | **9/9 Passed** |
| Express Bridge Suite | `node scratch/test_phase3_express_bridge.js` | **7/7 Passed** |
| Portal Responsibilities | `node scratch/test_portal_cds_responsibilities.js` | **25/25 Passed** |
| Doctor Portal E2E | `node scratch/test_doctor_portal_e2e.js` | **26/26 Passed** |
| Multilingual Suite | `pytest multilingual_module/tests/ -v` | **16/16 Passed** |
| Doctor Frontend Build | `npm run build` (Doctor Portal) | **0 Errors** (225ms) |
| Root Frontend Build | `npm run build` (Root Frontend) | **0 Errors** (982ms) |

---

## 8. Known Limitations (Documented, Not Bugs)

1. **Conservative Over-Abstention (~38%)**:
   * The local 1.1B generator occasionally generates conversational preambles that fail exact token verification. The `AnswerGroundingVerifier` intercepts these fail-closed (`withheld_verification_failure`) rather than risk hallucination leakage.
2. **Cross-Encoder Cold-Start Latency**:
   * Initial request incurs ~1.5s cold-start model load before entering warm execution (~150ms).
3. **Indic Slang & Complex Dialects**:
   * Highly colloquial Hindi/Marathi phrasing lacking standard clinical roots defaults to conservative fail-closed policy abstentions.

---

## 9. Next Steps for Incoming Developers

1. **Do NOT Rewrite Working Architecture**:
   * Maintain working Express controllers, CDS orchestrator logic, and RAG verification.
2. **Await Teammate Modules (Phase 4 & Phase 5)**:
   * When Patient or Receptionist modules arrive, follow [`docs/INTEGRATION_PLAN.md`](file:///E:/Major%20Project%20Code/docs/INTEGRATION_PLAN.md).
   * Verify that new code respects existing foreign keys and passes all regression test gates.
3. **Maintain Zero-PII Boundary**:
   * Ensure any newly added endpoints sanitize patient data before contacting FastAPI.
