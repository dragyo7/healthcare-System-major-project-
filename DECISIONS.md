# DECISIONS.md — Engineering Decision Log (ADR)

> **Document Type**: Authoritative Engineering Decision Log  
> **Project**: Modular AI-Powered Multilingual Clinical Decision Support System (CDSS)  
> **Repository**: `dragyo7/healthcare-System-major-project-`  
> **Status**: **LIVING LOG — ALL MEANINGFUL ARCHITECTURAL DECISIONS RECORDED**  
> **Last Updated**: October 2026  

---

### DEC-001 — Operational EHR and Clinical Intelligence Remain Physically Decoupled
- **Date**: 2026-09-20 (Ratified October 2026)
- **Status**: **Accepted & Binding**
- **Context**: The platform requires relational data management (patients, appointments, prescriptions) and computationally heavy AI/NLP inference (PyTorch tensor operations, FAISS vector search, neural cross-encoder reranking).
- **Evidence**: `Portal Major P/Bhumi/Doctor portal/backend/src/app.js` and `rag_module/api.py`.
- **Decision**: Keep Node.js/Express (port 5000) and Python/FastAPI (port 8000) physically decoupled, communicating via internal HTTP requests over loopback.
- **Reasoning**: Node.js excels at asynchronous I/O, JWT parsing, and binary PDF streaming. Python is required for PyTorch and HuggingFace models. Merging them into a single runtime would degrade maintainability and complicate deployment.
- **Alternatives Considered**: 
  - *Single Python monolith (FastAPI doing all relational CRUD)*: Rejected because existing teammate portals were already authored in Express/Node.js, and rewiring would destroy verified code.
  - *Single Node.js monolith with ONNX runtimes*: Rejected because local PyTorch model execution and FAISS C++ bindings are native in Python.
- **Trade-offs Accepted**: Cross-process network hop over `127.0.0.1` (~1–2ms overhead) in exchange for clean architectural boundaries.
- **Security / Reliability**: Express validates all incoming user JWT tokens before any request reaches FastAPI. FastAPI is not directly exposed to the public internet.

---

### DEC-002 — Relational EHR Data Stored Exclusively in MySQL, Never in RAG FAISS Index
- **Date**: 2026-09-21 (Ratified October 2026)
- **Status**: **Accepted & Binding**
- **Context**: RAG systems use vector databases to retrieve knowledge chunks. Storing patient records alongside medical monographs would allow potential data leakage.
- **Evidence**: `data/faiss_index/index_v2.bin` and MySQL schema in `Portal Major P/Bhumi/Doctor portal/backend/database/`.
- **Decision**: Patient records reside exclusively in MySQL (`rag_healthcare`). They are **never** vectorized, embedded, or indexed into FAISS.
- **Reasoning**: The FAISS index represents published medical literature (DailyMed, ICMR, MedlinePlus). Mixing Protected Health Information (PHI) with public clinical knowledge creates catastrophic privacy violations and HIPAA/DISHA non-compliance.
- **Alternatives Considered**: 
  - *Dynamic vector index per patient*: Rejected due to disk and memory overhead, complex lifecycle management, and privacy compliance risks.
- **Trade-offs Accepted**: Patient clinical context must be dynamically passed as an ephemeral sanitized string in request payloads to `/cds/evaluate`.
- **Security / Reliability**: Zero persistent patient embeddings exist on disk; zero PII leakage risk in vector search.

---

### DEC-003 — Server-Side RBAC, BOLA Defense, and Zero-PII Context Sanitization
- **Date**: 2026-09-25 (Ratified October 2026)
- **Status**: **Accepted & Binding**
- **Context**: Web clients can be manipulated to forge role headers, tamper with patient IDs (Broken Object Level Authorization / BOLA), or submit prompt injection attacks.
- **Evidence**: `src/middleware/authMiddleware.js`, `src/routes/doctorRoutes.js`, `src/routes/patientRoutes.js`, and `tests/integration/test_route_authorization_matrix.js`.
- **Decision**: Express enforces strict server-side JWT verification, role authorization middleware (`authenticateDoctor`, `authenticatePatient`, `authenticateReceptionist`), query-scoping to caller identity, and Zero-PII sanitization before forwarding requests to FastAPI.
- **Reasoning**: Untrusted client-supplied IDs must never be blindly trusted. Stripping demographic identifiers (names, phone numbers) before sending clinical context to FastAPI ensures privacy compliance.
- **Alternatives Considered**: Client-side role checking via React router only. *Rejected as insecure*.
- **Trade-offs Accepted**: All requests incur JWT verification and database user-lookup overhead.
- **Verification**: Verified across 27 tests in `tests/integration/test_route_authorization_matrix.js` (100% pass rate).

---

### DEC-004 — Centralized Clinical Orchestration via FastAPI (`/cds/evaluate`)
- **Date**: 2026-09-28 (Ratified October 2026)
- **Status**: **Accepted & Binding**
- **Context**: Clinical intelligence requires coordinating dense retrieval, sparse BM25 retrieval, reranking, drug interaction rules, multilingual canonicalization, and grounding verification.
- **Evidence**: `cds_module/orchestrator.py` and `cds_module/router.py`.
- **Decision**: Expose a single unified endpoint `POST /cds/evaluate` that accepts clinical queries and optional patient context, coordinating all sub-engines internally.
- **Reasoning**: Prevents Express from having to orchestrate multiple distributed microservices. Simplifies integration and enforces a uniform clinical response schema.
- **Alternatives Considered**: Independent microservice endpoints for retrieval, reranking, and drug interactions. *Rejected due to network latency and orchestrator sprawl*.
- **Trade-offs Accepted**: FastAPI orchestrator is a composite service; failures in one sub-engine must be handled fail-closed.
- **Verification**: Verified across 9 tests in `cds_module/test_cds_gateway.py`.

---

### DEC-005 — Deterministic Medication Safety Screening (<15ms) Over Generative LLM Checking
- **Date**: 2026-09-29 (Ratified October 2026)
- **Status**: **Accepted & Binding**
- **Context**: Drug-drug interactions (DDIs) and patient allergy checks are safety-critical. LLMs frequently hallucinate dosages, miss obscure interactions, or invert severity levels.
- **Evidence**: `drug_module/interaction_engine.py` and `src/controllers/doctorController.js:462`.
- **Decision**: Evaluate DDIs via compiled JSON rule graphs (DrugBank 8 high-severity rules, SIDER 20 drug profiles) and check allergies via string intersection, bypassing LLM inference entirely.
- **Reasoning**: Guarantees deterministic, sub-15ms screening latency and eliminates generative hallucination risks.
- **Alternatives Considered**: Asking `TinyLlama-1.1B` to detect interactions in natural language. *Rejected due to high hallucination rate and 25-second inference latency*.
- **Trade-offs Accepted**: Coverage is bounded to curated rule sets (8 DrugBank rules, 20 SIDER profiles); unindexed drug pairs must trigger policy abstentions or fall back to general RAG.
- **Verification**: Verified in `scratch/profile_prescription_safety_paths.js` (Median latency: 12.59ms).

---

### DEC-006 — Frozen Medical RAG v2.10 Baseline (Commit `497a547`)
- **Date**: 2026-10-01 (Ratified October 2026)
- **Status**: **Accepted & Binding**
- **Context**: Repeated ad-hoc tuning of embedding models, retrieval weights, and FAISS indices destroys scientific repeatability and breaks regression baselines.
- **Evidence**: Git commit `497a547`, `rag_module/data/faiss_index/index_v2.bin` (2,204 chunks, 384 dimensions), and `rag_module/tests/`.
- **Decision**: Hard-freeze the RAG retrieval pipeline: BAAI/bge-small-en embeddings, BM25Okapi ($k_1=1.5, b=0.75$), Reciprocal Rank Fusion ($k=60$), cross-encoder reranker, and `AnswerGroundingVerifier`.
- **Reasoning**: Establishes a protected, reproducible baseline with 193 passing tests.
- **Alternatives Considered**: Upgrading to a 7B or 13B model. *Rejected due to local hardware constraints (requires high-end GPU)*.
- **Trade-offs Accepted**: Generative answer quality is bounded by compact 1.1B model capacity; unverified claims trigger fail-closed abstentions.
- **Verification**: Verified in Task-6523: **193 passed, 2 skipped, 0 failed in 278.43s**.

---

### DEC-007 — Fail-Closed Proposition Grounding Verification (`AnswerGroundingVerifier`)
- **Date**: 2026-10-02 (Ratified October 2026)
- **Status**: **Accepted & Binding**
- **Context**: Small language models occasionally generate fluent medical statements not supported by retrieved context.
- **Evidence**: `rag_module/safety/grounding_verifier.py`.
- **Decision**: Deconstruct candidate answers into atomic propositions. Align each proposition's entity, relation, and value against retrieved DailyMed chunk text. If any proposition lacks evidence, withhold the entire answer and return `abstained_policy`.
- **Reasoning**: In healthcare, an abstention is vastly safer than an ungrounded hallucination.
- **Alternatives Considered**: Confidence scoring threshold without proposition alignment. *Rejected as insufficient to prevent subtle numeric or negation errors*.
- **Trade-offs Accepted**: System abstains on queries where evidence exists but exact entity-relation matching fails.
- **Verification**: 100% safe abstention on unindexed or fictitious drugs in benchmark suite.

---

### DEC-008 — Atomic Session Advisory Locking for Prescription Concurrency & Idempotency
- **Date**: 2026-10-14 (Ratified October 2026)
- **Status**: **Accepted & Binding**
- **Context**: Double-clicking "Authorize Prescription" or rapid concurrent network retries can create duplicate prescription records for the same patient.
- **Evidence**: `Portal Major P/Bhumi/Doctor portal/backend/src/controllers/doctorController.js:203`.
- **Decision**: Use MySQL session advisory locks via `SELECT GET_LOCK('rx_lock_<docId>_<patId>', 10)`. Deduplicate submissions with identical medications within 30 seconds.
- **Reasoning**: Guarantees mutual exclusion across concurrent requests. If the lock cannot be obtained within 10s, fail closed with HTTP 503, leaving zero orphaned rows.
- **Alternatives Considered**: In-memory JavaScript mutex. *Rejected because it fails across multi-process or clustered gateway instances*.
- **Trade-offs Accepted**: Maximum 10-second wait before timeout on congested sessions.
- **Verification**: Verified in `tests/integration/test_concurrent_prescription_idempotency.js`: 5 simultaneous requests produced **1 Created, 4 Deduplicated, zero duplicate rows**.

---

### DEC-009 — Prescription PDF Ownership Authorization with Zero-Byte Fail-Closed Defense
- **Date**: 2026-10-14 (Ratified October 2026)
- **Status**: **Accepted & Binding**
- **Context**: Prescription PDFs contain confidential medical directives. An unauthorized doctor or patient must not be able to guess IDs and download another user's prescription.
- **Evidence**: `src/controllers/doctorController.js:335`, `src/controllers/patientController.js:80`.
- **Decision**: Enforce ownership checks before opening PDF generation streams. If caller ID does not match prescribing doctor or prescribed patient, return HTTP 403 Forbidden immediately without streaming any bytes.
- **Reasoning**: Prevents IDOR/BOLA data exfiltration.
- **Alternatives Considered**: Obfuscated UUID filenames. *Rejected as "security through obscurity"*.
- **Trade-offs Accepted**: Additional database query to verify prescription ownership before PDF compilation.
- **Verification**: Verified in `tests/integration/test_pdf_ownership_and_lock_failure.js`: **0 PDF bytes streamed on 403**.

---

### DEC-010 — Offline Tesseract.js OCR with Mandatory Human Clinician Confirmation Invariant
- **Date**: 2026-10-14 (Ratified October 2026)
- **Status**: **Accepted & Binding**
- **Context**: Prescription image OCR can misread characters (e.g. `5mg` vs `50mg`), which could be fatal if persisted directly.
- **Evidence**: `src/services/prescriptionOcrService.js`, `src/controllers/doctorController.js:520`.
- **Decision**: Use offline `tesseract.js` with `eng.traineddata`. Parse extracted text into candidate items stored in `prescription_ocr_jobs` with status `processed` and `needs_review: true`. Forbid saving to active `prescriptions` table without explicit clinician sign-off (`POST /api/doctor/prescriptions/confirm-ocr`).
- **Reasoning**: Enforces the Human-in-the-Loop invariant required by clinical safety standards.
- **Alternatives Considered**: Direct persistence of OCR results. *Rejected as clinically dangerous*.
- **Trade-offs Accepted**: Doctor must manually inspect and click "Confirm" on extracted medications.
- **Verification**: Verified in `scratch/test_prescription_ocr_pipeline.js` (12/12 passed).

---

### DEC-011 — Cryptographic Single-Use Patient Account Activation (No Default Passwords)
- **Date**: 2026-10-14 (Ratified October 2026)
- **Status**: **Accepted & Binding**
- **Context**: Assigning default universal passwords (e.g., `Patient@123`) to newly registered patients creates catastrophic credential-stuffing vulnerabilities.
- **Evidence**: `migrations/004_create_account_activations.sql`, `src/controllers/authController.js:109`.
- **Decision**: Front-desk patient intake generates a random 32-byte cryptographic token with 48-hour expiration. The patient opens `/activate?token=...`, defines a secure password, and the token is permanently consumed (`used_at = NOW()`).
- **Reasoning**: Eliminates default password attack surfaces and prevents replay attacks.
- **Alternatives Considered**: Sending SMS OTPs. *Rejected due to reliance on external paid SMS gateways during local academic demonstration*.
- **Trade-offs Accepted**: Receptionist must communicate the activation URL to the patient.
- **Verification**: Verified in `scratch/test_activation_and_role_mismatch.js`: Replay attempts return HTTP 400.

---

### DEC-012 — Indic Multilingual Engine with Entity-Preserving Canonicalization
- **Date**: 2026-10-10 (Ratified October 2026)
- **Status**: **Accepted & Binding**
- **Context**: Blind machine translation of medical queries alters drug names, destroys dosage units, and corrupts negations (e.g., translating "do not take" to affirmative).
- **Evidence**: `multilingual_module/canonicalizer.py`, `multilingual_module/safety_templates.py`.
- **Decision**: Detect language script (`en`, `hi`, `mr`, `gu`), extract clinical entities (drug: `Amlodipine`, dose: `5mg`), map to canonical English for monograph retrieval, and localize the verified response back into the target language using pre-verified clinical templates.
- **Reasoning**: Preserves pharmacological fidelity across Indian languages without altering the frozen RAG index.
- **Alternatives Considered**: Translating the entire DailyMed corpus into Hindi and Marathi. *Rejected due to translation hallucination risk and corpus explosion*.
- **Trade-offs Accepted**: Supported languages are bounded to calibrated templates and entity maps.
- **Verification**: Verified in `multilingual_module/tests/test_multilingual.py` (16/16 passed).

---

### DEC-013 — Unified Single-Port Web Application on Port 5173
- **Date**: 2026-10-14 (Ratified October 2026)
- **Status**: **Accepted & Binding**
- **Context**: Early architecture ran three separate frontend Vite dev servers: Doctor (5173), Receptionist (5174), and Patient (5175). Managing three frontend ports caused port conflicts, CORS sprawl, and fragile demonstration setups.
- **Evidence**: `frontend/src/routes/AppRoutes.jsx` and `scripts/start_platform.ps1`.
- **Decision**: Consolidate all three role portals into a single, cohesive React 19 SPA running on port 5173, governed by an intelligent role-routing entry point (`RootRedirect`).
- **Reasoning**: Streamlines local startup to a single frontend command, reduces memory footprint, and provides a polished, professional multi-role user experience.
- **Alternatives Considered**: Running a reverse proxy or keeping 3 separate Node processes. *Rejected due to unnecessary operational complexity*.
- **Trade-offs Accepted**: All role components are bundled in one Vite build.
- **Verification**: Verified production build: **2,245 modules bundled in 1.03s with 0 errors**.
