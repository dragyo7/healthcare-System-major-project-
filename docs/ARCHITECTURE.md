# SYSTEM ARCHITECTURE — UNIFIED TIER ISOLATION SPECIFICATION

> **Document Type**: Authoritative Technical Architecture Specification  
> **Status**: **VERIFIED LIVE ARCHITECTURE (Phase 0 through Phase 3 Operational)**  
> **Date**: October 2026  

---

## 1. Architectural Overview & Convergence

The healthcare platform operates as a secure, three-tier decoupled architecture:
1. **Clinical Portals**: Role-specific browser interfaces for Doctors, Patients, and Receptionists.
2. **Express Application Gateway**: Authoritative Node.js/Express + MySQL Electronic Health Record (EHR) gateway enforcing server-side authentication, RBAC, BOLA, and Zero-PII sanitization.
3. **FastAPI CDS Gateway**: Centralized clinical intelligence backend integrating deterministic medication safety (DrugBank, SIDER), the frozen RAG V2.10 engine (DailyMed SPL), and the cross-cutting multilingual layer (English, Hindi, Marathi).

```text
                                          CLINICAL FRONTENDS
                                                   │
                  ┌────────────────────────────────┴───────────────────────────────┐
                  │                                                                │
                  ▼                                                                ▼
      ┌───────────────────────┐                                        ┌───────────────────────┐
      │     DOCTOR PORTAL     │                                        │    PATIENT PORTAL     │
      │  (React / Vite :5173) │                                        │  (Pending Teammate)   │
      │  • EHR Dossier & CRUD │                                        │ • Restricted Patient  │
      │  • Embedded CDS Panel │                                        │   Mode Interface      │
      │  • Pre-Save Rx Alerts │                                        │ • Strict Safety Guard │
      └───────────┬───────────┘                                        └───────────┬───────────┘
                  │                                                                │
                  │ HTTP / Bearer JWT (Doctor)                                     │ HTTP / Bearer JWT (Patient)
                  ▼                                                                ▼
      ┌────────────────────────────────────────────────────────────────────────────────────────┐
      │                           APPLICATION BACKEND (Node.js / Express :5000)                │
      │  • User Authentication & JWT Issuance (Doctor, Patient, Receptionist)                  │
      │  • Server-Side Role-Based Access Control (RBAC)                                        │
      │  • Explicit Doctor-Patient Relationship Verification (BOLA Defense)                    │
      │  • EHR Relational Operations & Transactions                                            │
      │  • Static Report Access Protection (Binary Streamed)                                   │
      │  • Prescription PDF Generation (PDFKit)                                                │
      │  • Client to CDS Gateway: Sanitizes & minimizes clinical context (Zero PII)            │
      └──────────────────────────┬─────────────────────────────┬───────────────────────────────┘
                                 │                             │
                    MySQL (3306) │                             │ Internal HTTP (Zero PII)
                                 │                             │ (Port 8000)
                                 ▼                             ▼
      ┌─────────────────────────────────────┐   ┌──────────────────────────────────────────────┐
      │        APPLICATION DATABASE         │   │            FASTAPI CDS GATEWAY               │
      │          (MySQL 8.0 Engine)         │   │            (rag_module / cds)                │
      │  • users & doctors                  │   │  • Unified Route: POST /cds/evaluate         │
      │  • patients & demographics          │   │  • Multilingual Engine (en, hi, mr)          │
      │  • medical_history & symptoms       │   │  • Role Dispatch: 'doctor' vs. 'patient'     │
      │  • appointments & doctor_schedule   │   │  • Context Assembly: sanitizes clinical query│
      │  • prescriptions & medicines        │   │  • Pre-Save Interaction Screening Endpoint   │
      │  • medical_reports metadata         │   └──────────────┬────────────────┬──────────────┘
      └─────────────────────────────────────┘                  │                │
                                                               ▼                ▼
                                    ┌─────────────────────────────┐ ┌──────────────────────────┐
                                    │      FROZEN RAG MODULE      │ │   DRUG SAFETY ENGINE     │
                                    │      (Production V2.10)     │ │   (drug_module on 8001)  │
                                    │ • DailyMed (2,176 chunks)   │ │ • RxNorm Normalizer      │
                                    │ • MedlinePlus (16 chunks)   │ │ • 8 Interaction Rules    │
                                    │ • ICMR (8 chunks)           │ │ • 20 SIDER Profiles      │
                                    │ • MoHFW STG (4 chunks)      │ │ • openFDA Fallback       │
                                    │ • FAISS + BM25 + RRF (k=60) │ └──────────────────────────┘
                                    │ • Cross-Encoder Reranker    │
                                    │ • Grounding Verifier        │
                                    │ • Fail-Closed Safety        │
                                    └─────────────────────────────┘
```

---

## 2. Critical Architectural Distinction: Context Flow vs. RAG Indexing

> [!CAUTION]
> **CRITICAL ARCHITECTURAL DISTINCTION: PATIENT RECORDS ARE NEVER INDEXED INTO RAG.**
> It is strictly incorrect to state or document that *"anonymized clinical vectors are sent to RAG"* or that *"patient data is embedded into the vector database."*

### The True Context Flow:
1. **Storage Isolation**:
   * Patient records (diagnoses, symptoms, medications, lab summaries) reside **exclusively in MySQL**.
   * The RAG FAISS index contains **exclusively published, verified medical knowledge** (DailyMed monographs, ICMR clinical guidelines, MedlinePlus, MoHFW STGs).
2. **Dynamic Context Assembly**:
   * When a doctor submits a clinical inquiry, Express retrieves the authorized patient's clinical attributes from MySQL.
   * Express **sanitizes and minimizes** this context (stripping PII like name, address, phone) and transmits text fields (`symptoms`, `allergies`, `diagnoses`, `active_medications`) alongside the `doctor_query` to `POST /cds/evaluate`.
3. **Internal RAG Execution**:
   * The FastAPI CDS Gateway constructs the search prompt using the query and relevant clinical entities.
   * The RAG engine internally performs:
     $$\text{Query} \longrightarrow \text{Entity Normalization} \longrightarrow \text{Dense (BGE) + Lexical (BM25)} \longrightarrow \text{RRF Fusion} \longrightarrow \text{Cross-Encoder Rerank} \longrightarrow \text{TinyLlama Draft} \longrightarrow \text{Grounding Verifier}$$
   * Patient information acts as a **runtime prompt qualifier**, NOT a retrievable vector in the global FAISS index.

---

## 3. Why This Multi-Tier Boundary Exists

1. **HIPAA / Data Governance Compliance**:
   * Clinical knowledge (public medical guidelines) and Protected Health Information (private patient charts) have fundamentally different security, retention, and lifecycle requirements. Keeping them physically separated ensures patient data can never leak into vector index artifacts.
2. **Separation of Concerns**:
   * Node.js/Express excels at asynchronous relational I/O, session tokens, file streaming, and operational CRUD.
   * Python/FastAPI excels at linear algebra, tensor computation (PyTorch), vector similarity search (FAISS), and clinical NLP tokenization.
3. **Auditability & Explainability (Viva-Defensible)**:
   * Evaluators can clearly see:
     * Relational EHR layer handles operational healthcare governance.
     * Deterministic rule layer handles lethal drug interactions.
     * Grounded RAG layer handles evidence retrieval with strict fail-closed safety.
