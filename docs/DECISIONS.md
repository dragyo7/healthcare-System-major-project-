# ARCHITECTURAL DECISIONS LOG (ADR)

**Document Purpose**: Record of binding architectural decisions, rationales, and system implications.  
**Authority**: Master Architecture Alignment  

---

### D1: Operational EHR and Clinical Intelligence Remain Physically Separate
- **Decision**: The Node.js/Express application and the Python/FastAPI medical intelligence stack will remain independent, communicating via internal HTTP requests rather than being collapsed into a single monolith.
- **Reason**: Node.js is optimized for asynchronous relational I/O, session tokens, and PDF streaming. Python is required for PyTorch tensor computation, FAISS vector indexing, and Transformer reranking. Merging them into a single runtime would degrade maintainability.
- **Implication**: Express will act as an internal client to the FastAPI CDS Gateway (`/cds/evaluate`).
- **Status**: **ACCEPTED & BINDING**

---

### D2: RAG is Not the Patient Database
- **Decision**: Patient records (demographics, symptoms, history, prescriptions, lab reports) will reside exclusively in MySQL. They will **never** be inserted, embedded, or indexed into the global medical RAG FAISS index.
- **Reason**: The RAG index represents published, peer-reviewed clinical knowledge (DailyMed, ICMR, MedlinePlus, MoHFW). Mixing Protected Health Information (PHI) with public medical knowledge creates catastrophic data leakage and compliance risks.
- **Implication**: Patient context is sanitized into transient prompt text for runtime evaluation; no persistent patient vectors are created.
- **Status**: **ACCEPTED & BINDING**

---

### D3: Express Owns Authentication, RBAC, and Patient Authorization
- **Decision**: All identity verification, role enforcement, and patient data ownership checks will be performed server-side by the Express application backend.
- **Reason**: The frontend is an untrusted client environment. AI services are stateless and do not own the user credential database.
- **Implication**: The React client will never communicate directly with RAG or drug safety services. All requests must pass through Express middleware.
- **Status**: **ACCEPTED & BINDING**

---

### D4: FastAPI Owns Clinical Intelligence Orchestration
- **Decision**: A centralized endpoint (`POST /cds/evaluate`) in the Python FastAPI service will coordinate evidence retrieval, entity normalization, and safety validation.
- **Reason**: Prevents Express from having to manage multiple downstream calls to RAG, rerankers, and rule engines, providing a unified clinical decision contract.
- **Implication**: Express issues a single internal request to FastAPI and receives verified evidence and safety alerts.
- **Status**: **ACCEPTED & BINDING**

---

### D5: Drug-Drug Interaction Detection Remains Strictly Deterministic
- **Decision**: Pharmacological interaction detection and contraindication checks will be executed by deterministic rule engines (`drug_module`), not by generative LLMs.
- **Reason**: LLMs can hallucinate dosages, fail to recognize obscure drug pairings, or alter severity classifications. Patient safety mandates deterministic rule execution.
- **Implication**: The RAG engine will only provide supplemental biological mechanism explanations when requested; it will never serve as the safety authority.
- **Status**: **ACCEPTED & BINDING**

---

### D6: Patient Portal Operates in Restricted Patient Mode
- **Decision**: The future Patient Portal will have access to clinical AI infrastructure, but strictly bounded in **Restricted Patient Mode** for post-discharge assistance.
- **Reason**: Patients require clarification regarding their prescribed discharge medications and recovery precautions, but must not receive doctor-level differential diagnostic tools.
- **Implication**: The CDS Gateway will enforce strict prompt templates and policy constraints when `mode === 'patient'`.
- **Status**: **ACCEPTED & BINDING**

---

### D7: Receptionist Portal is Strictly Administrative
- **Decision**: The future Receptionist Portal will have zero access to Medical RAG, Clinical Decision Support, or Drug Safety capabilities.
- **Reason**: Front-desk operations are purely operational (scheduling, intake, patient registration) and do not require clinical intelligence.
- **Implication**: The Receptionist Portal package is marked **Not Yet Audited**; no implementation claims are made.
- **Status**: **ACCEPTED & BINDING**

---

### D8: Similar Patient / Case Retrieval is Classified as Future / Optional
- **Decision**: Case-based patient similarity retrieval is excluded from the current active integration scope.
- **Reason**: The current database contains only 2 patients and 6 appointments. Real case retrieval requires thousands of de-identified, ICD-10 coded patient records.
- **Implication**: Zero effort will be spent on patient vector embeddings during this phase.
- **Status**: **ACCEPTED & BINDING**

---

### D9: Medical RAG V2.10 Remains Hard Frozen
- **Decision**: The production RAG index (2,204 chunks, 384 dimensions), FAISS IndexFlatIP, BM25 retriever, Cross-Encoder reranker, and `AnswerGroundingVerifier` will remain completely frozen.
- **Reason**: The RAG backend has been hardened, benchmarked, and passed 190 regression tests. Modifying its internals during portal integration introduces regression risk.
- **Implication**: All integration work will build *around* the frozen RAG engine.
- **Status**: **ACCEPTED & BINDING**

---

### D10: Doctor Portal REST Contracts Must Be Preserved
- **Decision**: Existing working REST endpoints (`/api/doctor/patients`, `/api/doctor/prescriptions`, `/api/doctor/appointments`, etc.) and database schemas will not be casually renamed or refactored.
- **Reason**: Preserves teammate-owned work and prevents breaking existing frontend views.
- **Implication**: Enhancements will be additive (e.g., adding a pre-save check before calling `/prescriptions`).
- **Status**: **ACCEPTED & BINDING**

---

### D11: Do Not Expand Database Schema for Unused `patient_followups` Table
- **Decision**: The database schema will **not** be expanded with a `patient_followups` table simply because old controller code references it.
- **Reason**: The table is absent from `Dump.sql`, and the frontend makes zero calls to follow-up routes. Expanding schemas for unused features is premature scope creep.
- **Implication**: The dead `/followups` routes in Express will be commented out or safely stubbed.
- **Status**: **ACCEPTED & BINDING**

---

### D12: Do Not Alter `users.role` ENUM Prematurely
- **Decision**: The `users.role` ENUM will remain `('doctor', 'patient')` until the Receptionist Portal is formally audited.
- **Reason**: Modifying database schemas based on uninspected future modules violates modular boundaries.
- **Implication**: Schema migration to add `'receptionist'` will occur only during formal Receptionist integration.
- **Status**: **ACCEPTED & BINDING**
