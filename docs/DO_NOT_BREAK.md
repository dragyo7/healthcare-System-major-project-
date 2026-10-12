# DO NOT BREAK — Critical Architectural Invariants

> **Audience**: AI Coding Agents, Teammates, and Future Developers  
> **Rule**: These are non-negotiable architectural constraints and security invariants.  
> **Violation Policy**: Any change violating these rules must be rejected immediately.  

---

## 1. Network & Tier Boundary Invariants
1. **The Browser Must NEVER Call FastAPI Port 8000 Directly**:
   * All browser traffic routes through the Express API gateway (`http://localhost:5000`).
   * Express performs authentication, BOLA checks, and PII sanitization before contacting FastAPI (`http://127.0.0.1:8000`).
2. **The Zero-PII Gateway Boundary Must Remain Strict**:
   * Patient-identifying fields (`name`, `email`, `phone`, `address`, `patient_id`) must NEVER be forwarded to FastAPI.
   * Forward only sanitized clinical tokens (`age`, `gender`, `symptoms`, `allergies`, `active_medications`, `diagnoses`).

---

## 2. Security & Authorization Invariants
3. **Doctor Authorization Must Be Enforced Server-Side**:
   * Do not rely on the frontend UI to hide unauthorized patients.
   * Verify the doctor-patient relationship in MySQL before executing any sensitive EHR query. Return HTTP 403 Forbidden on mismatch.
4. **Patients Must Only Access Their Own Data**:
   * Enforce server-side BOLA checks on patient requests. Attempting to inspect another patient ID must immediately yield HTTP 403 Forbidden.
5. **Receptionists and Administrative Roles Must NEVER Access CDS**:
   * Receptionist and staff accounts are strictly non-clinical.
   * Any call to `/cds/evaluate`, `/rag/*`, or `/api/*/cds` from a non-clinical role must be rejected with HTTP 403.

---

## 3. RAG Intelligence & Knowledge Base Invariants
6. **Patient Data Must NEVER Enter the RAG Knowledge Base**:
   * Do not insert, append, or mutate patient clinical context into the FAISS index, BM25 indices, or persistent DailyMed storage.
   * Patient context is strictly request-scoped and ephemeral.
7. **RAG V2.10 Knowledge Base Is Hard Frozen**:
   * Do not rebuild FAISS (`index_v2.bin`, 2,204 chunks, 384 dimensions).
   * Do not change the embedding model (`BAAI/bge-small-en`).
   * Do not alter the Cross-Encoder model (`cross-encoder/ms-marco-MiniLM-L-6-v2`) or reciprocal rank fusion (`k=60`).
8. **The RAG Grounding Verifier Must Remain Strict and Fail-Closed**:
   * Do not relax token-overlap verification thresholds to artificially inflate answer rates.
   * Withholding unverified output (`withheld_verification_failure`) or abstaining on unsupported queries (`abstained_policy`) is intended clinical safety behavior, not a bug.
9. **Emergency Interception Must Remain Deterministic**:
   * Acute crises (chest pain, severe shortness of breath, heart attack, unconsciousness) must be diverted immediately to emergency protocols (112 / 108 / 911). Never substitute generative LLM text for emergency triage.
10. **Prompt-Injection Defenses Must Remain Active**:
    * Neutralize adversarial overrides early before LLM inference. Never leak system prompts, internal instructions, or chunk debugging metadata.

---

## 4. Multilingual Subsystem Invariants
11. **Do NOT Create Duplicate Vector Indexes Per Language**:
    * Do not build separate Hindi FAISS or Marathi FAISS indices without verified benchmark justification.
    * The single English DailyMed SPL index (2,204 chunks) is authoritative.
    * Multilingual support is an independent cross-cutting translation/canonicalization layer.
12. **Safety-Critical Translations Must Use Pre-Verified Templates**:
    * Never use unconstrained open-ended LLM translation for emergency advice, contraindications, or drug-drug interaction warnings.
    * Always render from authoritative trilingual templates with verified emergency contact numbers.

---

## 5. Schema & Testing Invariants
13. **Do NOT Alter the MySQL Database Schema Casually**:
    * Maintain compatibility with `Dump20261003 (1).sql`.
    * Do not drop or rename tables (`users`, `patients`, `doctors`, `appointments`, `medical_history`, `prescriptions`, `medical_reports`).
14. **All Regression Suites Must Remain 100% Green**:
    * RAG Regression: **190 passed, 2 skipped, 0 failed**
    * CDS Gateway: **9/9 passed**
    * Express Bridge: **7/7 passed**
    * Portal Responsibilities: **25/25 passed**
    * Doctor E2E: **26/26 passed**
    * Multilingual Suite: **16/16 passed**
    * Frontend Builds: **0 errors**
