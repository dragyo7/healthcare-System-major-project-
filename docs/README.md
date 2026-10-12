# Clinical Decision Support System — Documentation Map

> **Master Documentation Index & Architectural Knowledge Base**  
> **Project**: Modular AI-Powered Multilingual Clinical Decision Support System (4th-Year Major Project)  
> **Last Updated**: October 2026  

---

## 1. Core Project Governance & Architecture

| Document | Classification | Description |
| :--- | :---: | :--- |
| [`CURRENT_STATE.md`](file:///E:/Major%20Project%20Code/docs/CURRENT_STATE.md) | **ACTIVE / AUTHORITATIVE** | Canonical project inventory: what is built, tested, frozen, and waiting. |
| [`ROADMAP.md`](file:///E:/Major%20Project%20Code/docs/ROADMAP.md) | **ACTIVE / PLANNING** | Complete multi-phase roadmap (Phases 0 through 9). |
| [`DO_NOT_BREAK.md`](file:///E:/Major%20Project%20Code/docs/DO_NOT_BREAK.md) | **ACTIVE / CRITICAL** | Actionable constraints, non-negotiable security boundaries, and freeze rules. |
| [`PROJECT_CONTEXT.md`](file:///E:/Major%20Project%20Code/docs/PROJECT_CONTEXT.md) | **ACTIVE / CONTEXT** | Comprehensive engineering manual for future developers and AI coding agents. |
| [`INTEGRATION_PLAN.md`](file:///E:/Major%20Project%20Code/docs/INTEGRATION_PLAN.md) | **ACTIVE / PLANNING** | Ingestion guidelines and acceptance criteria for upcoming teammate modules. |
| [`ARCHITECTURE.md`](file:///E:/Major%20Project%20Code/docs/ARCHITECTURE.md) | **ACTIVE / ARCHITECTURE** | System architecture and network topology. |
| [`DECISIONS.md`](file:///E:/Major%20Project%20Code/docs/DECISIONS.md) | **ACTIVE / ARCHITECTURE** | Architectural Decision Records (ADRs). |

---

## 2. Security, Authorization & API Boundaries

| Document | Classification | Description |
| :--- | :---: | :--- |
| [`SECURITY_AND_AUTHORIZATION.md`](file:///E:/Major%20Project%20Code/docs/SECURITY_AND_AUTHORIZATION.md) | **ACTIVE / AUTHORITATIVE** | Deep-dive on BOLA prevention, server-side RBAC, and Zero-PII sanitization. |
| [`INTEGRATION_CONTRACT.md`](file:///E:/Major%20Project%20Code/docs/INTEGRATION_CONTRACT.md) | **ACTIVE / SPECIFICATION** | Pydantic request/response schemas for `/cds/evaluate`. |
| [`API_REFERENCE.md`](file:///E:/Major%20Project%20Code/docs/API_REFERENCE.md) | **ACTIVE / SPECIFICATION** | RAG API endpoint specifications (`/rag/query`, `/chat`, `/health`). |
| [`API_SURFACE.md`](file:///E:/Major%20Project%20Code/docs/API_SURFACE.md) | **ACTIVE / SPECIFICATION** | Full HTTP endpoint matrix across Express, FastAPI, and standalone engines. |
| [`DATA_MODEL.md`](file:///E:/Major%20Project%20Code/docs/DATA_MODEL.md) | **ACTIVE / SPECIFICATION** | Relational MySQL EHR schema and Pydantic object models. |

---

## 3. Subsystem Specifications & Verifications

| Document | Classification | Description |
| :--- | :---: | :--- |
| [`DOCTOR_PORTAL_E2E_VERIFICATION.md`](file:///E:/Major%20Project%20Code/docs/DOCTOR_PORTAL_E2E_VERIFICATION.md) | **ACTIVE / EVALUATION** | 26-test E2E verification report covering Doctor portal workflows and browser proof. |
| [`MULTILINGUAL_ARCHITECTURE.md`](file:///E:/Major%20Project%20Code/docs/MULTILINGUAL_ARCHITECTURE.md) | **ACTIVE / ARCHITECTURE** | Cross-cutting multilingual foundation spec (English, Hindi, Marathi). |
| [`RETRIEVAL_ARCHITECTURE.md`](file:///E:/Major%20Project%20Code/docs/RETRIEVAL_ARCHITECTURE.md) | **ACTIVE / ARCHITECTURE** | Hybrid RRF + Cross-Encoder retrieval and RAG V2.10 freeze specifications. |
| [`CORPUS_STRUCTURE.md`](file:///E:/Major%20Project%20Code/docs/CORPUS_STRUCTURE.md) | **ACTIVE / CONTEXT** | DailyMed SPL monograph knowledge base structure (2,204 chunks). |
| [`KNOWLEDGE_BASES.md`](file:///E:/Major%20Project%20Code/docs/KNOWLEDGE_BASES.md) | **ACTIVE / CONTEXT** | Authoritative data sources: DailyMed, DrugBank, SIDER, ICMR. |
| [`DATA_PROVENANCE.md`](file:///E:/Major%20Project%20Code/docs/DATA_PROVENANCE.md) | **ACTIVE / CONTEXT** | Source lineage and SPL set ID mapping for DailyMed chunks. |

---

## 4. Historical Audits & Archives (`docs/archive/`)

The `docs/archive/` directory preserves all historical development records, benchmark runs, and phase closure reports:

* [`archive/DEEP_CDS_SYSTEM_ASSESSMENT.md`](file:///E:/Major%20Project%20Code/docs/archive/DEEP_CDS_SYSTEM_ASSESSMENT.md): Comprehensive system audit of earlier prototype phases.
* [`archive/RAG_V2.9_EMPIRICAL_EVALUATION.md`](file:///E:/Major%20Project%20Code/docs/archive/RAG_V2.9_EMPIRICAL_EVALUATION.md): Historical benchmark documenting grounding verification rates.
* [`archive/MANUAL_RAG_VERIFICATION.md`](file:///E:/Major%20Project%20Code/docs/archive/MANUAL_RAG_VERIFICATION.md): Manual query audit records.
* [`archive/FUTURE_MULTIMODAL.md`](file:///E:/Major%20Project%20Code/docs/archive/FUTURE_MULTIMODAL.md): Preliminary research notes for vision/multimodal extensions.
* [`archive/phase_audits/`](file:///E:/Major%20Project%20Code/docs/archive/phase_audits/): 25 historical phase audit reports tracking RAG V1 through V2.10 development milestones.
