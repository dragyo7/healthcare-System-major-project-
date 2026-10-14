# MODULE CONTEXT — DOCTOR PORTAL (EHR & CDS INTEGRATION POINT)

**Module Name**: Doctor Portal / Doctor-Side EHR Module  
**Package Origin**: `Portal Major P/Bhumi/Doctor portal.zip`  
**Module Type**: Operational Electronic Health Record (EHR) & Clinician Workflow Management  
**Current Role in System**: EHR Application Foundation & Future Clinical Decision Support (CDS) Consumer  

---

## 1. Module Purpose & Problem Solved

The Doctor Portal provides the clinical operational interface for authenticated physicians. It solves the challenge of centralized patient management by providing an Electronic Health Record (EHR) interface where a clinician can:
- Authenticate securely via credential verification (bcrypt + JWT).
- Review operational dashboard metrics (total patients, completed consultations, upcoming appointments).
- Search and browse assigned patient records.
- Inspect comprehensive patient clinical dossiers (personal demographics, chronic conditions, recorded symptoms, previous prescriptions, uploaded lab reports).
- Prescribe multi-drug treatment plans within database transactions.
- Stream generated prescription documents dynamically as formatted PDFs via PDFKit.
- Manage weekly clinic availability slots and consultation appointments.

---

## 2. Core Architectural Distinction: EHR vs. Medical Intelligence

> [!IMPORTANT]
> **The Doctor Portal is an EHR application portal. It is NOT the Medical RAG system.**

The Doctor Portal provides operational data persistence and user interaction. The medical intelligence stack (Evidence RAG, Drug Safety, Drug-Drug Interaction Checking) lives entirely in a separate, frozen Python/FastAPI subsystem.

| Characteristic | Doctor Portal (EHR) | Medical RAG & Safety Stack |
|---|---|---|
| **Primary Domain** | Application records & patient workflows | Evidence retrieval, clinical guidelines & drug safety |
| **Technology** | Node.js, Express 5.2.1, MySQL 8.0, React 19 | Python 3.12, FastAPI, PyTorch, FAISS, BM25 |
| **Data Owned** | Patient profiles, appointments, prescriptions | DailyMed monographs, MedlinePlus, ICMR guidelines |
| **Determinism** | Relational CRUD & transactional persistence | Deterministic safety rules + Grounded generation verifier |
| **Direct AI/ML** | **Zero AI/ML code present** | Vector embeddings, lexical search, cross-encoder rerank |

---

## 3. Current Responsibilities vs. Non-Responsibilities

### What This Module DOES Today:
- Authenticates doctors using credentials stored in MySQL `users`.
- Maintains doctor profiles (specialization, qualification, license number, experience).
- Queries MySQL relational tables to present patient clinical summaries.
- Records structured prescription rows into `prescriptions` and `prescription_medicines`.
- Streams formatted prescription PDFs directly over HTTP.
- Updates appointment statuses (`scheduled`, `completed`, `cancelled`).
- Maintains doctor schedule slots (`doctor_schedule`).
- Serves static medical reports stored in local filesystem storage.

### What This Module DOES NOT Do:
- **No Clinical Decision Support (CDS)**: Does not provide AI-driven clinical reasoning, diagnostic suggestions, or treatment recommendations.
- **No Drug-Drug Interaction Detection**: Does not screen prescribed drug combinations for pharmacological conflicts before persistence.
- **No Drug Safety / Contraindication Validation**: Does not verify whether a prescribed drug conflicts with patient allergies or comorbidities.
- **No Evidence Retrieval / RAG**: Has no vector database, no embedding pipeline, and no medical literature retrieval.
- **No Free-Text NLP Parsing**: Does not parse unstructured clinical prescription text.
- **No Patient Self-Service**: Does not provide patient-facing portal access or post-discharge assistance.
- **No Receptionist Operations**: Does not support administrative intake, billing, or front-desk scheduling.

---

## 4. Relationship to Overall Healthcare Platform

The final 4th-Year Major Project consists of three role-specific portals coordinated through an application backend and a central clinical intelligence gateway:

```text
                           HEALTHCARE PLATFORM TOPOLOGY
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
   ┌───────────────┐            ┌───────────────┐            ┌───────────────┐
   │ DOCTOR PORTAL │            │ PATIENT PORTAL│            │ RECEPTIONIST  │
   │  (Active EHR) │            │ (Post-Disch.) │            │    PORTAL     │
   │  • Full CDS   │            │• Restricted AI│            │• Admin Only   │
   └───────┬───────┘            └───────┬───────┘            └───────┬───────┘
           │                            │                            │
           └────────────────────┬───────┴────────────────────────────┘
                                │ HTTP / JSON / Bearer JWT
                                ▼
                   ┌─────────────────────────┐
                   │ EXPRESS APPLICATION     │
                   │ BACKEND (Port 5000)     │
                   │ • Auth & RBAC           │
                   │ • Patient Access Control│
                   │ • EHR Relational CRUD   │
                   └────────────┬────────────┘
                                │
                 Internal HTTP  │  MySQL Queries
                 (Port 8000)    │  (Port 3306)
                                │
               ┌────────────────┴───────────────┐
               ▼                                ▼
┌─────────────────────────────┐  ┌─────────────────────────────┐
│ FASTAPI CDS GATEWAY         │  │ APPLICATION DATABASE        │
│ • Unified /cds/evaluate     │  │ (MySQL: rag_healthcare)     │
│ • Context Sanitization      │  │ • users, doctors, patients  │
│ • Dispatches RAG & Safety   │  │ • prescriptions, appts      │
└──────────────┬──────────────┘  └─────────────────────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
┌──────────────┐ ┌──────────────┐
│ FROZEN RAG   │ │ DRUG SAFETY  │
│ (DailyMed/   │ │ (Interaction │
│  ICMR/MoHFW) │ │  Rules/openFDA)
└──────────────┘ └──────────────┘
```

1. **Relationship to Medical RAG**: The Doctor Portal is the *primary clinical consumer* of RAG outputs. It will never invoke RAG directly from React. Requests will route via Express to the FastAPI CDS Gateway, which returns verified, evidence-grounded recommendations.
2. **Relationship to Future Patient Portal**: The Doctor Portal creates the diagnoses, prescriptions, and instructions that the Patient Portal will eventually consume in *Restricted Patient Mode* for post-discharge inquiries.
3. **Relationship to Future Receptionist Portal**: The Doctor Portal provides schedule availability (`doctor_schedule`) and consultation records that the Receptionist Portal will book and coordinate.

---

## 5. Technology Stack & Ownership Boundary

| Layer | Component | Technology / Library | Version | File Location |
|---|---|---|---|---|
| **Frontend** | Doctor UI | React, Vite | React 19.2.8, Vite 8.3.0 | `Doctor portal/frontend/` |
| **Styling** | UI CSS | Vanilla CSS | Custom | `frontend/src/App.css`, `index.css` |
| **Backend** | API Server | Node.js, Express | Express 5.2.1 | `Doctor portal/backend/src/app.js` |
| **Database** | Relational Store | MySQL 8.0, mysql2 pool | mysql2 3.24.4 | `backend/src/config/db.js` |
| **Auth** | Password & JWT | bcrypt, jsonwebtoken | bcrypt 6.0.0, jwt 9.0.3 | `backend/src/middleware/authMiddleware.js` |
| **Export** | PDF Generator | PDFKit | pdfkit 0.20.2 | `backend/src/controllers/doctorController.js` |
| **Storage** | Medical Reports | Local Filesystem Static | Native Express Static | `backend/uploads/reports/` |

**Module Ownership**: Teammate-owned package (`Bhumi`). Preserved as the working EHR foundation without unsolicited architectural rewriting.
