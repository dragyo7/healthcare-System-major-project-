# PRELIMINARY INTEGRATION ROADMAP (AUDIT-BASED)

**Status**: Preliminary Planning Specification  
**Authority**: Technical Audit & Architecture Alignment  
**Notice**: This roadmap outlines dependencies, blockers, and candidate phases. It is **NOT** a finalized implementation schedule. Final phases will be locked in a dedicated phase-design review.  

---

## 1. Known Integration Requirements

To achieve a production-ready, viva-defensible Clinical Decision Support platform, the system must fulfill the following technical requirements:
1. **Unified Endpoint Routing**: The React Doctor Portal must be capable of communicating with Express without hardcoded `localhost:5000` URLs.
2. **Server-Side Patient Authorization**: The Express backend must enforce that a physician cannot access records for an arbitrary patient without an established, verified clinical assignment.
3. **Context Minimization Bridge**: Express must sanitize patient records into anonymized clinical attributes (stripping PII) before dispatching CDS queries.
4. **Unified CDS Endpoint**: FastAPI must provide an internal orchestration endpoint (`POST /cds/evaluate`) that coordinates the frozen RAG engine and the deterministic `drug_module`.
5. **Interactive Safety Alerts**: The Doctor Portal prescription creation interface must intercept submission to screen candidates for pharmacological conflicts before database insertion.
6. **Frozen RAG Preservation**: Zero modifications to FAISS indices, embeddings, BM25, rerankers, or verifiers during integration.

---

## 2. Known Blockers & Critical Risks

The following technical issues must be resolved before live end-to-end integration can function safely:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   KNOWN BLOCKERS                                       │
├────────────────────────────────┬───────────────────────────────────────────────────────┤
│ 1. Frontend URL Hardcoding     │ `App.jsx` hardcodes `http://localhost:5000` in 15     │
│                                │ locations, preventing proxying or port remapping.      │
├────────────────────────────────┼───────────────────────────────────────────────────────┤
│ 2. Missing Table Crash         │ Controller references `patient_followups`, which is   │
│                                │ absent from `Dump.sql`. Triggers MySQL 500 errors.    │
├────────────────────────────────┼───────────────────────────────────────────────────────┤
│ 3. Horizontal Access Loophole  │ `createAppointment` allows creating appointments with │
│                                │ arbitrary `patient_id` values, bypassing BOLA guards. │
├────────────────────────────────┼───────────────────────────────────────────────────────┤
│ 4. Plaintext Seed Password     │ User ID 2 has password `'patient123'` stored unhashed. │
├────────────────────────────────┼───────────────────────────────────────────────────────┤
│ 5. Unauthenticated Lab Reports │ Uploaded CBC PDFs are served statically without JWTs. │
└────────────────────────────────┴───────────────────────────────────────────────────────┘
```

---

## 3. Subsystem Dependency Graph

```text
                       [ MySQL Seed Data & Config Fixes ]
                                       │
                                       ▼
                       [ Express RBAC & BOLA Hardening ]
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
[ FastAPI Gateway (/cds/evaluate) ]                 [ Doctor Portal React Config ]
            │                                                     │
            ▼                                                     ▼
[ Express-to-FastAPI Internal Client ]              [ Embedded CDS Assistant Panel ]
            │                                                     │
            └──────────────────────────┬──────────────────────────┘
                                       │
                                       ▼
                     [ Pre-Save Prescription Screening ]
                                       │
                                       ▼
                     [ E2E Verification & Demo Snapshot ]
```

---

## 4. Potential Implementation Phase Candidates

The following 8 candidate phases represent natural, risk-minimized chunks of work. Final ordering and grouping will be determined in the next planning step:

### Candidate Phase A: Configuration Abstraction & Clean Seed Environment
- **Focus**: Decouple frontend from `localhost:5000` via `VITE_API_URL`. Hash plaintext password for User 2 in database dump. Isolate/comment out broken `/followups` routes in Express.
- **Dependency**: None.

### Candidate Phase B: Authorization Hardening & Static Report Security
- **Focus**: Restrict appointment creation to prevent horizontal privilege escalation. Wrap `/uploads/reports/` with JWT authentication.
- **Dependency**: Phase A.

### Candidate Phase C: FastAPI CDS Gateway Contract (`POST /cds/evaluate`)
- **Focus**: Implement the Python coordination layer on port 8000 accepting sanitized patient context and dispatching to frozen RAG and drug safety rules.
- **Dependency**: None (can be developed in parallel with Phase A/B).

### Candidate Phase D: Express-to-FastAPI Internal Bridge
- **Focus**: Add internal HTTP client in Express (`axios`) to call FastAPI port 8000. Add patient context sanitization middleware.
- **Dependency**: Phase B and Phase C.

### Candidate Phase E: Doctor Portal Embedded CDS Assistant
- **Focus**: Embed the CDS Assistant UI drawer into `App.jsx` inside the patient dossier view, passing active conditions and allergies into the query prompt.
- **Dependency**: Phase D.

### Candidate Phase F: Prescription Pre-Save Pharmacological Screening
- **Focus**: Add a pre-save check in the Doctor Portal prescription view, triggering the `drug_module` rule engine and displaying warning modals for interacting pairs.
- **Dependency**: Phase D.

### Candidate Phase G: Future Patient Portal Integration (Restricted Patient Mode)
- **Focus**: Implement patient-facing post-discharge assistance interface; enforce strict patient-mode policies.
- **Dependency**: Phase D and Patient Portal package availability.

### Candidate Phase H: Future Receptionist Portal Integration (Administrative)
- **Focus**: Audit Receptionist module; expand `users.role` enum to include `'receptionist'`; connect administrative scheduling workflows.
- **Dependency**: Receptionist Portal package availability.

---

## 5. Open Technical Questions (Marked `OPEN`)

The following design decisions remain open and require deliberate technical confirmation before execution:

1. **[OPEN] Dual Frontend Hosting Strategy**:
   - Should Bhumi's Doctor Portal and the existing CDS demo UI remain two decoupled React applications running on separate ports (`5173` and `5174`), or should they be merged into a unified multi-role React router?
2. **[OPEN] Appointment Booking Governance**:
   - Should doctors be allowed to book appointments with *any* existing patient if an emergency flag is set, or must all new patient bookings go through administrative/receptionist intake?
3. **[OPEN] Pharmacological Alert Override Policy**:
   - When a major drug-drug interaction is detected during prescription creation, should the system enforce a **Hard Block** (cannot save until drug is removed) or a **Soft Block with Clinical Override Documentation** (clinician documents why the combination is clinically justified)?
4. **[OPEN] Report Upload Lifecycle**:
   - Table `medical_reports` contains a `file_path` column, but no upload API exists in the backend. How will new diagnostic lab reports be uploaded in future workflows?
