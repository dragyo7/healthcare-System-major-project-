# SECURITY ARCHITECTURE & VERIFICATION SPECIFICATION

> **Authoritative Security Architecture, Threat Model, and Control Specification**  
> **Project**: Modular AI-Powered Multilingual Clinical Decision Support System (CDSS)  
> **Scope**: Local Synthetic Demo, Threat Modeling, RBAC Enforcement, BOLA Defenses, Rate Limiting & Data Isolation  
> **Last Verified**: October 2026  

---

## 1. System Threat Model & Trust Boundaries

The system processes sensitive electronic health records and provides clinical decision support. The architecture enforces four strict isolation zones:

```text
 Zone 1: Untrusted Ingress (Browser Clients)
         Doctor (5173), Receptionist (5174), Patient (5175)
                           │
                           ▼ HTTPS / Bearer JWT (Strict CORS)
 Zone 2: Policy Enforcement Boundary (Express Gateway :5000)
         • In-Memory Rate Limiting (60 req/min/IP on /api/auth/*)
         • Server-Side Role Enforcement (Doctor, Receptionist, Patient)
         • BOLA / IDOR Scoping (Database queries strictly scoped by req.user.user_id)
         • Privilege Escalation Blockers (Self-registration rejects privileged roles)
         • Zero-PII Sanitization Boundary (Strips all personal identifiers)
                           │
         ┌─────────────────┴─────────────────┐
         │ Internal MySQL (3306)              │ Loopback HTTP (127.0.0.1:8000)
         ▼                                   ▼
 Zone 3: Relational EHR Persistence   Zone 4: Private Clinical Intelligence
         (MySQL: rag_healthcare)             (FastAPI CDS Gateway)
         • bcrypt salt 10                    • Zero Patient PII Received
         • Atomic transactions               • Frozen RAG V2.10 (2,204 chunks)
         • Single-use SHA-256 tokens         • Deterministic Drug Safety Rules
```

### Trust Boundary Invariants
1. **Browser to Backend**: All browser network traffic routes exclusively through Express port 5000. Browser bundles never connect to FastAPI port 8000 or MySQL port 3306.
2. **Backend to Intelligence**: Express strips all Protected Health Information (PHI/PII)—including names, emails, phones, addresses, and database user/patient IDs—before transmitting clinical entity queries to FastAPI.
3. **Intelligence to Knowledge**: The RAG FAISS index contains exclusively published, peer-reviewed medical guidelines (DailyMed, ICMR, MedlinePlus, MoHFW). Patient charts are **never** vectorized, indexed, or saved in FAISS.
4. **Private Bindings**: MySQL daemon and FastAPI CDS server bind exclusively to private loopback (`127.0.0.1`), inaccessible to external networks.

---

## 2. Role-Based Access Control (RBAC) & Endpoint Authorization Matrix

The backend enforces strict server-side role validation in middleware (`authenticateDoctor`, `authenticateReceptionist`, `authenticatePatient`) and controllers. Client-supplied roles in request bodies are ignored or rejected.

| Endpoint / Operation | Allowed Roles | Enforcement Mechanism | Unauthorized Response | Verified Test File |
| :--- | :---: | :--- | :---: | :--- |
| `POST /api/auth/doctor/login` | Unauthenticated | Authenticates doctor credentials; verifies `role === 'doctor'` | `401 Unauthorized` | `test_activation_and_role_mismatch.js` |
| `POST /api/auth/receptionist/login`| Unauthenticated | Authenticates receptionist; verifies `role === 'receptionist'` | `401 Unauthorized` | `test_activation_and_role_mismatch.js` |
| `POST /api/auth/patient/login` | Unauthenticated | Authenticates patient; verifies `role === 'patient'` | `401 Unauthorized` | `test_activation_and_role_mismatch.js` |
| `POST /api/auth/patient/signup`| Unauthenticated | Forces `role = 'patient'`; rejects `role: 'doctor'\|'receptionist'` | `403 Forbidden` | `test_route_authorization_matrix.js` |
| `POST /api/auth/patient/signup` (ID inject)| Unauthenticated | Rejects injected `user_id` or `patient_id` payloads | `400 Bad Request` | `test_route_authorization_matrix.js` |
| `POST /api/auth/patient/activate` | Token holder | Redeems single-use cryptographic token atomically | `400 Bad Request` | `test_activation_and_role_mismatch.js` |
| `GET /api/doctor/patients` | Doctor | Token role must be `'doctor'` | `401 / 403 Forbidden` | `test_route_authorization_matrix.js` |
| `POST /api/doctor/discharge` | Doctor | Token role must be `'doctor'`; creates post-discharge orders | `401 / 403 Forbidden` | `test_route_authorization_matrix.js` |
| `POST /api/doctor/cds` | Doctor | Evaluates clinical decision support with doctor clinical queries | `401 / 403 Forbidden` | `test_full_system_multi_role_e2e.js` |
| `POST /api/doctor/prescriptions/upload-ocr` | Doctor | Multi-part OCR upload with magic-byte validation | `401 / 403 Forbidden` | `test_prescription_ocr_pipeline.js` |
| `POST /api/doctor/prescriptions/confirm-ocr` | Doctor | Explicit clinician sign-off on OCR candidate extractions | `401 / 403 Forbidden` | `test_route_authorization_matrix.js` |
| `GET /api/receptionist/patients` | Receptionist | Token role must be `'receptionist'`; administrative tasks only | `401 / 403 Forbidden` | `test_route_authorization_matrix.js` |
| `GET /api/receptionist/appointments` | Receptionist | Token role must be `'receptionist'`; administrative scheduling | `401 / 403 Forbidden` | `test_receptionist_endpoints.js` |
| `GET /api/patient/profile` | Patient | Token role must be `'patient'`; scopes strictly to `req.user.user_id` | `401 / 403 Forbidden` | `test_route_authorization_matrix.js` |
| `GET /api/patient/prescriptions` | Patient | Token role must be `'patient'`; returns only caller's prescriptions | `401 / 403 Forbidden` | `test_route_authorization_matrix.js` |
| `GET /api/patient/discharge` | Patient | Token role must be `'patient'`; returns only caller's active discharge | `401 / 403 Forbidden` | `test_route_authorization_matrix.js` |
| `POST /api/patient/cds` | Patient | Restricted post-discharge educational Q&A; no prescription changes | `401 / 403 Forbidden` | `test_patient_and_discharge.js` |

---

## 3. Broken Object Level Authorization (BOLA / IDOR) Defenses

To prevent horizontal privilege escalation between patients:
1. **Server-Derived Identity**: All patient database operations derive patient identity exclusively from the authenticated JWT claims (`req.user.user_id`).
2. **Client Parameter Ignore/Sanitization**: Any client payload attempting to inject `patient_id`, `user_id`, or owner IDs in query parameters or request bodies is explicitly ignored or rejected by the controller.
3. **Database Scoping Query Pattern**:
   ```sql
   -- Standard query pattern for patient data isolation
   SELECT p.*, u.full_name, u.email 
   FROM patients p 
   JOIN users u ON p.user_id = u.user_id 
   WHERE p.user_id = ?; -- Bound strictly to req.user.user_id
   ```
4. **Cross-Patient Isolation Test Evidence**:
   - `tests/integration/test_route_authorization_matrix.js` verifies that Patient A querying `GET /api/patient/profile?patient_id=<Patient_B_ID>` receives strictly Patient A's own profile and cannot inspect Patient B's records.
   - `GET /api/patient/prescriptions?patient_id=<Patient_B_ID>` filters strictly to Patient A's own prescription regimens.
   - Deterministic synthetic test suites (`test_patient_and_discharge.js`, `test_full_system_multi_role_e2e.js`) verify that cross-patient access yields either `403 Forbidden` or zero cross-patient records.

---

## 4. In-Memory Rate Limiting on Authentication Endpoints

Authentication endpoints (`/api/auth/*`) are protected by an in-memory sliding-window rate limiter (`src/middleware/rateLimiter.js`):
- **Window**: 60 seconds (1 minute).
- **Limit**: Maximum 60 requests per IP address.
- **Behavior**: Exceeding the threshold immediately returns HTTP `429 Too Many Requests` with a JSON payload and standard security headers:
  - `Retry-After: 60`
  - `X-RateLimit-Limit: 60`
  - `X-RateLimit-Remaining: 0`
  - `X-RateLimit-Reset: <timestamp>`
- **Automatic Garbage Collection**: An active cleanup cycle runs every 5 minutes to prune expired IP tracking entries, preventing memory leaks in the Node.js event loop.

---

## 5. Patient Self-Registration & Account Linking Security

The patient registration endpoint (`POST /api/auth/patient/signup`) enforces rigorous safeguards against account takeover and identity confusion:
1. **Privilege Escalation Prevention**: If the request body contains `role: 'doctor'`, `role: 'receptionist'`, or any role other than `'patient'`, the request is immediately rejected with HTTP `403 Forbidden`.
2. **Arbitrary ID Injection Prevention**: If the request body specifies `user_id` or `patient_id`, the request is immediately rejected with HTTP `400 Bad Request`.
3. **Email & Name Validation**: Requires valid email format regex and a minimum name length of 2 characters.
4. **Staff Intake Conflict Protection**: If a receptionist created a pending patient intake record (marked by the `!ACTIVATION_PENDING$` password sentinel), public self-registration is blocked with HTTP `409 Conflict`, directing the patient to use their activation link rather than creating duplicate orphaned records.
5. **Atomic Multi-Table Transaction**: The user record (`users`) and demographic profile (`patients`) are created inside an atomic MySQL transaction. If any step fails, the entire transaction rolls back, leaving no orphaned rows.
6. **Isolated Demographic State**: Freshly registered self-service accounts receive a distinct patient identity and an honest empty clinical record. Under no circumstances does a self-registered user inherit existing historical medical records.

---

## 6. Cryptographic Single-Use Account Activation Lifecycle

For clinic-initiated patient intake, an offline activation protocol guarantees secure password setup without transmitting plaintext credentials:
1. **Token Generation**: Receptionist creates patient record; system generates a cryptographically random 32-byte hex token (64 characters).
2. **Storage at Rest**: The token is hashed with SHA-256 (`crypto.createHash('sha256')`) and stored in `account_activations` alongside a 72-hour expiration timestamp.
3. **Single-Use Atomic Redemption**:
   ```sql
   UPDATE account_activations 
   SET used_at = NOW() 
   WHERE activation_id = ? AND used_at IS NULL;
   ```
   If `affectedRows === 0`, the token is rejected as expired or already redeemed.
4. **Password Setup**: Patient provides their chosen password (minimum 8 characters), which is salted and hashed with `bcrypt` (10 rounds).
5. **Dangling Token Invalidation**: A maintenance cleanup invalidates unredeemed expired tokens to prevent stale redemption windows.

---

## 7. Zero-PII Context Minimization Boundary (EHR to CDS)

To maintain strict compliance with health data governance (HIPAA Safe Harbor context minimization):
- **Allowed Clinical Data Sent to FastAPI**:
  - Patient Age (computed dynamically from DOB)
  - Gender (`male`, `female`, `other`)
  - Symptoms list (e.g., `["persistent cough", "fever"]`)
  - Known Allergies (e.g., `["penicillin"]`)
  - Diagnosed Conditions (e.g., `["Type 2 Diabetes"]`)
  - Active Medications & Dosages (e.g., `["Metformin 500mg"]`)
  - Physician's Clinical Inquiry
- **Strictly Stripped Identifiers (Zero PII)**:
  - Patient Full Name
  - Email Address
  - Phone Number
  - Residential Address & Emergency Contacts
  - Database `user_id` and `patient_id`
  - National IDs / Aadhaar numbers

---

## 8. Backup Safety, Secrets & Git Leakage Protection

1. **Database Backup Security**:
   - Synthetic database dumps (`scratch/pre_cleanup_backup.sql`) are created during test maintenance.
   - The root `.gitignore` explicitly ignores `scratch/*.sql` and `scratch/*.log` to prevent credential and database dump leakage to source control.
2. **Zero Plaintext Credentials**:
   - All passwords in MySQL (`rag_healthcare`) are stored as valid bcrypt `$2b$10$` hashes (cost factor 10, length 60).
   - Test suites validate hash formatting without using plaintext dictionaries.
3. **JWT Configuration**:
   - JWT tokens are signed using HMAC-SHA256 with 24-hour expiration.
   - Tokens contain strictly minimal claims: `{ user_id: number, role: string }`.

---

## 9. Explicit Deployment Blockers (Local Demo vs. Staging vs. Clinical Production)

| Requirement | Local Demo Status | Staging Gate | Clinical Production Gate |
| :--- | :---: | :---: | :---: |
| **Transport Encryption** | HTTP on localhost | **BLOCKED**: Requires TLS 1.3 / HTTPS on port 443 | **BLOCKED**: End-to-end TLS with HSTS |
| **Database Privileges** | Root / Local user | **BLOCKED**: Requires dedicated least-privilege user | **BLOCKED**: Rotated cloud secrets, no root access |
| **Activation Delivery** | Displayed in Receptionist UI | **BLOCKED**: Out-of-band email/SMS provider required | **BLOCKED**: Certified HIPAA/HL7 delivery pipeline |
| **Session Invalidation** | Client localStorage clear | **BLOCKED**: Server-side token blacklist/revocation required | **BLOCKED**: Distributed Redis revocation store |
| **Network Isolation** | Private loopback | **BLOCKED**: VPC private subnets for DB & FastAPI | **BLOCKED**: Zero-trust service mesh with mTLS |
| **Clinical Governance** | Research Prototype | **BLOCKED**: Not validated for autonomous use | **BLOCKED**: Requires CDSCO / US FDA / CE SaMD clearance |
