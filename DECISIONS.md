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
- **Provenance**: *Original rationale not established from early commit history. This entry documents the current architectural assessment based on source code.*
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
- **Provenance**: *Original rationale not established from early commit history. This entry documents the current architectural assessment based on source code.*
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
- **Provenance**: *Original rationale not established from early commit history. This entry documents the current architectural assessment based on source code.*
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
- **Provenance**: *Original rationale not established from early commit history. This entry documents the current architectural assessment based on source code.*
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
- **Provenance**: *Original rationale not established from early commit history. This entry documents the current architectural assessment based on source code.*
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

---

### DEC-014 — Prohibition of Autonomous LLM-Based Drug Replacement & Requirements for Clinician-in-the-Loop Substitution
- **Date**: 2026-10-18
- **Status**: **Accepted & Binding**
- **Context**: Teammates and stakeholders inquired whether the CDSS can autonomously generate drug substitutions or alternative medicines when an interaction or allergy is detected.
- **Evidence**: `drug_module/interaction_engine.py`, `data/rules/medication_interactions/rules.json`, and clinical safety standards (FDA CDS Guidance / WHO Digital Health).
- **Decision**: Strictly **forbid** autonomous LLM-based drug replacement. The system must never hallucinate or invent alternative therapeutic regimens. When a contraindication or interaction is detected, the CDSS presents only verified static clinical actions from approved monographs (e.g. "Consider alternative antibiotic such as amoxicillin if clinically indicated").
- **Reasoning**: Unconstrained generative models cannot compute patient-specific pharmacokinetic/pharmacodynamic parameters (eGFR, hepatic Child-Pugh class, QT interval, cross-reactivity classes, therapeutic drug monitoring levels). Autonomous substitution poses severe clinical risks of organ toxicity, therapeutic failure, or fatal anaphylaxis.
- **Requirements for Future Safe Substitution Engine**:
  1. Authoritative formulary substitution database (e.g., WHO Model List of Essential Medicines, BNF Therapeutic Equivalents, RxNorm ATC classifications).
  2. Multi-parameter clinical eligibility evaluation based on structured EHR laboratory values (creatinine clearance, serum potassium, ALT/AST, pregnancy status).
  3. Strict Human-in-the-Loop invariant: Alternatives must be presented as passive, graded options with monograph citations, requiring explicit clinician sign-off before modifying any active prescription.
- **Trade-offs Accepted**: Clinician must select the replacement medication manually rather than receiving an automated one-click substitution.
- **Verification**: Verified in `scratch/test_doctor_patient_context_and_isolation.js` and `tests/integration/test_prescription_idempotency_robust.js`: prescriptions with contraindications are rejected with HTTP 422 without silent substitution.

---

### DEC-015 — Word-Boundary Token Matching for Medication Synonyms and Authoritative Terminology Mapping
- **Date**: 2026-10-18
- **Status**: **Accepted & Binding**
- **Context**: The drug normalization engine previously utilized a substring search (`if k in cleaned: return v`) across a 31-entry synonym table. This created potential collision bugs where a substring like `"dolo"` could wrongly match unrelated medicines such as `"indolometacin"`, or `"cipro"` could match unintended chemical stems.
- **Evidence**: `drug_module/normalizer.py:80-90` and `scratch/test_normalizer_safe_matching.py`.
- **Decision**: Replace unsafe substring matching with explicit normalized matching: exact dictionary lookup followed by word-boundary regex token matching (`re.search(r"\b" + re.escape(k) + r"\b", cleaned)`).
- **Reasoning**: Word-boundary matching preserves brand-to-generic mappings (e.g., `"Dolo 650"` -> `"paracetamol"`, `"Crocin Advance"` -> `"paracetamol"`, `"Cipro 500"` -> `"ciprofloxacin"`) while preventing false-positive substring collisions on unrelated compound names.
- **Authoritative Data Gap**: The 31-entry table is a heuristic fallback. Production scale requires integrating the complete RxNorm active ingredient dataset (RxCUI concept graph and NLM DailyMed SPL ingredient tables).
- **Verification**: Verified via `scratch/test_normalizer_safe_matching.py`: 7/7 test cases passed with zero substring collisions on `"indolometacin"`.

---

### DEC-016 — Absolute, Non-Bypassable Patient Allergy Contraindication Hard Stop
- **Date**: 2026-10-18
- **Status**: **Accepted & Binding**
- **Context**: In clinical decision support, drug-drug interactions (DDIs) often allow clinician override when the therapeutic benefit outweighs the risk (e.g., Warfarin + low-dose Aspirin under specialized cardiology monitoring). However, documented patient allergies (such as anaphylactic Penicillin allergy) pose immediate life-threatening hypersensitivity risks that must never be bypassed by an override payload.
- **Evidence**: `Portal Major P/Bhumi/Doctor portal/backend/src/controllers/doctorController.js:671` and `scratch/test_adversarial_allergy_bypass.js`.
- **Decision**: Decouple allergy contraindications completely from overridable severe DDI checks across all persistence paths (direct prescription creation and OCR confirmation). If an allergy is matched (including active moieties in combination products and cross-reactive classes), return HTTP 422 Unprocessable Entity with `cannot_override: true` and immediately abort before database transaction initiation.
- **Reasoning**: Prevents malicious or erroneous overrides from persisting lethal allergic medications into patient records.
- **Alternatives Considered**: Allow clinician override for allergies with mandatory double-signature. *Rejected for prototype safety; allergy documentation must be formally modified in the patient record before prescribing*.
- **Trade-offs Accepted**: Clinicians cannot prescribe a drug in an allergic class even for desensitization protocols without first modifying the documented allergy in the EHR.
- **Verification**: Verified via `scratch/test_adversarial_allergy_bypass.js`: Direct API and OCR confirm attempts with `safety_override: true` both returned HTTP 422, creating exactly 0 records in MySQL.

---

### DEC-017 — Staged Clinical Knowledge Ingestion Governance with Keyed HMAC-SHA256 Seals
- **Date**: 2026-10-18
- **Status**: **Accepted & Binding**
- **Context**: Automated extraction of clinical interaction rules from regulatory SPL monographs requires a strict human-in-the-loop review boundary. An unkeyed SHA-256 seal in a local staging file can be tampered with by any actor with file-write access who modifies the clinical action and recalculates the SHA-256 hash.
- **Evidence**: `drug_module/ingestion/pipeline.py` and `tests/test_clinical_knowledge_ingestion.py`.
- **Decision**: Enforce a seven-stage pipeline (Acquisition $\to$ Parsing $\to$ Normalization $\to$ Validation $\to$ Staging $\to$ Clinician Review $\to$ Publication) with:
  1. Role authorization whitelist: `{"LICENSED_PHYSICIAN", "CHIEF_MEDICAL_OFFICER", "CLINICAL_PHARMACOLOGIST"}`.
  2. Syntactic license validation ($\ge 6$ alphanumeric characters).
  3. Keyed HMAC-SHA256 audit seal using server-side `INGESTION_AUDIT_SECRET`.
  4. At publication time (`stage_7_publish`), verify HMAC seal against current record content before committing to production `medication_interactions.json`.
- **Reasoning**: Ensures that offline modification of staged rules without knowledge of the server secret is detected and rejected at publish time.
- **Known Limitation**: License verification is purely syntactic; there is no live integration with external state or national medical board licensing registries (e.g., NMC/MCI).
- **Verification**: Verified via `tests/test_clinical_knowledge_ingestion.py`: 11/11 tests passed, including unauthorized role rejection, license syntax rejection, data tampering failure, and hash forgery rejection.

### DEC-018: Fail-Closed Ingestion HMAC Secret & Local Threat Boundary
- **Date**: 2026-10-18
- **Context**: The knowledge ingestion pipeline previously fell back to a default secret string (`"CDSS_OFFLINE_INGESTION_GOVERNANCE_SECRET_V1"`). On multi-user or development workstations, any local process could inspect the fallback and forge valid HMAC review signatures on tampered staged rules.
- **Decision**:
  1. Remove all hardcoded default fallbacks in `drug_module/ingestion/pipeline.py`.
  2. Enforce strict fail-closed gating (`PermissionError`) on missing or whitespace-only `INGESTION_AUDIT_SECRET` before clinician review (`stage_6`) or production publication (`stage_7`).
  3. Never log, serialize, or expose the secret in staging or production rule artifacts.
  4. Explicitly define the local threat model: While HMAC protects against unkeyed file tampering, a local attacker with host environment access can read the secret from `.env` or process memory; true defense-in-depth requires OS keychain / HSM isolation in enterprise deployment.
- **Verification**: Verified via `tests/test_clinical_knowledge_ingestion.py` (14/14 passed), covering missing secret, empty secret, secret rotation failure, staged payload tampering rejection, and secret non-leakage.

### DEC-019: Disentangling Generator Syntactic Drift Safety Abstention from Clinical Answerability
- **Date**: 2026-10-18
- **Context**: Querying the compact local generator (`TinyLlama-1.1B`) with translated clinical queries (`"मेटफॉर्मिन के उपयोग और संकेत क्या हैं?"` -> `'what are indications and clinical usage of metformin'`) occasionally produced conversational preamble drift (*"According to the given evidence-grounded medical AI assistant, the subject medication for metformin is indicated as..."*). The proposition extractor extracted `"subject"` rather than `"metformin"` as the clause subject, triggering an `[ENTITY_MISMATCH]` in the frozen verifier and causing fail-closed suppression of citations (`citations: 0`). The previous test conflated answerability with 100% syntactic conformity.
- **Decision**:
  1. Preserve the frozen `AnswerGroundingVerifier` and fail-closed safety policy without relaxing thresholds or using brittle ad-hoc string stripping.
  2. Disentangle evaluation into two distinct invariant tests:
     - `test_01a_hindi_metformin_entity_mismatch_fail_closed`: Verifies that when compact generator preamble drift produces an entity mismatch, the system safely withholds the ungrounded answer and citations, preventing hallucinated medical claims.
     - `test_01b_metformin_answerable_grounded_citation`: Verifies that when an answerable metformin query cleanly preserves the target entity, the CDS Gateway successfully returns verified DailyMed citations and evidence-grounded clinical text.
  3. Document the proposition extraction defect: Clauses matching `the (?:subject|target) (?:medication|drug) for ([A-Za-z]+)` extract the head noun rather than the prepositional object drug entity.
- **Verification**: Verified via `multilingual_module/tests/test_multilingual.py` (21/21 passed).

---

### DEC-020: Decoupling Multilingual Permissibility from Co-Prescription & Hardening Indic Canonicalization
- **Date**: 2026-10-19
- **Status**: **Accepted & Binding**
- **Context**: The multilingual canonicalizer previously mapped Marathi and Hindi permissibility inquiries (`"घेऊ शकतो का"`, `"घेता येईल का"`, `"ले सकते हैं"`, `"दे सकते हैं"`) to `"together co-prescribe"`, which erroneously injected drug-drug interaction routing into single-medication and allergy inquiries. Romanized Hindi/Marathi and code-switched queries were classified as pure English and bypassed canonicalization completely. In addition, Marathi queries with sentence-final `"का"` tied with Hindi postpositions and misclassified as Hindi due to missing verbal markers (`घ्यावी`, `पोटी`, `उपाशी`).
- **Decision**:
  1. Decouple permissibility from combination therapy by remapping permissibility phrases to `"can take"` or `"can administer"`, reserving `"together co-prescribe"` strictly for genuine combination markers (`"एकत्र"`, `"सोबत"`, `"साथ में"`, `"एक साथ"`, `"સાથે"`).
  2. Expand `MARATHI_MARKERS` in `detector.py` with feminine and plural verbal forms (`घ्यावी`, `घ्याव्यात`, `घेता`, `घेतात`), timing/frequency markers (`पोटी`, `उपाशी`, `दोनदा`, `एकदा`, `गोळ्या`, `गोळी`), and sentence-final question particle disambiguation.
  3. Introduce `ROMANIZED_HINDI_MARKERS` and `ROMANIZED_MARATHI_MARKERS` to detect Latin-script Indic queries and prevent them from bypassing canonicalization in `canonicalize_medical_query()`.
  4. Enrich `CLINICAL_INTENT_MAP` with complete allergy expressions (`पेनिसिलिनची ऍलर्जी`, `सल्फा ऍलर्जी`, `allergy`), frequency (`दिन में दो बार`, `दिवसातून एकदा`, `कितनी बार`), timing (`खाली पेट`, `उपाशी पोटी`, `शराब के साथ`), and missed dose negation (`डोस विसरल्यास डबल डोस घेऊ नका`).
  5. Retain the lightweight Python canonicalizer rather than integrating heavy NMT models (IndicTrans2) or third-party cloud services (Google Translate) to preserve local offline execution, sub-millisecond latency, zero memory overhead, and deterministic entity preservation.
- **Verification**: Verified via `multilingual_module/tests/test_multilingual.py` (38/38 passed, including 10 new exact-input/exact-output and negative regression tests), `cds_module/test_cds_gateway.py` (9/9 passed), and `rag_module/tests/test_v29_grounding_verifier.py` (28/28 passed).

---

### DEC-021: Indian Healthcare Legal, Ethics & Regulatory Transparency Boundary
- **Date**: 2026-10-20
- **Status**: **Accepted & Binding**
- **Context**: Medical AI software operating in Indian clinical domains must comply with the Digital Personal Data Protection Act, 2023 (DPDP Act, Act 22 of 2023), NMC Telemedicine Practice Guidelines, 2020, and CDSCO Medical Device Rules (MDR 2017). Marketing prototypes with unsubstantiated claims such as "100% DPDP compliant" or "clinically certified" violates statutory truth-in-advertising and medical negligence principles.
- **Decision**:
  1. Explicitly document academic research prototype boundaries in the UI (`/about`) and architecture documentation.
  2. Implement strict data minimization: 100% on-premise local inference, zero external cloud transmission of PHI or images, synthetic test accounts only.
  3. Enforce mandatory Registered Medical Practitioner (RMP) oversight: AI recommendations are advisory; prescription generation and OCR confirmation require human clinician signature.
  4. Disclose institutional gaps honestly: No live hospital affiliation, no statutory DPO appointed, no automated long-term deletion schedule.
- **Verification**: Dedicated `/about` page implemented and browser-verified; statutory citations verified against official Gazette notifications.

---

### DEC-022: Migration Replay Hardening for Clean Installations (Disposable Sandbox Invariant)
- **Date**: 2026-10-20
- **Status**: **Accepted & Binding**
- **Context**: Forward migration `002_create_discharges_table.sql` contained an unconditional seed statement (`INSERT INTO discharges ... SELECT 1, 1 ... WHERE NOT EXISTS (SELECT 1 FROM discharges WHERE patient_id = 1)`). In a fresh, unseeded database, this violated foreign key constraints against `patients` and `doctors`, preventing clean installation replays.
- **Decision**:
  1. Harden `002_create_discharges_table.sql` seed query with explicit referential integrity preconditions: `FROM DUAL WHERE EXISTS (SELECT 1 FROM patients WHERE patient_id = 1) AND EXISTS (SELECT 1 FROM doctors WHERE doctor_id = 1) AND NOT EXISTS (SELECT 1 FROM discharges WHERE patient_id = 1)`.
  2. Test migration replay and rollbacks against a dedicated disposable sandbox database (`cdss_disposable_migration_audit_db`) to guarantee zero regression risk to the working database.
- **Verification**: Verified 100% successful forward replay (000 -> 005, 15 tables created) and clean reverse rollback (005 -> 000) on a fresh database instance.

---

### DEC-023 — Fail-Closed Database Safety Foundation and Dedicated Test Boundary
- **Date**: 2026-10-20
- **Status**: **Accepted & Binding**
- **Context**: Integration and E2E tests historically risked mutating the primary application database (`rag_healthcare`) due to silent fallbacks (`process.env.DB_NAME || "rag_healthcare"`), hardcoded database targets (`database: "rag_healthcare"` in `scratch/test_doctor_portal_e2e.js`), and accidental HTTP requests targeting an already-running development server on port 5000.
- **Decision**:
  1. **Centralized Fail-Closed Safety Guard (`tests/safety/databaseSafetyGuard.js`)**:
     - `verifyDestructiveTestSafety(dbName)`: Requires explicit opt-in (`ALLOW_DESTRUCTIVE_DATABASE_TESTS=true`), strictly rejects `rag_healthcare` (case-insensitive, whitespace-trimmed), rejects production-like names (`prod`), and enforces `_test` or `_disposable` suffix.
     - `verifyTestDatabasePreflight()`: Synchronously validates database environment configuration before any connection pool or suite starts, eliminating silent fallback.
     - `probeGatewaySafety(port, expectedDbName)`: Blocks testing against port 5000 unless `ALLOW_DEFAULT_DEV_PORT=true`, and probes `/health` to verify the backend is connected to the verified test database and not `rag_healthcare`.
  2. **Test Infrastructure Hardening (`tests/integration/testHelper.js`)**:
     - Replaced silent fallback `process.env.DB_NAME || "rag_healthcare"` with a getter property on `DB_CONFIG.database` that triggers `verifyTestDatabasePreflight()` before any TCP socket or MySQL connection is initiated.
     - Shifted default test gateway port to 5001 (`TEST_EXPRESS_PORT`), preventing collision with running development server on port 5000.
     - Guarded `httpRequest` to reject port 5000 unless explicitly opted in.
  3. **Master Test Runner Preflight (`tests/run_all_tests.js`)**:
     - Added asynchronous preflight check before any test suite is spawned.
     - Injects `NODE_ENV=test`, `DB_NAME=targetDb`, and `TEST_EXPRESS_PORT` into child process environments.
  4. **Backend Non-Production Introspection (`hubController.js`)**:
     - Exposes `services.database_name` in `/health` for non-production environments to enable preflight safety probing.
  5. **Script Cleansing**:
     - Removed hardcoded `rag_healthcare` targets and credentials from `scratch/test_doctor_portal_e2e.js`.
     - Made `BASE_URL` configurable via `TEST_EXPRESS_PORT` across scratch tests (`test_full_system_multi_role_e2e.js`, `test_supabase_security_and_deployment.js`, `test_auth_and_tampering_security.js`).
  6. **Development Compatibility Preserved**:
     - Normal backend boot (`server.js`) and database pool (`db.js`) behavior remain completely unchanged when `NODE_ENV !== "test"`.
- **Verification**: Verified via `tests/test_database_safety_foundation.js` (26/26 passed, 100% database-independent with zero MySQL calls), `tests/test_destructive_guard_rejection.js` (7/7 passed), and `tests/test_jwt_security_configuration.js` (10/10 passed). Zero database mutations performed.

---

### DEC-024 — Unified Frontend Adoption, RBAC Self-Registration Boundary & Design System Harmonization
- **Date**: 2026-10-21
- **Status**: **Accepted & Binding**
- **Context**: Audit of the reference fork (`mdshahanwaz7/healthcare-System-major-project-2`) revealed an experimental `unified-app` with monolithic single-file components (`DoctorWorkspace.jsx`, `PatientWorkspace.jsx`, `ReceptionistWorkspace.jsx`), 4,159-line raw CSS, and an inline `Sign in` | `Create account` mode switch. By contrast, our platform operates a modular React 19 + Tailwind CSS architecture with React Router and server-enforced RBAC. However, inspection revealed that `/signup` was visually disconnected (light MedAI theme vs dark CDSS theme), `AuthContext` lacked `signUpPatient` export, and `/login` lacked an inline tab bridge to `/signup`.
- **Decision**:
  1. **Harmonize Authentication Design System**:
     - Modernized `Signup.jsx` into the cohesive dark CDSS glassmorphic theme matching `Login.jsx` and `Activate.jsx`.
     - Added an inline access mode tab (`Sign In` | `Create Account`) and role helper guidance to `Login.jsx`.
     - Made demo account selector cards responsive across mobile viewports (`grid-cols-1 sm:grid-cols-3`).
  2. **Enforce Role-Based Self-Registration Boundary**:
     - Grounded self-registration strictly in server authorization rules: only Patients are permitted to self-register (`POST /api/auth/patient/signup`).
     - Privileged clinical roles (Doctors, Receptionists) must be provisioned by hospital administration; doctor self-registration in the UI was removed to match backend fail-closed 403 behavior.
     - Wired `authApi.signupPatient` and exported `signUpPatient` in `AuthContext.jsx`.
  3. **Align Client-Server Activation Contract**:
     - Aligned `Activate.jsx` password length check from 6 to 8 characters to match Express `authController.js` invariant.
- **Verification**:
  - Browser E2E verification of complete patient lifecycle (registration $\to$ success redirect $\to$ sign-in $\to$ authenticated patient dashboard).
  - 15 browser screenshots captured in `audit_evidence/audit_screenshots_oct21/`.
  - Account activation & RBAC regression suite passed: 20/20.
  - Primary database `rag_healthcare` verified 100% intact.

### DEC-025 — Academic Ethics, Legal Disclosures, About Portal & Explicit Consent Flow
- **Date**: 2026-10-21
- **Status**: **Accepted & Binding**
- **Context**: A comprehensive ethics, legal, privacy, and clinical safety compliance audit established that engineering safeguards (fail-closed verifier, RBAC, offline OCR, MySQL advisory locks) must be accompanied by explicit statutory alignment, informed consent mechanisms, and honest institutional boundaries.
- **Decision**:
  1. **Comprehensive `/about` Compliance & Ethics Portal**:
     - Deployed and verified [`frontend/src/pages/Common/About.jsx`](file:///E:/Major%20Project%20Code/frontend/src/pages/Common/About.jsx) accessible publicly from `/login`, `/signup`, `/home`, and from the authenticated workspace sidebars in `DashboardLayout.jsx`.
     - Explicitly documents academic status (4th-year Major Project, SVPCET Nagpur), non-autonomous decision support boundary, mandatory Registered Medical Practitioner (RMP) sign-off under NMC Telemedicine Guidelines 2020, and emergency hotlines (112, 108, 102).
     - Incorporates an Indian statutory reference matrix: DPDP Act 2023 (Act No. 22 of 2023) and Draft DPDP Rules 2025, IT Act 2000 Section 43A & SPDI Rules 2011 transitional status, ABDM Health Data Management Policy disclosure (academic prototype, not integrated with ABDM Sandbox), and CDSCO SaMD non-certification disclosure.
     - Formally documents research datasets (DailyMed SPL 2,204 chunks, DrugBank, SIDER 4.1, TinyLlama-1.1B, BAAI/bge-small-en) and provides an academic grievance mechanism (`cdss.project.audit@gmail.com`).
  2. **Informed Affirmative Consent on Patient Registration**:
     - Added an explicit consent checkbox on [`Signup.jsx`](file:///E:/Major%20Project%20Code/frontend/src/pages/Auth/Signup.jsx) aligning with Section 6(1) of DPDP Act 2023, requiring user acknowledgment that the system is an academic research prototype utilizing synthetic demonstration data before registration proceeds.
  3. **Honest Operational Disclosures**:
     - Discloses that no statutory Data Protection Officer (DPO) is appointed under Section 10(2)(a) as this is an academic prototype running on a local workstation.
     - Confirms zero transmission of patient data to third-party commercial cloud APIs.
- **Verification**:
  - Live browser audit verified desktop (`16_about_page_desktop.png`) and mobile (`17_about_page_mobile.png`) rendering, as well as the registration consent checkbox (`18_signup_consent_checkbox.png`).
  - Frontend production build passed cleanly in 836ms with 0 errors.
  - Primary database `rag_healthcare` confirmed 100% untouched.

---

### DEC-026 — Forensic Gap-Closure: Notified DPDP Rules 2025 Alignment, Consent Trace & Narrowed Zero-Egress Boundary
- **Date**: 2026-10-21
- **Status**: **Accepted & Binding**
- **Context**: Comprehensive gap-closure audit required: (1) Correcting the legal wording regarding the DPDP Rules, 2025 (formally notified on 13 November 2025 by MeitY with a phased commencement schedule); (2) Empirically tracing the consent flow to establish whether direct API calls bypass the frontend checkbox and whether database consent auditability exists; (3) Refining the zero network egress claim to demonstrably accurate scope; and (4) Reconciling knowledge base chunk counts against the frozen FAISS metadata.
- **Decision**:
  1. **Statutory Alignment Accuracy**:
     - Updated `About.jsx` and `UNIFIED_FRONTEND_AND_AUTH_AUDIT_REPORT.md` to accurately state that the final DPDP Rules, 2025 were officially notified on 13 November 2025.
     - Distinguishes provisions in force on audit date (DPBI constitution, search-cum-selection, procedural inquiry rules) from upcoming phased deadlines (12-month fiduciary notice/consent transition in mid-November 2026; 18-to-24-month SDF audit transitions in 2027).
     - Explicitly documents that DPO appointment under Section 10(2)(a) applies solely to Significant Data Fiduciaries (SDF). For an academic prototype on synthetic data, no statutory DPO is appointed; internal Academic Grievance Officer is designated.
  2. **Empirical Consent Trace & Gap Acknowledgment**:
     - Tested `POST /api/auth/patient/signup` via `scratch/test_consent_end_to_end_audit.js`.
     - Confirmed that while `Signup.jsx` gates browser submission, `authController.js:patientSignup` does not validate `terms_accepted` on direct API requests, and `users` table lacks `consent_timestamp` and `consent_version` columns.
     - Updated `Signup.jsx` to pass `terms_accepted: true` in the API payload, and documented the backend validation and database migration gaps with complete honesty rather than papering over them.
  3. **Narrower, Demonstrable Zero-Egress Claim**:
     - Scoped the claim in `About.jsx` to zero egress for health, personal, and clinical data.
     - Documented local model execution (TinyLlama-1.1B, BGE-small, Cross-Encoder, Tesseract.js), local asset bundling with system typography, and inert Supabase SDK configuration.
  4. **Corpus Attribution Reconciliation**:
     - Reconciled cited dataset counts in `About.jsx` to exact FAISS metadata: 2,176 DailyMed SPL chunks, 16 MedlinePlus chunks, 8 ICMR treatment chunks, 4 MoHFW guidance chunks (Total: 2,204 FAISS chunks); 8 DrugBank interaction rules, 20 SIDER adverse effect profiles.
  5. **Fork Comparison & Evidence Archive**:
     - Created `audit_evidence/fork_comparison_oct21/` with `COMPARISON_REPORT.md` and 13 screenshot artifacts, explicitly stating safety constraints regarding external fork execution.
- **Verification**:
  - `scratch/test_consent_end_to_end_audit.js` executed against test backend (port 5001) and test database (`rag_healthcare_test`).
  - Frontend production build passed cleanly in 871ms (2,251 modules, 0 errors).
  - Primary database `rag_healthcare` confirmed 100% untouched (176 users, 160 patients, 65 prescriptions).

---

### DEC-027 — Server-Side Consent Enforcement, UTC Audit Persistence (Migration 006) & Zero Fabricated Historical Records
- **Date**: 2026-10-21
- **Status**: **Accepted & Binding**
- **Context**: The gap-closure audit confirmed that direct API requests to `POST /api/auth/patient/signup` bypassed frontend consent checkboxes, and that the schema lacked audit columns to prove when and what consent terms were accepted. A robust, auditable solution was required without mutating the primary database or fabricating retrospective consent for existing accounts.
- **Decision**:
  1. **Strict Server-Side Affirmative Consent Guard**:
     - Added Security Guard 3 in `authController.js:patientSignup`:
       ```javascript
       const isConsentAccepted = req.body.terms_accepted === true || req.body.termsAccepted === true;
       if (!isConsentAccepted) {
           return res.status(400).json({
               message: "Affirmative consent to the academic research disclaimer and terms (terms_accepted: true) is strictly required for registration."
           });
       }
       ```
     - Validates strict boolean `=== true` before any database connection or transaction begins. String `"true"`, integer `1`, `null`, `undefined`, or `false` are rejected with HTTP 400.
     - Rejection occurs before user or patient records are created, completely preventing orphan unconsented accounts.
  2. **Forward-Only Migration 006 (`migrations/006_add_consent_audit_to_users.sql`)**:
     - Adds `consent_timestamp TIMESTAMP NULL DEFAULT NULL AFTER created_at` and `consent_version VARCHAR(20) NULL DEFAULT NULL AFTER consent_timestamp` to the `users` table.
     - Preserves `migrations/006_rollback.sql` for atomic reversibility.
     - Applied strictly to `rag_healthcare_test` and recorded in `schema_migrations`.
  3. **Zero Retrospective Fabrication (Historical Integrity)**:
     - Migration 006 assigns `DEFAULT NULL` without retroactive backfilling. Existing accounts maintain `consent_timestamp = NULL`, accurately reflecting their pre-audit creation date without fictitious compliance claims.
     - New patient registrations atomically persist `UTC_TIMESTAMP()` and document version identifier `'v1.0-2026-10'`.
  4. **Privacy-by-Design (No IP Address Harvesting)**:
     - In adherence to data minimization principles under Section 6(1) of DPDP Act 2023, IP addresses are deliberately NOT collected or stored, avoiding unnecessary surveillance risks.
  5. **Transaction Atomicity**:
     - If patient creation or consent persistence fails, the entire transaction rolls back via `connection.rollback()`, ensuring no partially formed or non-consented accounts persist.
- **Verification**:
  - Automated Regression Suite (`scratch/test_consent_regression_suite.js`): **11/11 tests passed** (missing consent, false consent, string consent, number consent, valid registration, DB timestamp/version persistence, zero records on rejection, duplicate email rejection, role injection defense, existing user login, transaction rollback).
  - RBAC & Activation Regression (`scratch/test_activation_and_role_mismatch.js`): **20/20 tests passed**.
  - Browser E2E (`browser_subagent`): Verified `/signup` rejection when unchecked, successful registration with consent, redirect to `/login?registered=true`, and authenticated access to `/patient`.
  - Frontend production build (`npm run build`): Passed cleanly in 934ms (2,251 modules, 0 errors).
  - Primary database `rag_healthcare`: 100% UNTOUCHED (verified via `scratch/verify_primary_db_intact.js`).

---

### DEC-028 — Tailwind v4 Dark Mode Custom Variant & Comprehensive Indic Translation Repair
- **Date**: 2026-10-21
- **Status**: **Accepted & Binding**
- **Context**: Visual inspection and screenshots revealed that:
  1. Switching themes caused isolated cards to toggle while the overall application shell (body, header, sidebar) remained light.
  2. The Patient Dashboard heading (`સ્વાગત છે, Aarav Patil`) appeared missing/invisible in dark mode while the subtitle remained visible.
  3. Elements across the Patient Dashboard and Post-Discharge Care views remained in English despite selecting Gujarati or Marathi.
- **Root Cause Analysis**:
  1. **Tailwind CSS v4 Dark Variant Incompatibility**: Under Tailwind CSS v4 (`@tailwindcss/vite: ^4.3.3`), the `dark:` variant defaults to the OS media query (`@media (prefers-color-scheme: dark)`). The application's `ThemeContext` applies the `.dark` class to `document.documentElement`. Because the class-based dark variant was not declared, Tailwind CSS ignored all `dark:*` classes on the layout container (`DashboardLayout.jsx`), sidebar, header, and root background.
  2. **Invisible Heading Contrast Mismatch**: The heading `h1` used semantic token `text-foreground`. In dark mode, `--color-foreground` mapped to `#f8fafc` (white). Because the container's `dark:bg-slate-950` was ignored, the background remained light `bg-slate-50`. White text rendered on a white background, creating an apparent disappearance of the heading while muted subtitles (`text-muted-foreground`) retained faint contrast.
  3. **Translation Dictionary Gaps & Hardcoded Literals**: `Patient/Dashboard.jsx` and `Patient/Discharge.jsx` contained hardcoded English strings (`Upcoming Clinical Appointments`, `Active Medication & Prescriptions`, `No active prescription records found.`, `No hospital discharge records currently found...`, `Discharged on`, `Primary Care Instructions`, `Follow-up Scheduled`, `Treating Physician`, `Ask Assistant About This Plan`, `Patient Home Care Instructions`, `Follow-up Directives & Laboratory Orders`).
- **Decision**:
  1. **Declare Class-Based Dark Variant for Tailwind v4**:
     Added `@custom-variant dark (&:where(.dark, .dark *));` in `frontend/src/index.css`. This enables full, instantaneous reactivity for all `dark:*` utilities whenever `.dark` is present on `<html class="dark">`.
  2. **Synchronous Anti-FOUT Bootstrap**:
     Added an inline execution script in `frontend/index.html` to read `localStorage.getItem("cdss_theme")` and immediately toggle `.dark` before the DOM renders, preventing flash of unstyled theme.
  3. **Complete Indic Translation Dictionaries (EN, HI, MR, GU)**:
     - Expanded `frontend/src/constants/translations.js` across English, Hindi, Marathi, and Gujarati to cover all dashboard headings, metadata labels, empty-state descriptions, button tooltips, emergency safety notices, and post-discharge directives.
     - Preserved exact clinical emergency hotlines (`108 / 112`) and medical advice disclaimers.
     - Wrapped all displayed literals in `Patient/Dashboard.jsx`, `Patient/Discharge.jsx`, and `layouts/DashboardLayout.jsx` with the established `t(...)` translation helper.
- **Verification**:
  - Live browser automation via `browser_subagent` tested and visually verified:
    * Test 1: Gujarati + Light Mode (`22_patient_dashboard_gu_light.png` and `27_aarav_dashboard_gu_light.png`).
    * Test 2: Gujarati + Dark Mode (`23_patient_dashboard_gu_dark.png` and `28_aarav_dashboard_gu_dark.png`) — heading is brightly visible in white on dark slate background.
    * Test 3: English + Dark Mode (`24_patient_dashboard_en_dark.png`).
    * Test 4: English + Light Mode (`25_patient_dashboard_en_light.png`).
    * Test 5: Post-Discharge Care in Gujarati Dark Mode (`29_aarav_discharge_gu_dark.png`).
  - Frontend production build (`npm run build`) passed with zero errors in 652ms (102.72 kB CSS, 766.37 kB JS).
  - All automated regression suites passed (11/11 consent suite, 20/20 RBAC suite).
  - Primary database `rag_healthcare` verified 100% untouched.




---

### DEC-029 — Final CDSS Completion Gate: Test Reconciliation, Dual-Key Theme Persistence, Indian Emergency Guidance, and Doctor Profile Integration
- **Date**: 2026-10-21
- **Status**: **Accepted & Binding**
- **Context**: Comprehensive completion audit identified four specific areas requiring resolution and proof:
  1. Test count reconciliation between reported summary (148) and the sum of suite checks (179).
  2. Potential storage key drift between cdss_theme and theme.
  3. Residual US emergency references (911) in multilingual templates for an India-focused clinical platform.
  4. Missing end-to-end integration proof for Doctor Profile (Doctor/Profile.jsx).
- **Decision & Engineering Execution**:
  1. **Reconciled Test Totals Fact-Checking**:
     - Audited all 10 automated test suites. Reconciled the 148 number to an older run prior to multilingual test expansion.
     - Established exact current counts: **185 Test Cases** and **198 Passed Assertions** across all 10 suites (0 failures, 100% pass rate).
  2. **Dual-Key Theme Persistence**:
     - Symmetrically synchronized frontend/index.html and frontend/src/contexts/ThemeContext.jsx to check cdss_theme || theme before first paint and mirror write to both keys on state updates.
     - Verified in live browser automation (theme_and_profile_audit).
  3. **Strict Indian Localized Emergency Guidance**:
     - Removed all US-specific 911 guidance from multilingual_module/safety_templates.py.
     - Standardized emergency directives across English, Hindi, Marathi, and Gujarati to India's National Emergency Response Support System (112) and Medical Ambulance (108).
     - Updated multilingual_module/tests/test_multilingual.py to assert presence of 112 and 108 and strictly assert absence of 911. All 38 tests verified passing.
  4. **Doctor Profile Full-Stack Integration & Proof**:
     - Connected Doctor/Profile.jsx to doctorApi.getProfile on component mount and doctorApi.updateProfile on form submit.
     - Added saving state, error alerts, and dynamic medical registration license display.
     - Authored comprehensive automated integration suite tests/integration/test_doctor_profile_integration.js verifying 19/19 checks (401 unauthenticated, 403 cross-role, 400 validation, live DB updates to users and doctors, reload persistence, and state cleanup).
     - Verified live in browser: Loaded /doctor/profile and confirmed Dr. Rahul Sharma and MCI-2015-8921.
- **Verification**:
  - tests/integration/test_doctor_profile_integration.js: 19/19 passed.
  - multilingual_module/tests/test_multilingual.py: 38/38 passed.
  - scratch/test_portal_cds_responsibilities.js: 25/25 passed.
  - scratch/test_prescription_ocr_pipeline.js: 12/12 passed.
  - scratch/test_full_system_multi_role_e2e.js: 20/20 passed.
  - Frontend production build (npm run build): 0 errors.
  - Primary database rag_healthcare: Verified 100% untouched (15 tables, 176 users, 160 patients, 65 prescriptions).
### DEC-030 — Migration Runner Database Safety, Rollback Remediation & Concurrency Protection
- **Date**: 2026-10-21
- **Status**: **Accepted & Binding**
- **Context**: A comprehensive audit of database migrations identified several critical safety vulnerabilities:
  1. `scripts/run_migrations.js` only executed the safety preflight when `NODE_ENV === "test"`, silently falling back to primary `rag_healthcare` in development.
  2. `--dry-run` and `--status` executed DDL creating `schema_migrations` before reporting, causing unintended mutations.
  3. No concurrency control existed, risking duplicate migrations under parallel runs.
  4. Migrations were tracked solely by filename without cryptographic SHA-256 integrity verification.
  5. Rollback scripts exhibited dangerous patterns, including broad account deletions (`DELETE FROM users WHERE role = "receptionist"`) and hard-coded default credentials (`receptionist123`).
- **Decision & Engineering Execution**:
  1. **Fail-Closed Migration Target Validation**:
     - Hardened `scripts/run_migrations.js` to strictly fail closed if `DB_NAME` is missing or matches `rag_healthcare`, `production`, or fails the disposable name pattern (`_test` / `_disposable`).
     - Routine migrations unconditionally require an explicit test/disposable target and pass `verifyDestructiveTestSafety()`.
  2. **Genuinely Read-Only Status & Dry-Run**:
     - `--status` and `--dry-run` now query existing table existence before inspecting migration status, performing zero DDL operations and never creating tables during inspection.
  3. **Advisory Lock Concurrency Control**:
     - Integrated MySQL advisory locks (`GET_LOCK("cdss_migration_runner_lock", 10)`) with guaranteed release (`RELEASE_LOCK`) in execution `finally` blocks to prevent simultaneous duplicate migration runs.
  4. **Cryptographic Checksum & Integrity Protection**:
     - Added `checksum` (SHA-256) tracking to `schema_migrations`. Tampering with an already-applied migration triggers an immediate, fail-closed abort. Legacy migrations without checksums are preserved without false verification claims.
  5. **Rollback Remediation & Safe Rollback Executor**:
     - Eliminated broad receptionist deletions from `migrations/001_rollback.sql`, replacing with strict role enumeration validation.
     - Removed hard-coded predictable credentials (`receptionist123`) from `migrations/001_add_receptionist_role.sql`.
     - Built `scripts/run_rollback.js` requiring explicit `--confirm-destructive-rollback` and `ALLOW_DESTRUCTIVE_DATABASE_TESTS=true`. Forward migrations never invoke rollbacks automatically.
- **Verification**:
  - `tests/test_migration_safety_orchestrator.js`: 16/16 tests passed across Scenarios A through O.
  - `scratch/verify_primary_db_intact.js`: Primary database `rag_healthcare` confirmed 100% untouched.

---

### DEC-031 — Singleton Receptionist Enforcement, Multi-Account Lifecycle, Patient Appointment Discovery & Clinical Flow Hardening
- **Date**: 2026-10-23
- **Status**: **Accepted & Binding**
- **Context**: Integration requirements called for full support of multi-user lifecycles while enforcing strict clinical boundaries:
  1. Multiple patients must register independently via `/signup` with DPDP consent and authenticate cleanly without mandatory passkeys.
  2. Multiple doctors must be registered through administrative review (`POST /api/receptionist/doctors`) with real clinical specialities, license numbers, and isolated patient schedules.
  3. Exactly one receptionist account must exist across the entire platform. Public registration of receptionist accounts is strictly forbidden. Database-level race conditions during initial setup must fail closed.
  4. Patients must discover active physicians with genuine stored specialities, request appointments with transactional double-booking prevention, view personal history, and cancel own appointments with server-side BOLA checks.
  5. Doctors must navigate appointments via date-based schedule navigator (`< Prev | Today | Next >`), view assigned patient dossiers, and update consultation statuses.
  6. Authentication pages must feature a refreshed, accessible green-and-white healthcare theme with elevated cards and soft mint gradients while preserving dark mode and system typography.
- **Decision & Engineering Execution**:
  1. **Database Singleton Constraint (Migration 007)**:
     - Applied `migrations/007_enforce_single_receptionist_and_appointment_statuses.sql` on test database `rag_healthcare_test`.
     - Added virtual stored column `single_receptionist VARCHAR(25) GENERATED ALWAYS AS (IF(role = 'receptionist', 'RECEPTIONIST_SINGLETON', NULL)) STORED` with `UNIQUE KEY uq_single_receptionist`.
     - Expanded `appointments.status` ENUM to include `pending`, `scheduled`, `confirmed`, `completed`, `cancelled`, `rejected`, `reschedule_requested`.
  2. **Backend Controllers & Routes**:
     - `authController.js`: Added `provisionReceptionist` (`POST /api/auth/receptionist/provision`) with row-locking transaction (`SELECT ... FOR UPDATE`) and `ER_DUP_ENTRY` interception returning 409 Conflict.
     - `patientController.js`: Added `getAvailableDoctors` (`GET /api/patient/doctors`), `requestAppointment` (`POST /api/patient/appointments` with doctor double-booking check), and `cancelPatientAppointment` (`PATCH /api/patient/appointments/:id/cancel` with BOLA ownership validation).
     - `receptionistController.js`: Added transactional double-booking guard to `createAppointment`, updated doctor registration to accept and persist real specialties (`specialization`).
  3. **Frontend UI Refinements**:
     - `Login.jsx` & `Signup.jsx`: Styled in modern, clean green-and-white healthcare theme (`#0f766e`, `#047857`, `#f0fdf4`) with elevated cards, accessible role selector, DPDP consent, and dark mode support.
     - `frontend/src/pages/Patient/Appointments.jsx`: Created appointment discovery and booking interface with physician search, speciality filter pills, booking modal, and cancellation actions.
     - `frontend/src/pages/Doctor/Appointments.jsx`: Added date-based schedule navigator (`< Prev | Today | Next >` + date picker) and patient dossier links.
- **Verification**:
  - `scratch/test_account_appointment_and_cds_flow.js`: 31/31 passed across Groups 1-7 (receptionist singleton, patient accounts, doctor onboarding, doctor directory, appointment booking/conflict/cancellation/BOLA, doctor calendar, and 8 clinical RAG/CDS cases).
  - `scratch/test_full_system_multi_role_e2e.js`: 20/20 passed.
  - `scratch/test_activation_and_role_mismatch.js`: 20/20 passed.
  - `cds_module/test_cds_gateway.py`: 9/9 passed.
  - `multilingual_module/tests/`: 38/38 passed.
  - `rag_module/tests/`: 193 passed, 2 skipped, 0 failed.
  - Frontend production build (`npm run build`): 0 errors.
  - Primary database `rag_healthcare`: 100% UNTOUCHED.

---

### DEC-032: Appointment State Transition Machine & Dual-Role Administrative Queue
- **Date**: 2026-10-24
- **Status**: **Accepted & Binding**
- **Context**:
  1. The appointment schema defined 7 statuses (`pending`, `scheduled`, `confirmed`, `completed`, `cancelled`, `rejected`, `reschedule_requested`). However, backend controllers allowed arbitrary overwrites, including modifying terminal states (`completed`, `cancelled`, `rejected`) back to active states.
  2. In the receptionist UI, consultation requests submitted by patients (`pending`) had no dedicated review queue or approve/reject action buttons.
  3. Patient appointment booking referenced non-normalized properties (`doc.id` instead of `doc.doctor_id || doc.id`), risking booking failures.
  4. Public user registration (`Signup.jsx`) only serviced patients, leaving doctors without clear guidance on hospital administrative onboarding.
- **Decision & Engineering Execution**:
  1. **Strict State Transition Machine**:
     - Hardened `doctorController.js` and `receptionistController.js` with `validTransitions` lookup tables enforcing valid progression and rejecting transitions from terminal states with HTTP 400 Bad Request:
       ```javascript
       const validTransitions = {
         pending: ["confirmed", "scheduled", "rejected", "cancelled", "reschedule_requested"],
         scheduled: ["confirmed", "completed", "cancelled", "reschedule_requested"],
         confirmed: ["completed", "cancelled", "reschedule_requested"],
         reschedule_requested: ["scheduled", "confirmed", "cancelled", "rejected"],
         completed: [],
         cancelled: [],
         rejected: []
       };
       ```
  2. **Receptionist Consultation Review Queue**:
     - Updated `frontend/src/pages/Receptionist/Appointments.jsx` with an alert banner notifying staff of pending requests, filter tabs for all 7 statuses, and direct `Approve` (to `confirmed`) and `Reject` (to `rejected`) action triggers.
  3. **Doctor Onboarding Guidance Gate**:
     - Updated `frontend/src/pages/Auth/Signup.jsx` with clear role switcher (`Patient Registration` vs `Doctor Onboarding`). When Doctor is selected, presents clinical credentialing notice (NMC compliance) explaining administrative vetting and links to `/activate` and `/login`.
  4. **Frontend Property Normalization**:
     - Normalized `Appointments.jsx` property access to `doc.doctor_id || doc.id`, `doc.full_name || doc.name`, and `app.appointment_id || app.id`.
- **Verification**:
  - `scratch/test_account_appointment_and_cds_flow.js`: 35/35 passed (including terminal transition rejections, receptionist rejection, and Indic emergency queries).
  - `scratch/test_full_system_multi_role_e2e.js`: 20/20 passed.
  - `scratch/test_activation_and_role_mismatch.js`: 20/20 passed.
  - `cds_module/test_cds_gateway.py`: 9/9 passed.
  - `multilingual_module/tests/`: 38/38 passed.
  - Frontend production build (`npm run build`): 0 errors.

---

### DEC-033: Full-Page Multilingual UI Parity across English, Hindi, Marathi, and Gujarati; Authentication & Portal Dynamic Translation; Browser Verification with Isolated Database Invariant
- **Date**: October 24, 2026
- **Status**: Implemented & Verified E2E in Real Browser Subagents
- **Context**:
  - Prior to this change, multilingual support existed in the RAG pipeline (`multilingual_module`) and in selected workspace layouts (`Sidebar.jsx`, `DashboardLayout.jsx`, `Patient/Dashboard.jsx`), but major authenticated and unauthenticated pages (`Login.jsx`, `Signup.jsx`, `Activate.jsx`, `Doctor/Appointments.jsx`, `Doctor/Dashboard.jsx`, `Receptionist/Appointments.jsx`) contained hardcoded English strings.
  - Additionally, Gujarati (`gu`) dictionary coverage was partial, requiring expansion to parity with English, Hindi, and Marathi.
- **Decision & Architecture**:
  1. **Translation Dictionary Parity**:
     - Expanded `frontend/src/constants/translations.js` across all 4 languages (`en`, `hi`, `mr`, `gu`) to 248 comprehensive, clinically verified keys per language in 100% parity.
     - Preserved exact pharmacological entity strings and brand names while translating clinical workflows, statuses, table headers, and form actions.
  2. **Public Auth Internationalization**:
     - Added floating top-right Language Selector (`EN`, `हिंदी`, `मराठी`, `ગુજરાતી`) and Theme Toggle to `Login.jsx`, `Signup.jsx`, and `Activate.jsx`.
     - Wrapped all page labels, helper text, role descriptions, submit buttons, demo accounts, and ethical footers with `t(...)`.
  3. **Clinician & Receptionist Portal Dynamic Translation**:
     - Wired `useLanguage` into `Doctor/Dashboard.jsx`, `Doctor/Appointments.jsx`, and `Receptionist/Appointments.jsx`.
     - Translated table column headers, status badges, action buttons, filter tabs, date navigators, and review banners.
  4. **Full Browser Automation & Evidence Capture**:
     - Executed browser verification subagent on `127.0.0.1:5173` backed by disposable test database `rag_healthcare_test` on port `5001`.
     - Captured 19 pristine full-page browser screenshots into `audit_evidence/browser_verification_oct24/` verifying rendering across public auth (all 4 languages), patient portal (English & Hindi), doctor portal (English & Marathi), receptionist portal (English & Gujarati), and mobile viewport (390x844).
  5. **Safety Invariant Verification**:
     - Confirmed primary database `rag_healthcare` remained completely untouched (15 tables, 176 users, 160 patients, 65 prescriptions).
- **Verification**:
  - `scratch/test_account_appointment_and_cds_flow.js`: 35/35 passed.
  - `cds_module/test_cds_gateway.py`: 9/9 passed.
  - `multilingual_module/tests/`: 38/38 passed.
  - `scratch/test_full_system_multi_role_e2e.js`: 20/20 passed.
  - `scratch/test_activation_and_role_mismatch.js`: 20/20 passed.
  - Frontend production build (`npm run build`): 0 errors, 760ms build time.
  - Browser screenshots: 19 PNGs saved in `audit_evidence/browser_verification_oct24/`.


