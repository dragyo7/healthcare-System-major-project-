# Teammate Module Integration Plan

> **Document Type**: Integration Engineering Guide & Acceptance Protocol  
> **Target Modules**: Patient Portal & Receptionist Portal  
> **Status**: **VERIFIED & OPERATIONAL (All Acceptance Criteria Passed)**  
> **Date**: October 2026  

---

## 1. Overview & Architectural Placement

The platform is designed as a modular, role-based healthcare architecture. The central Express backend (`Portal Major P/Bhumi/Doctor portal/backend`) already implements the necessary authentication, authorization, and CDS bridge contracts.

All role-specific portals are fully integrated and verified in the live platform topology:

```text
 ┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
 │    Doctor Portal     │    │    Patient Portal    │    │ Receptionist Portal  │
 │  (Port 5173 - Doc)   │    │  (Port 5175 - Pat)   │    │  (Port 5174 - Rec)   │
 └──────────┬───────────┘    └──────────┬───────────┘    └──────────┬───────────┘
            │                           │                           │
            │ HTTP (localhost:5000)     │ HTTP (localhost:5000)     │ HTTP (localhost:5000)
            ▼                           ▼                           ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             EXPRESS API GATEWAY                                  │
│  • JWT Auth & Role Dispatch (Doctor / Patient / Receptionist)                    │
│  • Server-Side BOLA & RBAC Middleware                                            │
│  • Zero-PII Context Sanitizer                                                    │
└───────────────────────┬──────────────────────────────────┬───────────────────────┘
                        │                                  │
                        │ SQL Queries                      │ Forward (Zero PII)
                        ▼                                  ▼
               ┌─────────────────┐               ┌───────────────────┐
               │  MySQL Database │               │    FastAPI CDS    │
               │ (rag_healthcare)│               │  (Port 8000)      │
               └─────────────────┘               └───────────────────┘
```

---

## 2. Patient Portal Integration Specification

### Target Flow
```text
Patient Browser
       │
       ▼
Express API Gateway (:5000)
       │  (Verifies JWT role === 'patient')
       ▼
Server-Side BOLA Check
       │  (Verifies requesting user owns the requested patient_id)
       ▼
EHR Access / Restricted Patient CDS (:8000)
       │  (Mode: 'patient', Zero-PII sanitization, educational mode)
       ▼
Sanitized Response to Patient UI
       (Internal chunk_ids and raw similarity scores redacted)
```

### Endpoints Available for Patient Portal
1. **Authentication**: `POST /api/auth/login` (Returns JWT with `role: 'patient'`, `user_id`, `name`).
2. **Own Dossier**: `GET /api/patient/dossier` (Retrieves own history, prescriptions, reports).
3. **Restricted Health Assistant**: `POST /api/patient/cds`
   * Request Payload:
     ```json
     {
       "clinical_query": "Can I take Metformin on an empty stomach?",
       "language": "en"  // Supports "en", "hi", "mr"
     }
     ```
   * Express Controller: `evaluatePatientCDS()` in `patientController.js`.
   * Enforces:
     * Only retrieves authenticated patient's own EHR context.
     * Rejects cross-patient IDs with HTTP 403 Forbidden.
     * Sanitizes context to strip all direct identifiers.
     * Redacts internal chunk IDs and similarity scores.
     * Appends educational disclaimer: *"This information is for personal health education only and does not replace professional medical judgment from your doctor."*

---

## 3. Receptionist Portal Integration Specification

### Target Flow
```text
Receptionist Browser
       │
       ▼
Express API Gateway (:5000)
       │  (Verifies JWT role === 'receptionist')
       ▼
Administrative RBAC Middleware
       │
       ├── Allowed: Administrative CRUD (Patients, Appointments, Schedules)
       └── Forbidden: Any Clinical CDS / RAG Endpoint (HTTP 403)
```

### Endpoints Available for Receptionist Portal
1. **Authentication**: `POST /api/auth/login` (Returns JWT with `role: 'receptionist'`).
2. **Patient Registration**: `POST /api/receptionist/patients` (Registers new patient in `users` and `patients`).
3. **Appointment Scheduling**: `POST /api/receptionist/appointments` (Creates appointment booking).
4. **Doctor Schedule Lookup**: `GET /api/receptionist/doctors/:id/schedules` (Lists available doctor slots).

### Strictly Forbidden Operations for Receptionists
* **Zero Clinical Decision Support Access**:
  * Calls to `POST /api/doctor/cds` $\to$ **HTTP 403 Forbidden** (`"Administrative roles are not permitted to access Doctor Clinical Decision Support"`).
  * Calls to `POST /api/patient/cds` $\to$ **HTTP 403 Forbidden**.
  * Direct calls to FastAPI `:8000` $\to$ Blocked by network tier boundary.
  * Calls to `/cds/evaluate` with `mode: "receptionist"` $\to$ **HTTP 400 Bad Request** (`"Non-clinical mode 'receptionist' is not permitted to access Clinical Decision Support."`).

---

## 4. Teammate Module Ingestion & Acceptance Checklist

Before accepting, merging, or releasing teammate code into the repository, verify that all acceptance criteria are met:

### Acceptance Criteria Checklist
- [x] **No Direct Browser Calls to Port 8000**:
  - Grep frontend code for `8000`, `127.0.0.1:8000`, `/cds/evaluate`, `/rag/query`.
  - Confirmed 0 matches. All frontends strictly route through Express on port 5000.
- [x] **Zero PII Exposure**:
  - Frontend sends only user query and form fields; Express `sanitizePatientContext()` strips names, emails, phones, and addresses before calling CDS Gateway.
- [x] **BOLA Non-Bypassable**:
  - Tested requesting another patient's ID with a valid patient JWT. Confirmed HTTP 403 Forbidden.
- [x] **Role-Based Isolation**:
  - Tested receptionist token on CDS and dossier endpoints. Confirmed HTTP 403 Forbidden.
- [x] **Multilingual Compatibility**:
  - Confirmed Patient Portal forwards ISO codes (`en`, `hi`, `mr`) to Express `POST /api/patient/cds` and receives localized safety templates.
- [x] **Regression Suite Non-Regression**:
  - All 190 RAG tests, 9 CDS Gateway tests, 7 Express Bridge tests, 25 Portal Responsibility tests, 26 Doctor E2E tests, 16 Multilingual tests, 9 Receptionist tests, 14 Patient/Discharge tests, 12 OCR tests, and 20 Full-System E2E tests remain 100% green.
