# INTEGRATION CONTRACT — SYSTEM BOUNDARIES & GOVERNANCE

**Document Status**: Canonical Integration Baseline  
**Authority**: Master Integration Specification  
**Version**: `1.0.0`  

---

## 1. System Responsibility Matrix ("Who Owns What?")

The platform enforces strict physical and operational boundaries between the Electronic Health Record (EHR) tier and the Clinical Decision Support (CDS) intelligence tier.

| Functional Responsibility | Authoritative Owner | Execution Environment | Storage / State |
|---|---|---|---|
| **User Authentication & Session Tokens** | Express Application Backend | Node.js (Port 5000) | `users` (bcrypt hashes), JWTs |
| **Role-Based Access Control (RBAC)** | Express Application Backend | Node.js (Port 5000) | JWT Claims (`role`) |
| **Patient Access Authorization** | Express Application Backend | Node.js (Port 5000) | `appointments`, `prescriptions` |
| **Patient & EHR CRUD Operations** | Express Application Backend | Node.js (Port 5000) | MySQL Database (`rag_healthcare`) |
| **Prescription Persistence & History** | Express Application Backend | Node.js (Port 5000) | `prescriptions`, `prescription_medicines` |
| **Prescription PDF Generation** | Express Application Backend | Node.js (Port 5000) | PDFKit streaming |
| **Medical Report File Storage & Serving** | Express Application Backend | Node.js (Port 5000) | Filesystem (`uploads/reports/`) |
| **Clinical Decision Orchestration** | FastAPI CDS Gateway | Python 3.12 (Port 8000) | Stateless coordination (`/cds/evaluate`) |
| **Medical Knowledge Retrieval (RAG)** | Medical RAG Engine (v2.10) | Python 3.12 (Port 8000) | FAISS Index (`2,204` vectors), BM25 |
| **Evidence Grounding Verification** | Answer Grounding Verifier | Python 3.12 (Port 8000) | Deterministic N-Gram Verifier (Fail-Closed) |
| **Drug-Drug Interaction Detection** | Drug Safety Module | Python 3.12 (Port 8001) | Deterministic Clinical Rules (8 verified) |
| **Adverse Effect / Contraindication Lookup**| Drug Safety Module | Python 3.12 (Port 8001) | 20 SIDER Profiles, DailyMed Rules |
| **Free-Text Prescription NLP Parsing** | Prescription Module | Python 3.12 (Port 8002) | 37-Drug Clinical Rule Engine |
| **Presentation & User Interaction** | React Client Frontends | Browser / Vite | React State, browser `localStorage` |

> [!CRITICAL]
> **RULE: React clients must NEVER call internal RAG or safety services directly.**
> All communication with clinical AI endpoints MUST route through the authenticated application backend to ensure credential protection, audit logging, and server-side context minimization.

---

## 2. Patient Context Boundary (Data Minimization)

Express is solely responsible for packaging patient context before invoking `POST /cds/evaluate`. The payload transmitted across the internal network boundary is strictly governed:

```text
               DATABASE RECORD (MySQL)
                         │
                         ▼
        ┌──────────────────────────────────┐
        │ Express Sanitization Middleware  │
        └────────────────┬─────────────────┘
                         │
        ┌────────────────┴─────────────────┐
        ▼                                  ▼
TRANSMITTED TO CDS GATEWAY           STRICTLY BLOCKED / STRIPPED
• Age (derived integer)              • Patient Full Name (`full_name`)
• Gender (`p.gender`)                • Phone Number (`phone`)
• Current Symptoms (`s.symptoms`)    • Email Address (`email`)
• Active Diagnoses (`condition_name`)• Residential Address (`address`)
• Known Allergies (`allergies`)      • Emergency Contact Phone
• Prescribed Meds (`medicine_name`)  • National Identity / Aadhaar
• Doctor's Clinical Query Text       • Internal MySQL User IDs
```

### Storage Governance Rule:
- **Patient records are NOT globally indexed into the medical RAG corpus.**
- The RAG FAISS index contains exclusively published, peer-reviewed medical monographs and guidelines (DailyMed, ICMR, MedlinePlus, MoHFW).
- Patient context acts solely as runtime prompt constraints passed to the verifier, never as persistent retrievable vectors.

---

## 3. Role Architecture & Mode Governance

The system defines three distinct user portals with non-overlapping access boundaries:

### 3.1 Doctor Portal: Full Clinical Decision Support (`mode: "doctor"`)
- **Users**: Licensed, authenticated physicians.
- **Workflow**:
  $$\text{Authorized Patient Dossier} + \text{Doctor Query} \longrightarrow \text{CDS Gateway} \longrightarrow \text{Full Evidence RAG} + \text{Safety Flags}$$
- **Capabilities**: Unrestricted clinical inquiry, drug interaction screening, prescription creation, monograph evidence viewing with clickable DailyMed/ICMR citations.

### 3.2 Patient Portal: Restricted Patient Mode (`mode: "patient"`)
- **Users**: Authenticated discharged patients.
- **Workflow**:
  $$\text{Own Discharge Instructions} + \text{Patient Question} \longrightarrow \text{CDS Gateway} \longrightarrow \text{Restricted Guidance} + \text{Emergency Protocols}$$
- **Capabilities**:
  - Inquiries restricted strictly to post-discharge recovery, self-care precautions, and medication schedule clarifications.
  - Policy strictly blocks doctor-level differential diagnosis, off-label guidance, or exploratory drug recommendations.
  - Zero access to other patient records.
  - Intercepts acute symptoms immediately with emergency hotline triage.
- **Status**: Target functionality; currently under design.

### 3.3 Receptionist Portal: Administrative Operations
- **Users**: Hospital administrative and intake staff.
- **Capabilities**:
  - Patient registration and demographic updates.
  - Consultation appointment booking and cancellation.
  - Physician schedule viewing and room coordination.
  - **Zero access to Medical RAG, Clinical Decision Support, or Drug Safety intelligence.**
- **Status**: **Not yet audited — no implementation claims made.**

---

## 4. Prescription Subsystem Architecture

The prescription workflow cleanly decouples operational EHR transactions from pharmacological safety validation:

```text
Doctor fills Prescription Form in React
                  │
                  ▼
[ Step 1: Pre-Save Pharmacological Screening ]
  Express calls FastAPI: POST /cds/screen-prescription
  ├── 1. Normalize candidates via RxNorm (e.g. Lipitor -> atorvastatin)
  ├── 2. Deterministic pairwise evaluation (8 verified DrugBank rules)
  └── 3. Contraindication check against patient allergies (e.g. Penicillin)
                  │
                  ▼
Does Candidate Prescription Present High-Severity Hazards?
  ├── YES ──► Display Clinical Alert Modal to Clinician (Evidence & Guidance)
  │           Clinician selects: [Modify Medication] OR [Document Override Reason]
  │
  └── NO (or Overridden)
                  │
                  ▼
[ Step 2: Database Persistence ]
  Express executes MySQL Transaction:
  ├── INSERT INTO prescriptions (doctor_id, patient_id, diagnosis, notes)
  └── INSERT INTO prescription_medicines (prescription_id, medicine_name, dosage, ...)
                  │
                  ▼
[ Step 3: Document Generation ]
  Express streams formatted PDF via PDFKit:
  GET /api/doctor/prescriptions/:id/pdf
```

> [!IMPORTANT]
> **Deterministic Priority**: The Medical RAG engine must **never** serve as the authority for drug interaction detection. The deterministic Python rule engine (`drug_module`) is the sole authority. RAG is consulted only if the clinician explicitly requests an in-depth mechanistic explanation of an identified interaction.

---

## 5. Similar Patient / Case Retrieval Scope

- **Status**: **`FUTURE / OPTIONAL (NOT IMPLEMENTED)`**
- **Evaluation**: The current demo database contains exactly 2 patients and 6 appointments. Implementing similarity search over 2 rows is technically meaningless.
- **Future Architecture**: If case-based reasoning is introduced in a future phase:
  1. It must use a dedicated, de-identified clinical case dataset (ICD-10 / SNOMED-CT coded).
  2. It must exist as a separate `case_retrieval_module` with its own isolated vector space.
  3. It must **never** mix with the global medical knowledge RAG index.

---

## 6. Frozen Medical RAG Baseline (V2.10)

The medical intelligence pipeline is **HARD FROZEN** at commit `497a547` and must not be modified during portal integration:

```text
Query
 ↓
Safety Interceptors (Emergency Triage Keywords & Prompt Injection Defense)
 ↓
Clinical Entity Normalizer (RxNorm: brand -> generic)
 ↓
Dense Retrieval (FAISS IndexFlatIP, 2,204 chunks, BAAI/bge-small-en 384D)
 +
Sparse Retrieval (BM25Okapi, 2,204 records)
 ↓
Reciprocal Rank Fusion (RRF, k=60)
 ↓
Cross-Encoder Reranker (ms-marco-MiniLM-L-6-v2)
 ↓
Evidence Policy Engine (Entity isolation & coverage thresholds)
 ↓
Local LLM Generation (TinyLlama-1.1B-Chat)
 ↓
Deterministic Answer Grounding Verifier (N-Gram citation verification)
 ↓
Verified Grounded Answer / Fail-Closed Abstention
```
- **Frozen Invariants**: Vector dimension (384), index size (2,204 chunks), corpus sources (DailyMed: 2,176; MedlinePlus: 16; ICMR: 8; MoHFW: 4), fail-closed abstention thresholds, emergency triage interception.
