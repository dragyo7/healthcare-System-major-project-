# PROJECT CONTEXT — HEALTHCARE CLINICAL DECISION SUPPORT PLATFORM

## 1. Project Purpose & Scope

This repository houses a **4th-Year Major Project**: a modular, safety-first **Clinical Decision Support (CDS) System**.

The platform is designed to assist healthcare professionals and patients with evidence-grounded medical guidance, medication safety screening, and structured prescription analysis.

### Primary Objectives
1. **Evidence-Grounded Clinical Intelligence (RAG)**: Retrieve authentic, citation-backed clinical guidelines and FDA monographs with strict fail-closed hallucination prevention.
2. **Medication Safety & Interaction Engine (`drug_module`)**: Multi-drug interaction screening and adverse effect lookups based on verified pharmacological rules.
3. **Prescription Parsing & Dosing Extraction (`prescription_module`)**: Deterministic extraction of medication details (drug name, strength, route, frequency, duration) from clinical notes.
4. **Clinical Web Portal (`frontend`)**: Role-based interface for clinicians and patients featuring an interactive CDS Assistant and Drug Checker.

---

## 2. Major Modules & Technology Stack

| Module | Core Responsibility | Technology Stack | Baseline Status |
| :--- | :--- | :--- | :--- |
| **`rag_module`** | Dual-index hybrid retrieval, cross-encoder reranking, emergency/injection safety guardrails, local LLM generation, and deterministic grounding verification. | Python 3.11+, PyTorch, BAAI/bge-small-en, FAISS (IndexFlatIP), rank-bm25, Cross-Encoder (`ms-marco-MiniLM-L-6-v2`), TinyLlama-1.1B, FastAPI | **v2.10 Frozen Baseline** (190 regression tests passing) |
| **`drug_module`** | Rule-based drug-drug interaction detection, severity classification, and SIDER adverse reaction profiles. | Python, FastAPI, DrugBank rules, SIDER 4.1 dataset | **Implemented Baseline** (8 rules, 20 profiles) |
| **`prescription_module`** | Deterministic regex and rule-based NLP entity extraction from free-text prescriptions into structured JSON dosing models. | Python, FastAPI, Regex rule engine, Pydantic | **Implemented Baseline** (FastAPI service) |
| **`frontend`** | Role-based clinical web portal with Doctor Dashboard, interactive conversational CDS Assistant, and Drug Checker. | React 19, Vite 8, Tailwind CSS v4, Lucide React, Axios | **Integrated & E2E Verified** (Vite production build verified) |
| **`data/`** | Production vector indices, DailyMed monographs, metadata archives, and medication interaction JSON rules. | FAISS binary index, Pickle metadata, JSON catalogs | **Production Locked** (2,204 chunks indexed) |

---

## 3. Core Architectural Constraints & Safety Rules

1. **Deterministic Safety Before Generative Language**:
   * All clinical safety checks (acute emergency triage, prompt injection defense, drug interaction alerts, entity existence) must be evaluated deterministically before generative LLMs are invoked.
2. **Fail-Closed Clinical Policy**:
   * When clinical evidence is absent, weak, contradictory, or out-of-domain, the system must deterministically abstain (`generation_allowed = False`) with machine-readable reason codes rather than guessing.
3. **Strict Attribution & Provenance**:
   * Every clinical claim presented to the clinician must trace to an authentic source monograph (DailyMed SPL Set ID, section title, and URL). Zero metadata fabrication is permitted.
4. **Physician-in-the-Loop Constraint**:
   * The platform is a clinical decision support prototype and does not replace licensed medical judgement or provide autonomous diagnostic decisions.

---

## 4. Key Terminology

* **CDS**: Clinical Decision Support.
* **DailyMed**: Official FDA published package inserts and drug label monographs.
* **SPL**: Structured Product Labeling (FDA format).
* **RRF**: Reciprocal Rank Fusion ($k=60$) used to merge dense semantic and sparse lexical search results.
* **Fail-Closed**: A safety design pattern where uncertainty or verification failure causes the system to safely withhold answers rather than risking hallucination.
* **Grounding Decision**: A machine-readable evaluation contract determining whether generation is permitted based on retrieved evidence coverage.

---

## 5. Current High-Level Phase

* **Phase 1: RAG v2.10 Core & Doctor Frontend Integration**: **COMPLETED & VERIFIED**.
* **Phase 2: CDS Platform Integration (NEXT)**:
  * Consolidated CDS Gateway.
  * Live Drug Interaction Engine integration in frontend.
  * Prescription parsing to safety screening workflow in CDS Assistant.
