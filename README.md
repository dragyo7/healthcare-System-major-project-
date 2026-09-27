# Modular AI-Powered Clinical Decision Support (CDS) System

[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Vite 8](https://img.shields.io/badge/Vite-8.0-646cff.svg)](https://vitejs.dev/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0%2B-ee4c2c.svg)](https://pytorch.org/)
[![FAISS](https://img.shields.io/badge/FAISS-1.7%2B-008080.svg)](https://github.com/facebookresearch/faiss)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688.svg)](https://fastapi.tiangolo.com/)

A modular, evidence-grounded **Clinical Decision Support (CDS) System** engineered for healthcare professionals and patients. Built as a 4th-Year Major Project, the platform combines deterministic rule engines with an evidence-bound Retrieval-Augmented Generation (RAG) intelligence layer, enforcing strict fail-closed safety and authentic source attribution.

---

## Architecture Overview

```text
                                  FRONTEND
                      (React 19 + Vite 8 on port 5173)
                                     │
                                     ▼
                               API / GATEWAY
                      (FastAPI /chat on port 8000)
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          ▼                          ▼                          ▼
     rag_module                 drug_module            prescription_module
(Evidence RAG v2.10)        (Drug Safety Engine)       (Prescription Parser)
   • FAISS (2,204 chunks)      • 8 Interaction Rules       • Entity Extraction
   • BM25 Lexical Search       • 20 SIDER Profiles         • Regex Rule Engine
   • RRF Fusion (k=60)         • Severity Classifier       • Structured Dosing
   • Cross-Encoder Rerank
   • Grounding Verifier
          └──────────────────────────┬──────────────────────────┘
                                     ▼
                               CLINICAL DATA
                (data/ — FAISS indices, DailyMed, Rules)
```

---

## Key System Modules

1. **Evidence-Grounded Medical Intelligence (`rag_module`)**:
   * **Dual-Index Hybrid Retrieval**: Combines semantic embeddings (`BAAI/bge-small-en`, 384D) via FAISS with lexical precision via `BM25Okapi`.
   * **Rank Fusion & Reranking**: Merges candidates using Reciprocal Rank Fusion ($k=60$) followed by a cross-encoder reranker (`cross-encoder/ms-marco-MiniLM-L-6-v2`).
   * **Authoritative Knowledge Base**: Ingests 2,204 authentic chunks from FDA DailyMed monographs, ICMR guidelines, MoHFW guidelines, and MedlinePlus.
   * **Deterministic Grounding Verifier**: Verifies factual propositions of generator outputs (`TinyLlama-1.1B-Chat`) against retrieved context before presentation.
2. **Medication Safety & Interaction Engine (`drug_module`)**:
   * Multi-drug interaction screening and severity classification based on DrugBank and SIDER 4.1 clinical rules.
3. **Prescription Parsing & Extraction (`prescription_module`)**:
   * Deterministic entity extraction parsing free-text prescriptions into structured dosing records (drug name, strength, route, frequency, duration).
4. **Clinical Web Portal (`frontend`)**:
   * Modern React 19 + Vite + Tailwind CSS interface featuring a dedicated Doctor Dashboard, conversational CDS Assistant, and interactive Drug Checker.

---

## Safety & Fail-Closed Guardrails

In clinical workflows, an incorrect answer is far more dangerous than a refusal to answer:
* **Emergency Triage Interception**: Pre-retrieval pattern matching immediately diverts acute crises (e.g., chest pain, caustic ingestion, stroke symptoms) to emergency care protocols.
* **Prompt-Injection Defense**: Early sanitization halts adversarial jailbreaks and instruction manipulation before retrieval or LLM execution.
* **Fail-Closed Policy Abstention**: If an entity is unindexed or evidence is insufficient, the system safely abstains with machine-readable reason codes (`generation_allowed = False`).
* **Zero Hallucination Tolerance**: Unverified factual claims are withheld by the verifier (`0 / 100` hallucination leakage on standardized benchmark).
* **Strict Attribution**: Every clinical response renders authentic DailyMed monograph titles, section names, and SPL SetIDs.

---

## Getting Started

### Prerequisites
* Python 3.11+
* Node.js 18+ and npm
* Git

### 1. Clone Repository
```powershell
git clone https://github.com/dragyo7/healthcare-System-major-project-.git
cd healthcare-System-major-project-
```

### 2. Backend Setup
```powershell
# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Start RAG API backend on port 8000
python -m uvicorn rag_module.api:app --host 127.0.0.1 --port 8000 --reload
```
* **Interactive Swagger Docs**: `http://127.0.0.1:8000/docs`
* **Health Check**: `http://127.0.0.1:8000/health`

### 3. Frontend Setup
```powershell
cd frontend
npm install
npm run dev
```
* **Clinical Web Portal**: `http://localhost:5173`
* **Demo Clinician Login**: `doctor@medai.com` / `password123`

---

## Running Tests

### Backend Regression Test Suite
```powershell
python -m pytest rag_module/tests/ -v
```
* **Test Status**: `190 passed, 2 skipped, 0 failed` in ~211s.

### Frontend Production Build
```powershell
cd frontend
npm run build
```
* **Build Status**: Clean production build in `< 7s`.

---

## Project Status & Roadmap

* [x] **RAG v2.10 Core Freeze**: Hybrid retrieval, cross-encoder, fail-closed verifier, 100-query benchmark.
* [x] **RAG API Hardening**: Simplified `/chat` contract, brand alias normalization, injection early-block.
* [x] **Doctor Frontend Integration**: Live conversational assistant, dynamic safety banners, citation cards.
* [x] **Hard E2E Validation**: 8-query field-by-field verification, zero mock answers.
* [ ] **Phase 2 (Current Focus)**:
  * **Unified CDS Gateway**: Consolidated endpoint uniting RAG, Drug Safety, and Prescription extraction.
  * **Live Drug Checker**: Connecting patient/doctor drug checkers to `drug_module`.
  * **Prescription-to-Safety Workflow**: Paste prescription $\to$ parse entities $\to$ screen interactions $\to$ 1-click RAG guidelines.
