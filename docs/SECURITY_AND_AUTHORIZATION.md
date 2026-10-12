# SECURITY & AUTHORIZATION SPECIFICATION

**Scope**: Security, Session Management, Access Control, and Data Privacy Audit  
**Code Evaluated**: `Doctor portal/backend/src/` & `Dump20261003 (1).sql`  
**Standard**: OWASP API Security Top 10 & HIPAA Security Guidelines (Context Minimization)  

---

## 1. CURRENT SECURITY ARCHITECTURE (AS IMPLEMENTED)

```text
HTTP Request
     │
     ▼
[ Express CORS & JSON Parser ]
     │
     ▼
[ authMiddleware.js: authenticateDoctor ]
     ├── 1. Read header: Authorization: Bearer <token>
     ├── 2. jwt.verify(token, process.env.JWT_SECRET)
     └── 3. Check: decoded.role === 'doctor'
            ├── FALSE ──► Return 403 Forbidden ("Doctor access required")
            └── TRUE  ──► Set req.user = decoded, call next()
     │
     ▼
[ doctorController Handler ]
     ├── 1. Query MySQL: SELECT doctor_id FROM doctors WHERE user_id = req.user.user_id
     └── 2. Check Patient Access:
            SELECT DISTINCT p.patient_id FROM patients p
            JOIN appointments a ON p.patient_id = a.patient_id
            WHERE p.patient_id = ? AND a.doctor_id = doctor_id
            ├── FALSE ──► Return 403 Forbidden ("You do not have access to this patient")
            └── TRUE  ──► Execute business logic
```

### Key Implementation Attributes:
- **Hashing**: `bcrypt.compare` with salt rounds $10$ (`authController.js:31`).
- **Token Signing**: `jwt.sign` with HS256 algorithm and 1-day expiration (`authController.js:43-52`).
- **Token Payload**: `{ user_id: number, role: "doctor" }`.
- **Client Storage**: Raw token stored in browser `localStorage.getItem("token")` (`App.jsx`).

---

## 2. SECURITY FINDINGS & RISK RANKING

| Finding ID | Severity | Category | Defect Summary | Code Evidence | Impact |
|---|:---:|---|---|---|---|
| **SEC-01** | **CRITICAL** | Broken Object Level Auth (BOLA) | Horizontal privilege escalation: Doctor can access any patient record by self-inserting an appointment. | `backend/src/controllers/doctorController.js:529-604` | An authenticated doctor can arbitrarily gain read/write access to any patient's dossier in the database. |
| **SEC-02** | **CRITICAL** | Hardcoded Configuration | Hardcoded localhost URLs prevent secure network routing and proxying. | `frontend/src/App.jsx` (15 verified instances of `http://localhost:5000/...`) | Breaks containerized deployments and prevents runtime environment variable injection. |
| **SEC-03** | **HIGH** | Broken Object Property Auth | Unauthenticated static medical report file downloads. | `backend/src/app.js:12-15` (`app.use("/uploads", express.static(...))`) | Anyone on the network can view and download patient CBC lab reports without a token. |
| **SEC-04** | **HIGH** | Credential Exposure | Plaintext password in database seed dump. | `Dump20261003 (1).sql:328` (User ID 2 password is `'patient123'`) | Violates password hashing standards; demonstrates unhashed credential storage. |
| **SEC-05** | **MEDIUM** | Cryptographic Weakness | Trivial, predictable JWT secret in repository `.env`. | `backend/.env:8` (`JWT_SECRET=rag_healthcare_secret`) | Susceptible to dictionary attacks; allows rogue token generation if `.env` leaks. |
| **SEC-06** | **MEDIUM** | Missing Session Invalidation | No token blacklist or server-side revocation on logout. | `frontend/src/App.jsx` (`handleLogout` only calls `localStorage.removeItem`) | Intercepted tokens remain valid until the 24-hour expiration window closes. |
| **SEC-07** | **LOW** | Missing Rate Limiting | No request throttling on authentication endpoint. | `backend/src/app.js` (no `express-rate-limit` installed) | Allows automated credential brute-forcing against `POST /api/auth/doctor/login`. |
| **SEC-08** | **INFORMATIONAL**| Schema Inconsistency | Controller queries non-existent table `patient_followups`. | `backend/src/controllers/doctorController.js:1139, 1180` | Causes unhandled MySQL 500 crashes if follow-up routes are triggered. |

---

## 3. DEEP-DIVE: HORIZONTAL PRIVILEGE ESCALATION (SEC-01)

### The Defect Mechanism:
1. In `doctorController.js`, access to a patient is strictly gated by whether the patient appears in the doctor's appointment list:
   ```javascript
   // backend/src/controllers/doctorController.js lines 154-168
   const [access] = await db.execute(
       `SELECT DISTINCT p.patient_id
        FROM patients p
        JOIN appointments a ON p.patient_id = a.patient_id
        JOIN doctors d ON a.doctor_id = d.doctor_id
        WHERE p.patient_id = ? AND d.user_id = ?`,
       [patientId, userId]
   );
   if (access.length === 0) {
       return res.status(403).json({ message: "You do not have access to this patient" });
   }
   ```
2. However, the appointment creation endpoint contains **zero validation** regarding whether the doctor is permitted to book or treat that patient:
   ```javascript
   // backend/src/controllers/doctorController.js lines 578-591
   const [result] = await db.execute(
       `INSERT INTO appointments
        (doctor_id, patient_id, appointment_date, start_time, end_time, reason, status)
        VALUES (?, ?, ?, ?, ?, ?, 'scheduled')`,
       [doctorId, patient_id, appointment_date, start_time, end_time || null, reason || null]
   );
   ```
3. **Exploit Vector**:
   - Doctor A authenticates legitimately.
   - Doctor A issues `POST /api/doctor/appointments` with payload:
     `{ "patient_id": 2, "appointment_date": "2026-10-10", "start_time": "10:00:00" }`.
   - The row is inserted into MySQL.
   - Doctor A immediately issues `GET /api/doctor/patients/2`.
   - The query finds the newly inserted appointment row and returns Patient 2's complete medical history, symptoms, prescriptions, and lab reports.

### Required Server-Side Hardening:
- In the immediate integration phase, appointment booking should either:
  1. Require validation that the patient is already assigned to the physician.
  2. Or restrict appointment creation authority exclusively to the administrative portal (Receptionist).
- Furthermore, clinical context sent to the CDS Gateway must be sanitized to strip direct identifiers.

---

## 4. PATIENT CONTEXT MINIMIZATION POLICY (FOR CDS CALLS)

When Express relays patient context to the FastAPI CDS Gateway, it must enforce **strict data minimization** (HIPAA Safe Harbor standard):

```text
                    RAW DATABASE DOSSIER (MySQL)
                                 │
     ┌───────────────────────────┴───────────────────────────┐
     ▼                                                       ▼
ALLOWED CLINICAL DATA                                  BLOCKED PERSONAL DATA
(Sent to CDS Gateway)                                  (Stripped Server-Side)
• Age (calculated from DOB)                            • Full Name (u.full_name)
• Gender (p.gender)                                    • Email Address (u.email)
• Symptoms (s.symptoms)                                • Phone Number (u.phone)
• Diagnosed Conditions (m.condition_name)              • Residential Address (p.address)
• Known Allergies (p.allergies)                        • Emergency Contact (p.emergency_contact)
• Active Medications (pm.medicine_name, dose)          • National ID / Aadhaar
• Clinical Query (from Doctor)                         • Raw Database user_id / patient_id
```

> [!NOTE]
> `patient_id` may be logged internally in Express for audit and access-tracing purposes, but must **never be embedded as prompt text** sent to the LLM or Medical RAG engine.
