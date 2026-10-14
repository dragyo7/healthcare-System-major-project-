# API SURFACE SPECIFICATION — EXPRESS & CDS GATEWAY

---

## 1. CURRENT EXPRESS API SURFACE (DOCTOR PORTAL)

All active endpoints are mounted under `/api/auth` or `/api/doctor` on the Node.js/Express server (default port `5000`).

| Method | Path | Authentication | Role Required | Input Payload / Params | Output Response | Database Effect | Current Status |
|---|---|:---:|:---:|---|---|---|:---:|
| `POST` | `/api/auth/doctor/login` | None | Public | Body: `{ email, password }` | `200`: `{ message, token, doctor: { user_id, name, email, role } }` | `SELECT` on `users` | **STABLE** |
| `GET` | `/api/doctor/profile` | Bearer JWT | `doctor` | None | `200`: `{ doctor: { user_id, full_name, email, phone, doctor_id, specialization, qualification, license_number, experience_years, bio } }` | `SELECT` on `users`, `doctors` | **STABLE** |
| `PUT` | `/api/doctor/profile` | Bearer JWT | `doctor` | Body: `{ full_name, phone, specialization, qualification, experience_years, bio }` | `200`: `{ message: "Doctor profile updated successfully" }` | `UPDATE` on `users`, `doctors` | **STABLE** |
| `GET` | `/api/doctor/dashboard` | Bearer JWT | `doctor` | None | `200`: `{ total_patients, today_completed, upcoming_appointments }` | `SELECT COUNT` on `appointments`, `doctors` | **STABLE** |
| `GET` | `/api/doctor/patients` | Bearer JWT | `doctor` | None | `200`: `{ patients: [ { patient_id, full_name, email, phone, date_of_birth, gender, blood_group, address, emergency_contact, allergies } ] }` | `SELECT DISTINCT` on `patients`, `appointments`, `doctors` | **STABLE** |
| `GET` | `/api/doctor/patients/:patientId` | Bearer JWT | `doctor` | Param: `patientId` | `200`: `{ patient, medicalHistory, symptoms, medicalReports, prescriptions, appointments }` | Joins across 7 tables for authorized patient | **STABLE (CRITICAL CDS INPUT)** |
| `GET` | `/api/doctor/schedule` | Bearer JWT | `doctor` | None | `200`: `{ schedule: [ { schedule_id, day_of_week, start_time, end_time, activity_type, location, notes, available } ] }` | `SELECT` on `doctor_schedule`, `doctors` | **STABLE** |
| `POST` | `/api/doctor/schedule` | Bearer JWT | `doctor` | Body: `{ day_of_week, start_time, end_time, activity_type, location, notes, available }` | `201`: `{ message, schedule_id }` | `INSERT` into `doctor_schedule` | **STABLE** |
| `DELETE`| `/api/doctor/schedule/:scheduleId`| Bearer JWT | `doctor` | Param: `scheduleId` | `200`: `{ message: "Schedule deleted successfully" }` | `DELETE` from `doctor_schedule` | **STABLE** |
| `GET` | `/api/doctor/appointments` | Bearer JWT | `doctor` | None | `200`: `{ appointments: [ { appointment_id, patient_id, patient_name, appointment_date, start_time, end_time, reason, status } ] }` | `SELECT` on `appointments`, `patients`, `users` | **STABLE** |
| `POST` | `/api/doctor/appointments` | Bearer JWT | `doctor` | Body: `{ patient_id, appointment_date, start_time, end_time, reason }` | `201`: `{ message, appointment_id }` | `INSERT` into `appointments` | **RISKY (Horizontal escalation loophole)** |
| `PUT` | `/api/doctor/appointments/:appointmentId/status`| Bearer JWT | `doctor` | Param: `appointmentId`<br>Body: `{ status: "completed" \| "cancelled" }` | `200`: `{ message: "Appointment status updated successfully" }` | `UPDATE` on `appointments` | **STABLE** |
| `POST` | `/api/doctor/prescriptions` | Bearer JWT | `doctor` | Body: `{ patient_id, diagnosis, notes, medicines: [ { medicine_name, dosage, frequency, duration, instructions } ] }` | `201`: `{ message: "Prescription created successfully", prescription_id }` | Transactional `INSERT` into `prescriptions` & `prescription_medicines` | **STABLE (Target for Pre-Save Safety Check)** |
| `GET` | `/api/doctor/patients/:patientId/prescriptions` | Bearer JWT | `doctor` | Param: `patientId` | `200`: `{ prescriptions: [ { prescription_id, diagnosis, prescription_date, notes, medicines } ] }` | `SELECT` on `prescriptions`, `prescription_medicines` | **STABLE** |
| `GET` | `/api/doctor/prescriptions/:prescriptionId/pdf` | Bearer JWT | `doctor` | Param: `prescriptionId` | Binary stream: `application/pdf` (`inline; filename=prescription-<id>.pdf`) | `SELECT` on `doctors`, `prescriptions`, `prescription_medicines` | **STABLE** |
| `GET` | `/uploads/reports/:filename` | None | Public | Param: `filename` | Static file stream (`application/pdf`) | Static filesystem read from `uploads/reports/` | **INSECURE (Unauthenticated PII access)** |
| `POST` | `/api/doctor/followups` | Bearer JWT | `doctor` | Body: `{ patient_id, followup_date, reason, notes }` | `500 Server Error`: `Table 'rag_healthcare.patient_followups' doesn't exist` | Fails against missing MySQL table | **BROKEN / DEAD CODE** |
| `GET` | `/api/doctor/followups` | Bearer JWT | `doctor` | None | `500 Server Error`: `Table 'rag_healthcare.patient_followups' doesn't exist` | Fails against missing MySQL table | **BROKEN / DEAD CODE** |

---

## 2. POTENTIALLY DANGEROUS ENDPOINTS IDENTIFIED

### 2.1 Arbitrary Patient Privilege Escalation: `POST /api/doctor/appointments`
- **Location**: `backend/src/controllers/doctorController.js:529-604`
- **Defect**: The handler takes `patient_id` directly from `req.body`, verifies that the patient row exists in MySQL, and immediately executes `INSERT INTO appointments (doctor_id, patient_id, ...)`.
- **Exploitation Impact**: Once that appointment is created, the doctor passes the authorization check in `getPatientDetails`:
  ```sql
  SELECT DISTINCT p.patient_id FROM patients p
  JOIN appointments a ON p.patient_id = a.patient_id
  WHERE p.patient_id = ? AND a.doctor_id = ?
  ```
  This allows an authenticated physician to access the complete confidential medical records, diagnoses, and lab results of **any patient** in the system without patient consent or administrative scheduling approval.
- **Required Hardening**: Restrict appointment creation to administrative intake (Receptionist) or enforce an explicit assignment validation check before insertion.

### 2.2 Unauthenticated Static File Exposure: `GET /uploads/reports/*`
- **Location**: `backend/src/app.js:12-15`
- **Defect**: Uploaded diagnostic PDFs are served through unprotected `express.static`.
- **Exploitation Impact**: Anyone possessing or guessing a URL (e.g., `http://localhost:5000/uploads/reports/aarav_cbc_report.pdf`) can download patient health records without presenting a JWT.
- **Required Hardening**: Route report downloads through an authenticated streaming controller (`GET /api/doctor/reports/:reportId/download`) requiring `Bearer <JWT>`.

---

## 3. PROPOSED FUTURE CDS APIS (SPECIFICATION ONLY — NOT YET IMPLEMENTED)

These endpoints define the target integration contract between the Express backend and the FastAPI CDS subsystem.

### 3.1 `POST /cds/evaluate` (FastAPI CDS Gateway Endpoint on Port 8000)
- **Caller**: Express Backend (Internal Server-to-Server HTTP).
- **Authentication**: Internal Service Token (`X-Internal-Service-Key`).
- **Input Contract**:
  ```json
  {
    "mode": "doctor",
    "clinical_query": "What is the recommended first-line therapy considering the patient's penicillin allergy?",
    "patient_context": {
      "age": 24,
      "gender": "Male",
      "symptoms": ["Headache", "dizziness", "fatigue"],
      "diagnoses": ["Hypertension"],
      "allergies": ["Penicillin"],
      "active_medications": [
        { "name": "Amlodipine", "dosage": "5 mg", "frequency": "Once daily" }
      ]
    }
  }
  ```
- **Output Contract**:
  ```json
  {
    "answer": "For patients with hypertension and penicillin allergy, calcium channel blockers such as amlodipine remain standard first-line therapy...",
    "verification_status": "grounded",
    "citations": [
      {
        "source": "DailyMed",
        "title": "Amlodipine Besylate Tablet",
        "section": "Indications & Usage"
      },
      {
        "source": "ICMR Guidelines",
        "title": "Management of Hypertension in Primary Care"
      }
    ],
    "safety_flags": [],
    "abstention_reason": null
  }
  ```

### 3.2 `POST /cds/screen-prescription` (FastAPI Drug Safety Screening on Port 8000)
- **Caller**: Express Backend before committing `POST /api/doctor/prescriptions`.
- **Input Contract**:
  ```json
  {
    "patient_id": 1,
    "allergies": ["Penicillin"],
    "active_conditions": ["Hypertension"],
    "candidate_medications": [
      { "medicine_name": "Amlodipine", "dosage": "5 mg" },
      { "medicine_name": "Simvastatin", "dosage": "20 mg" }
    ]
  }
  ```
- **Output Contract**:
  ```json
  {
    "screen_status": "warning",
    "contraindications": [],
    "interactions": [
      {
        "drug_a": "Amlodipine",
        "drug_b": "Simvastatin",
        "severity": "Moderate",
        "clinical_effect": "Amlodipine may increase serum concentration of Simvastatin, increasing risk of myopathy.",
        "management": "Limit simvastatin dose to 20 mg daily when co-administered with amlodipine."
      }
    ]
  }
  ```
