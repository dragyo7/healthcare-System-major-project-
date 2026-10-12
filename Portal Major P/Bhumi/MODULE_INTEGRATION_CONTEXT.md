# MODULE_INTEGRATION_CONTEXT.md

## Audit Scope and Source-of-Truth Note

This document describes the **Doctor-side portal/backend module** developed as part of the RAG Healthcare project.

**Primary source of truth:** implementation details supplied and developed in the conversation, including the React `App.jsx` implementation, Node/Express backend structure and functions, MySQL schema, API routes, configuration, and verified API behavior.

**Important audit limitation:** the complete repository was **not uploaded as a repository/archive in this conversation**. Therefore, files that were not actually available for inspection are marked **UNVERIFIED** rather than inferred. The document does not claim inspection of unavailable files.

Where the implementation changed during development, the later implementation described in the conversation is treated as the current state where it was explicitly supplied/confirmed. Earlier snippets are identified where they materially differ.

---

# 1. MODULE OVERVIEW

## Module Name

**Doctor Portal / Doctor-side Healthcare Management Module**

The UI identifies the module as:

> RAG Healthcare — Doctor Portal

The larger project title used during development is:

> **A RAG Framework for Clinical Decision Support, Drug Interaction Detection, and Prescription Safety**

## Module Purpose

The module provides the doctor-facing management layer of the healthcare system. It allows an authenticated doctor to:

- log in;
- view dashboard statistics;
- view patients;
- view detailed patient information;
- view symptoms and medical history;
- view previous prescriptions;
- view medical reports;
- create prescriptions;
- manage appointments;
- update appointment status;
- manage a personal schedule;
- view/update professional profile information;
- log out.

## Problem Solved

The module centralizes doctor-side healthcare-management information that would otherwise be distributed across separate records and workflows.

## Role in the Larger Project

This module is the **doctor portal and backend data-management foundation**. It is intended to become one part of the larger healthcare/RAG system.

The AI/RAG clinical-decision-support layer is **not established as implemented in the inspected material**. Drug-interaction detection, prescription-safety analysis, retrieval, embeddings and LLM inference are therefore **UNVERIFIED / NOT IMPLEMENTED IN THIS MODULE**.

## Intended Users / Callers

- Primary user: authenticated doctor.
- Calling client: React doctor portal.
- Parent system: expected to integrate through the existing HTTP APIs.

## Intended Use Cases

- Doctor authentication.
- Doctor dashboard.
- Patient review.
- Appointment management.
- Prescription creation.
- Schedule management.
- Professional-profile management.
- Medical-report viewing.

## Current Capabilities

**Implemented:**

- Doctor login.
- JWT-based protected doctor APIs.
- Password verification using bcrypt.
- Doctor dashboard.
- Patient listing and patient details.
- Symptoms and medical-history display.
- Prescription creation and retrieval.
- Appointment creation/listing/status updates.
- Doctor schedule creation/listing/deletion.
- Doctor profile retrieval/update.
- Medical-report file serving/viewing.
- React-to-Express-to-MySQL integration.

## Current Limitations

- The complete repository was not available for this audit.
- AI/RAG functionality is not evidenced as implemented in this module.
- Drug-drug interaction detection is not evidenced as implemented.
- Drug-condition interaction detection is not evidenced as implemented.
- Prescription safety validation is not evidenced as implemented.
- Patient-side portal is outside the implemented doctor module.
- Appointment-overlap prevention is not evidenced.
- No verified automated test suite was supplied.
- Production deployment/infrastructure is not evidenced.
- HIPAA/GDPR compliance certification is not evidenced.

## Current Implementation Status

**PARTIALLY READY** for integration as a doctor-management module.

The doctor portal and backend APIs are implemented, but the larger RAG/clinical-safety functionality is not part of the verified current module.

---

# 2. COMPLETE PROJECT STRUCTURE

The following structure was explicitly established during development:

```text
RAG_project/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   └── doctorController.js
│   │   ├── middleware/
│   │   │   └── authMiddleware.js
│   │   └── routes/
│   │       ├── authRoutes.js
│   │       └── doctorRoutes.js
│   ├── uploads/
│   │   └── reports/
│   │       └── aarav_cbc_report.pdf
│   ├── .env
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── App.css
│   ├── package.json
│   └── ...
└── rag_healthcare.sql
```

### Important file/component responsibilities

| Component | Purpose | Status |
|---|---|---|
| `backend/server.js` | Loads environment, imports app and starts Express server | IMPLEMENTED |
| `backend/src/app.js` | Creates Express app, CORS/JSON middleware, static uploads, routes | IMPLEMENTED |
| `backend/src/config/db.js` | Creates MySQL connection pool using environment variables | IMPLEMENTED |
| `backend/src/controllers/authController.js` | Doctor login and JWT generation | IMPLEMENTED |
| `backend/src/controllers/doctorController.js` | Doctor business/data operations | IMPLEMENTED |
| `backend/src/middleware/authMiddleware.js` | JWT verification and doctor-role protection | IMPLEMENTED |
| `backend/src/routes/authRoutes.js` | Authentication routes | IMPLEMENTED |
| `backend/src/routes/doctorRoutes.js` | Protected doctor routes | IMPLEMENTED |
| `frontend/src/App.jsx` | Main React doctor portal UI/state/API calls | IMPLEMENTED |
| `frontend/src/App.css` | Doctor portal styling | IMPLEMENTED |
| `backend/uploads/reports/` | Static medical-report files | IMPLEMENTED |
| `rag_healthcare.sql` | SQL dump/schema reference | EXISTENCE ESTABLISHED; exact file contents UNVERIFIED |
| `package.json` files | Dependency/startup metadata | EXISTENCE ESTABLISHED; exact final contents UNVERIFIED |

### Not available for direct inspection

The following were discussed but not supplied as complete files:

- complete repository tree;
- complete final `doctorController.js`;
- complete final `authController.js`;
- complete final `authMiddleware.js`;
- complete final route files;
- complete final `package.json` contents;
- complete final `App.css`;
- complete final SQL dump;
- automated test files;
- deployment/Docker files.

These are therefore **UNVERIFIED** where exact details matter.

---

# 3. TECHNOLOGY STACK

## Programming Languages

- JavaScript — frontend and backend.
- JSX — React UI.
- SQL — MySQL schema/queries.

## Frontend

- React.
- Vite.
- Fetch API for HTTP communication.

The frontend was created using Vite/React.

## Backend

- Node.js.
- Express.js.

## Database

- MySQL.
- `mysql2` Node package.

PostgreSQL was initially installed during development but was removed:

```text
npm uninstall pg
npm install mysql2
```

Therefore the current implementation uses **MySQL**, not PostgreSQL.

## Authentication

- bcrypt for password verification.
- JSON Web Tokens (JWT).

## Other Backend Libraries

The dependency installation recorded during development includes:

- `express`
- `dotenv`
- `cors`
- `bcrypt`
- `jsonwebtoken`
- `mysql2`
- `nodemon` as a development dependency

Exact final dependency versions are **UNVERIFIED** unless present in the final package lock/package file.

## File Storage

Medical report files are served from:

```text
backend/uploads/reports/
```

## AI/ML

No implemented AI/ML model, embedding model, vector database, retrieval implementation, or LLM inference code was available in the inspected module material.

Status: **UNVERIFIED / NOT IMPLEMENTED IN THIS MODULE**

---

# 4. ARCHITECTURE

## Actual architecture

```text
Doctor
  |
  v
React + Vite Doctor Portal
  |
  | HTTP / JSON / Bearer JWT
  v
Node.js + Express
  |
  +--> Authentication Middleware
  |
  +--> Auth Controller
  |
  +--> Doctor Controller
          |
          v
       mysql2
          |
          v
      MySQL
    rag_healthcare

Medical Report Viewing:
React
  |
  v
Express static /uploads
  |
  v
backend/uploads/reports/
```

## Component responsibilities

### React frontend

Responsible for:

- rendering the doctor UI;
- collecting form data;
- maintaining page/UI state;
- storing JWT/doctor information in browser `localStorage`;
- making API requests;
- rendering API responses;
- displaying errors/messages.

### Express application

Responsible for:

- HTTP server/application setup;
- JSON parsing;
- CORS;
- static medical-report file serving;
- mounting authentication and doctor routes.

### Authentication middleware

Responsible for:

- reading the Bearer token;
- verifying JWT;
- making authenticated user information available to protected handlers;
- enforcing doctor-only access.

### Controllers

Responsible for:

- validating relevant request data;
- querying MySQL;
- creating/updating records;
- returning JSON responses.

### MySQL

Responsible for persistent healthcare/doctor data.

---

# 5. COMPLETE END-TO-END FLOW

## Doctor login

```text
Doctor enters email/password
        |
        v
React handleLogin()
        |
        v
POST /api/auth/doctor/login
        |
        v
authController doctorLogin
        |
        +--> SELECT doctor user
        |
        +--> bcrypt password comparison
        |
        +--> JWT generation
        |
        v
JSON token + doctor information
        |
        v
localStorage
        |
        v
Doctor portal unlocked
```

## Protected doctor request

```text
React page/action
        |
        v
fetch()
Authorization: Bearer <JWT>
        |
        v
Express route
        |
        v
authenticateDoctor
        |
        v
doctorController function
        |
        v
mysql2 query
        |
        v
MySQL
        |
        v
JSON response
        |
        v
React state update
        |
        v
Updated UI
```

## Patient details flow

```text
Doctor selects patient
        |
        v
GET /api/doctor/patients/:patientId
        |
        v
authenticateDoctor
        |
        v
getPatientDetails
        |
        +--> patient information
        +--> symptoms
        +--> medical history
        +--> prescriptions
        +--> medical reports
        |
        v
JSON response
        |
        v
PatientDetails component
```

## Prescription flow

```text
Doctor selects patient
        |
        v
Prescription form
        |
        v
POST /api/doctor/prescriptions
        |
        v
authenticateDoctor
        |
        v
createPrescription
        |
        +--> prescriptions row
        |
        +--> prescription_medicines rows
        |
        v
Success response
```

---

# 6. INPUTS AND OUTPUTS

## Inputs

### Login

Input JSON:

```json
{
  "email": "doctor@example.com",
  "password": "..."
}
```

Required:

- `email`
- `password`

### Authenticated APIs

Input header:

```text
Authorization: Bearer <JWT>
```

### Appointment creation

The implementation uses fields corresponding to:

- patient
- appointment date
- start time
- end time
- reason

Exact final validation beyond the known controller behavior is **UNVERIFIED**.

### Appointment status

```json
{
  "status": "completed"
}
```

or another supported appointment status.

### Schedule creation

The current schedule model includes:

- `day_of_week`
- `start_time`
- `end_time`
- `activity_type`
- `location`
- `notes`
- `available`

### Prescription creation

The frontend sends:

- patient
- diagnosis
- notes
- one or more medicines;
- each medicine includes:
  - `medicine_name`
  - `dosage`
  - `frequency`
  - `duration`
  - `instructions`

Exact final request shape should be verified against the final controller before external integration.

## Outputs

Typical backend outputs are JSON.

Login returns:

```json
{
  "message": "Doctor login successful",
  "token": "<JWT>",
  "doctor": {
    "user_id": 1,
    "name": "...",
    "email": "...",
    "role": "doctor"
  }
}
```

Protected operations return either:

- requested records;
- success message;
- created ID;
- or an error message.

---

# 7. API / INTERFACE CONTRACT

## Authentication

### Doctor Login

```text
POST /api/auth/doctor/login
```

Authentication: none.

Purpose: authenticate a doctor and issue JWT.

Request:

```json
{
  "email": "doctor@gmail.com",
  "password": "doctor123"
}
```

Known validation:

- email and password are required.

Success:

```text
200
```

Response contains:

- `message`
- `token`
- `doctor`

Known errors:

```text
400
Email and password are required
```

```text
401
Invalid email or password
```

```text
500
Server error
```

---

## Doctor Profile

### Get profile

```text
GET /api/doctor/profile
```

Authentication: doctor JWT.

Returns doctor/user profile data.

Known fields include:

- `user_id`
- `full_name`
- `email`
- `phone`
- `doctor_id`
- `specialization`
- `qualification`
- `license_number`
- `experience_years`
- `bio`

### Update profile

```text
PUT /api/doctor/profile
```

Authentication: doctor JWT.

Used by the frontend to update professional profile fields.

Exact complete validation/response contract: **UNVERIFIED**.

---

## Dashboard

### Get dashboard

```text
GET /api/doctor/dashboard
```

Authentication: doctor JWT.

Current response shape:

```json
{
  "total_patients": 0,
  "today_completed": 0,
  "upcoming_appointments": 0
}
```

The implementation calculates:

- total distinct patients appearing in appointments for the doctor;
- today's completed appointments;
- scheduled appointments that are in the future or later today.

Important: `total_patients` is based on the current appointment-derived query, not a direct count of all rows in `patients`.

---

## Patients

### List patients

```text
GET /api/doctor/patients
```

Authentication: doctor JWT.

Purpose: retrieve doctor-side patient list.

### Patient details

```text
GET /api/doctor/patients/:patientId
```

Authentication: doctor JWT.

Purpose: retrieve detailed patient information including the data displayed by `PatientDetails`.

---

## Appointments

### List appointments

```text
GET /api/doctor/appointments
```

Authentication: doctor JWT.

Purpose: retrieve appointments for the logged-in doctor.

### Create appointment

```text
POST /api/doctor/appointments
```

Authentication: doctor JWT.

Purpose: create an appointment.

### Update appointment status

```text
PUT /api/doctor/appointments/:appointmentId/status
```

Authentication: doctor JWT.

Request:

```json
{
  "status": "completed"
}
```

Supported database status values are:

```text
scheduled
completed
cancelled
```

---

## Schedule

### List schedule

```text
GET /api/doctor/schedule
```

Authentication: doctor JWT.

The implementation orders days using:

```text
Monday → Tuesday → Wednesday → Thursday → Friday → Saturday → Sunday
```

and then by start time.

### Create schedule

```text
POST /api/doctor/schedule
```

Authentication: doctor JWT.

Current schedule data model:

```json
{
  "day_of_week": "Monday",
  "start_time": "09:00",
  "end_time": "13:00",
  "activity_type": "OPD Consultation",
  "location": "Room 204",
  "notes": "Regular OPD hours"
}
```

The final controller implementation should be checked before external integration because an earlier version accepted only day/start/end and was subsequently expanded.

### Delete schedule

```text
DELETE /api/doctor/schedule/:scheduleId
```

Authentication: doctor JWT.

---

## Prescriptions

### Create prescription

```text
POST /api/doctor/prescriptions
```

Authentication: doctor JWT.

Creates a prescription and its medicine records.

### Get patient prescriptions

```text
GET /api/doctor/patients/:patientId/prescriptions
```

Authentication: doctor JWT.

Returns previous prescriptions for the patient.

---

## Static Medical Reports

The Express application exposes:

```text
/uploads
```

as a static directory mapped to:

```text
backend/uploads/
```

The frontend constructs report links from the stored `file_path`.

---

# 8. DATABASE / STORAGE

## Database

```text
MySQL
Database: rag_healthcare
```

Connection implementation:

```text
backend/src/config/db.js
```

uses `mysql2.createPool()` and environment variables.

## Tables

### `users`

```text
user_id
full_name
email
password
role
phone
created_at
```

Roles:

```text
doctor
patient
```

### `doctors`

```text
doctor_id
user_id
specialization
qualification
license_number
experience_years
bio
```

### `patients`

```text
patient_id
user_id
date_of_birth
gender
blood_group
address
emergency_contact
allergies
```

### `medical_history`

```text
history_id
patient_id
condition_name
diagnosis
diagnosed_date
notes
```

### `symptoms`

```text
symptom_id
patient_id
symptoms
severity
description
reported_date
```

### `appointments`

```text
appointment_id
doctor_id
patient_id
appointment_date
start_time
end_time
reason
status
```

### `prescriptions`

```text
prescription_id
doctor_id
patient_id
diagnosis
prescription_date
notes
```

### `prescription_medicines`

```text
medicine_id
prescription_id
medicine_name
dosage
frequency
duration
instructions
```

### `doctor_schedule`

Current expanded schema:

```text
schedule_id
doctor_id
day_of_week
start_time
end_time
activity_type
location
notes
available
```

The schema was explicitly altered to add:

```sql
activity_type
location
notes
```

### `medical_reports`

```text
report_id
patient_id
report_type
report_name
report_date
report_summary
file_path
```

## Relationships

```text
users
  ├── doctors
  └── patients

doctors
  ├── appointments
  ├── prescriptions
  └── doctor_schedule

patients
  ├── medical_history
  ├── symptoms
  ├── appointments
  ├── prescriptions
  └── medical_reports

prescriptions
  └── prescription_medicines
```

Foreign keys use `ON DELETE CASCADE` in the supplied schema.

## Storage Ownership

This module owns/uses:

- doctor portal records;
- patient records used by the portal;
- appointments;
- prescriptions;
- schedules;
- report metadata;
- uploaded report files.

The broader system's ownership boundaries are **UNVERIFIED**.

---

# 9. AI / ML / ALGORITHMIC COMPONENTS

## Verified AI/ML functionality

**None verified in the doctor portal implementation supplied.**

The larger project is intended to contain:

- RAG;
- clinical decision support;
- drug interaction detection;
- prescription safety;
- medical knowledge sources.

However, no implementation of:

- embeddings;
- FAISS;
- Pinecone;
- PubMed retrieval;
- DrugBank retrieval;
- WHO retrieval;
- LLM inference;
- reranking;
- prompt pipeline;
- model files;

was available in the inspected module source.

Therefore these are:

**UNVERIFIED / OUTSIDE CURRENT DOCTOR PORTAL MODULE**

No embedding dimension, model version, GPU requirement, retrieval threshold, or inference latency can be truthfully specified.

---

# 10. CONFIGURATION

The backend `.env` structure established during development is:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=<SECRET>
DB_NAME=rag_healthcare
JWT_SECRET=<SECRET>
```

Actual secret values are intentionally not documented.

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | Yes/currently used | Express server port |
| `DB_HOST` | Yes | MySQL host |
| `DB_USER` | Yes | MySQL username |
| `DB_PASSWORD` | Yes | MySQL password |
| `DB_NAME` | Yes | Database name |
| `JWT_SECRET` | Yes | JWT signing/verification secret |

Default port behavior in `server.js`:

```text
process.env.PORT || 5000
```

The frontend currently contains hard-coded backend URLs such as:

```text
http://localhost:5000
```

This is an integration-sensitive runtime assumption.

---

# 11. DEPENDENCIES AND PREREQUISITES

## Required Runtime Dependencies

- Node.js runtime.
- Express.
- mysql2.
- dotenv.
- cors.
- bcrypt.
- jsonwebtoken.
- React/Vite for the frontend.

## Required External Services

- MySQL server.

No external AI service is verified for this module.

## Required Database

```text
MySQL
rag_healthcare
```

The database schema and required records must exist before normal data operations can work.

## Required Configuration

The `.env` variables listed above.

## Development Dependencies

- `nodemon` was installed as a development dependency.

Exact final package versions: **UNVERIFIED**.

---

# 12. HOW TO RUN

Only commands explicitly established during development are documented here.

## Backend dependency installation

The development sequence included:

```bash
npm init -y
npm install express pg dotenv cors bcrypt jsonwebtoken
npm install --save-dev nodemon
npm uninstall pg
npm install mysql2
```

The final installation state uses MySQL rather than PostgreSQL.

## Backend startup

`server.js` starts the application using:

```text
node server.js
```

A nodemon workflow was installed, but the exact final `package.json` scripts are **UNVERIFIED**.

## Backend URL

Default:

```text
http://localhost:5000
```

Root health response:

```text
GET /
```

returns a message equivalent to:

```json
{
  "message": "RAG Healthcare Backend is running"
}
```

## Frontend

The frontend was built with Vite/React.

Exact final startup command is **UNVERIFIED** because the final `frontend/package.json` was not supplied for direct inspection.

The development frontend was operated using the standard Vite development environment during development, but an exact port should be treated as **UNVERIFIED** unless read from the final package/configuration.

## Database setup

The schema described in this document must exist in MySQL.

The repository was expected to contain:

```text
rag_healthcare.sql
```

but the actual final SQL file was not supplied for direct audit.

---

# 13. INTEGRATION BOUNDARY

## Recommended integration boundary based on the existing implementation

The parent system should integrate with this module through the existing HTTP API layer rather than directly manipulating its React state.

```text
Parent System
      |
      v
Integration Layer / HTTP Client
      |
      v
Doctor Portal Backend
Node.js + Express
      |
      +--> JWT Authentication
      |
      +--> Doctor Controllers
      |
      v
MySQL rag_healthcare

Medical Reports:
Backend --> /uploads --> stored report files
```

## Parent System Must Provide

- network access to the backend;
- MySQL database or compatible existing database populated with the required schema;
- environment configuration;
- secure JWT secret management;
- appropriate authentication/session integration if replacing the current login flow;
- access to report storage if reports are externalized;
- compatible request/response contracts.

## This Module Provides

- doctor login API;
- authenticated doctor APIs;
- doctor profile;
- dashboard statistics;
- patient data retrieval;
- patient detail retrieval;
- appointment management;
- schedule management;
- prescription management;
- static medical-report serving.

## Integration Flow

```text
Parent Application
       |
       | HTTP + JSON + Bearer JWT
       v
/api/auth/doctor/login

       and

/api/doctor/*
       |
       v
authenticateDoctor
       |
       v
Doctor Controller
       |
       v
MySQL
```

The existing API layer is the natural integration boundary demonstrated by the implementation.

---

# 14. INTENDED USE

## Why this module exists

To provide the doctor-facing operational interface for the healthcare system.

## Who should call it

An authenticated doctor through the React portal or a compatible client.

## When it should be called

- when a doctor logs in;
- when viewing patient information;
- when managing appointments;
- when managing schedules;
- when creating/viewing prescriptions;
- when viewing/updating profile information.

## Expected inputs

Authenticated HTTP requests and the data described by the API contracts.

## Expected outputs

JSON records/status responses and report-file access.

## What it should NOT currently be used for

The module should not be assumed to provide:

- medical diagnosis by AI;
- RAG retrieval;
- LLM clinical reasoning;
- drug interaction analysis;
- prescription safety validation;
- automated clinical recommendations.

Those capabilities are **not verified in this module**.

---

# 15. TESTING AND VERIFICATION

## Verified during development

The following backend endpoints were explicitly tested successfully during development:

- `GET /api/doctor/profile`
- `GET /api/doctor/dashboard`
- `GET /api/doctor/patients`
- `GET /api/doctor/patients/1`
- `GET /api/doctor/schedule`
- `GET /api/doctor/appointments`
- `POST /api/doctor/prescriptions`
- `GET /api/doctor/patients/1/prescriptions`
- `POST /api/doctor/appointments`
- `PUT /api/doctor/appointments/2/status`
- `PUT /api/doctor/profile`
- `POST /api/doctor/schedule`

DELETE schedule existed in the implementation, but a successful DELETE test was not explicitly recorded.

## Feature verification status

| Feature | Status | Evidence |
|---|---|---|
| Doctor login | VERIFIED | Implemented and tested |
| JWT authentication | VERIFIED | Login/protected APIs implemented |
| Doctor profile retrieval | VERIFIED | Endpoint tested |
| Doctor profile update | VERIFIED | Endpoint tested and persistence checked |
| Dashboard | VERIFIED | Endpoint tested |
| Patient list | VERIFIED | Endpoint tested |
| Patient details | VERIFIED | Endpoint tested |
| Prescriptions | VERIFIED | Create/get endpoints tested |
| Appointments | VERIFIED | Create/list/status endpoints tested |
| Schedule retrieval | VERIFIED | Endpoint tested |
| Schedule creation | VERIFIED | Endpoint tested |
| Schedule deletion | PARTIALLY VERIFIED | Implementation exists; successful test not recorded |
| Medical report viewing | VERIFIED in development | Report opened through frontend |
| Automated test suite | UNVERIFIED | No test repository supplied |
| AI/RAG | NOT IMPLEMENTED IN THIS MODULE / UNVERIFIED | No source supplied |
| Drug interaction detection | NOT IMPLEMENTED IN THIS MODULE / UNVERIFIED | No source supplied |

---

# 16. FAILURE MODES

## Login

### Missing email/password

Trigger:

```text
email or password absent
```

Current behavior:

```text
HTTP 400
Email and password are required
```

### Invalid credentials

Current behavior:

```text
HTTP 401
Invalid email or password
```

### Server/database failure

Current behavior:

```text
HTTP 500
Server error
```

---

## Missing doctor record

Several doctor controller functions first resolve the doctor associated with the authenticated user.

If no doctor is found, the implementation returns:

```text
HTTP 404
Doctor not found
```

---

## Profile not found

Known behavior:

```text
HTTP 404
Doctor profile not found
```

---

## Database/server exception

Controllers generally log the error to the server console and return:

```text
HTTP 500
Server error
```

Exact per-endpoint error behavior should be checked against the final controller source before integration.

---

## Frontend cannot reach backend

The frontend catches fetch errors and displays/records connection errors such as:

```text
Unable to connect to server
```

---

## Invalid/expired JWT

The authentication middleware is responsible for rejecting invalid authentication.

Exact status/body for every JWT failure condition is **UNVERIFIED** from the supplied material.

---

# 17. SECURITY

## Authentication

Implemented:

- doctor login;
- bcrypt password verification;
- JWT authentication;
- Bearer-token protected doctor endpoints;
- doctor-role checking.

## Password security

Passwords are not compared as plaintext in the login controller. bcrypt is used for verification.

## Secrets

The `.env` file contains sensitive values such as:

- MySQL password;
- JWT secret.

These must not be committed/shared.

Actual secret values are deliberately excluded from this document.

## Authorization

Doctor routes are protected by `authenticateDoctor`.

The middleware checks the authenticated JWT/user role before allowing doctor operations.

## Database access

Database credentials are read from environment variables.

## Input validation

The login controller validates required email/password.

Schedule creation validates required fields and allowed weekday values.

Other endpoint validation exists to some degree, but complete final validation coverage is **UNVERIFIED**.

## File access

Medical reports are exposed through an Express static `/uploads` path.

This is a security-sensitive integration boundary because static-file authorization behavior was not independently verified.

## Sensitive healthcare data

The database contains:

- patient identity;
- phone/contact information;
- allergies;
- symptoms;
- medical history;
- prescriptions;
- medical reports.

These should be treated as sensitive health information.

## Security risks currently requiring integration attention

- `localStorage` is used by the frontend to store the JWT.
- Backend URLs are hard-coded to localhost in frontend code.
- Static upload exposure requires deployment-level access review.
- Production HTTPS/TLS configuration is not documented.
- Rate limiting is not evidenced.
- Audit logging is not evidenced.
- Encryption-at-rest is not evidenced.
- HIPAA/GDPR compliance is not verified.

These are documented risks, not redesign recommendations.

---

# 18. PERFORMANCE AND RESOURCES

No formal performance benchmarks were supplied.

| Resource | Status |
|---|---|
| CPU | UNKNOWN |
| GPU | NOT REQUIRED BY VERIFIED MODULE |
| RAM | UNKNOWN |
| Storage | UNKNOWN |
| Startup time | UNKNOWN |
| API latency | UNKNOWN |
| Database throughput | UNKNOWN |
| Concurrent users | UNKNOWN |
| AI inference latency | NOT APPLICABLE / UNVERIFIED |

The verified module is primarily a Node/Express + MySQL CRUD/authentication application. No measured benchmark should be inferred.

---

# 19. INTEGRATION RISKS

| Risk | Severity | Explanation |
|---|---|---|
| API contract mismatch | HIGH | Parent system must preserve existing paths/methods/request shapes |
| Database schema mismatch | HIGH | Controllers depend directly on MySQL table/column names |
| JWT/authentication mismatch | HIGH | Protected endpoints expect the current Bearer JWT behavior |
| Environment-variable mismatch | HIGH | Database and JWT initialization depends on exact variable names |
| Static-file path mismatch | MEDIUM | Report links depend on `/uploads` and `file_path` behavior |
| Hard-coded localhost backend URL | MEDIUM | Frontend assumes `http://localhost:5000` |
| Node/runtime version mismatch | MEDIUM | Exact final version requirements are UNVERIFIED |
| Missing database data | HIGH | Portal relies on relational healthcare records |
| Appointment logic assumptions | MEDIUM | Dashboard calculations depend on appointment records/status/time |
| Schedule schema mismatch | HIGH | Current schedule uses added activity/location/notes columns |
| Missing AI layer | HIGH for full project | Doctor portal alone does not provide the planned RAG/clinical-safety functionality |
| Missing automated tests | MEDIUM | No supplied automated regression suite was verified |

---

# 20. DOCUMENTATION VS IMPLEMENTATION

| Documentation/Claim | Actual Implementation Evidence | Status |
|---|---|---|
| Module is a Doctor Portal | React UI explicitly labels itself Doctor Portal | MATCH |
| MySQL is used | `mysql2` pool and MySQL schema are implemented | MATCH |
| PostgreSQL is used | `pg` was initially installed but later uninstalled | MISMATCH if older docs claim PostgreSQL |
| Doctor login exists | `/api/auth/doctor/login` implemented | MATCH |
| JWT authentication exists | JWT generation and authentication middleware implemented | MATCH |
| Doctor profile exists | GET/PUT profile APIs implemented | MATCH |
| Dashboard exists | `/api/doctor/dashboard` implemented | MATCH |
| Patient management exists | Patient list/detail APIs implemented | MATCH |
| Prescription management exists | Create/get prescription APIs implemented | MATCH |
| Appointment management exists | List/create/status APIs implemented | MATCH |
| Schedule exists | List/create/delete APIs implemented | MATCH |
| Schedule has activity/location/notes | Schema was explicitly expanded and frontend was updated for these fields | MATCH with later implementation |
| RAG is part of overall project | Project intent says yes | DOES NOT ESTABLISH IMPLEMENTATION IN THIS MODULE |
| Drug interaction detection is implemented | No such implementation was supplied | UNVERIFIED / NOT IMPLEMENTED IN THIS MODULE |
| HIPAA/GDPR compliance | No compliance verification supplied | UNVERIFIED |

An exact repository README was not supplied, so a complete README-vs-code comparison is **UNVERIFIED**.

---

# 21. WHAT MUST NOT BE BROKEN

## API paths and methods

These are integration-sensitive:

```text
POST /api/auth/doctor/login

GET  /api/doctor/profile
PUT  /api/doctor/profile

GET  /api/doctor/dashboard

GET  /api/doctor/patients
GET  /api/doctor/patients/:patientId

GET  /api/doctor/appointments
POST /api/doctor/appointments
PUT  /api/doctor/appointments/:appointmentId/status

GET  /api/doctor/schedule
POST /api/doctor/schedule
DELETE /api/doctor/schedule/:scheduleId

POST /api/doctor/prescriptions
GET  /api/doctor/patients/:patientId/prescriptions
```

Changing these casually can break the React client and parent integration.

## Database schema

The following names are integration-sensitive:

- table names;
- primary-key names;
- foreign-key names;
- `doctor_id`;
- `patient_id`;
- `appointment_id`;
- `prescription_id`;
- schedule fields;
- appointment `status` values.

The controller SQL directly references these names.

## Authentication

The current frontend sends:

```text
Authorization: Bearer <token>
```

Protected routes depend on this behavior.

## Environment variable names

Do not casually rename:

```text
PORT
DB_HOST
DB_USER
DB_PASSWORD
DB_NAME
JWT_SECRET
```

without updating the implementation.

## Report path

The backend maps:

```text
/uploads
```

to the uploads directory. Existing frontend report links depend on this.

---

# 22. CURRENT STATUS

| Component | Status | Evidence | Notes |
|---|---|---|---|
| Core doctor portal | IMPLEMENTED AND VERIFIED | React implementation + development testing | Functional doctor-side management |
| Authentication | IMPLEMENTED AND VERIFIED | Login controller/middleware + endpoint testing | JWT + bcrypt |
| APIs | IMPLEMENTED AND VERIFIED | Routes/controllers + endpoint tests | Main CRUD/auth endpoints tested |
| Database | IMPLEMENTED AND VERIFIED | MySQL schema + controller SQL | Exact final dump not directly audited |
| Patient module | IMPLEMENTED AND VERIFIED | Patient APIs/UI + test data | Includes details |
| Appointment module | IMPLEMENTED AND VERIFIED | APIs + UI + status update | Dashboard calculations depend on appointments |
| Prescription module | IMPLEMENTED AND VERIFIED | APIs + UI + database | Multiple medicines supported by schema/UI |
| Schedule module | IMPLEMENTED AND PARTIALLY VERIFIED | APIs + schema + UI | Delete success test not recorded |
| Medical reports | IMPLEMENTED AND VERIFIED IN DEVELOPMENT | Static serving + report opening | Production access security UNVERIFIED |
| Configuration | IMPLEMENTED BUT PARTIALLY VERIFIED | `.env` structure and server code | Final files not uploaded |
| Automated tests | UNVERIFIED | No test suite supplied | Manual/API verification recorded |
| AI/RAG | NOT IMPLEMENTED IN THIS MODULE / UNVERIFIED | No implementation supplied | Intended for larger project |
| Security | IMPLEMENTED BUT PARTIALLY VERIFIED | JWT/bcrypt/role middleware | Production security controls not verified |
| Integration readiness | PARTIALLY READY | APIs/backend/UI exist | Requires environment/database/auth alignment |

---

# 23. INTEGRATION CHECKLIST

### Runtime

- [ ] Install required Node.js runtime.
- [ ] Install backend dependencies.
- [ ] Install frontend dependencies.
- [ ] Configure `.env`.
- [ ] Do not expose secrets.
- [ ] Start MySQL.
- [ ] Create/restore `rag_healthcare` schema.
- [ ] Verify required tables and foreign keys.
- [ ] Ensure report storage exists.

### Backend

- [ ] Start Express backend.
- [ ] Verify `GET /`.
- [ ] Verify doctor login.
- [ ] Verify JWT-protected endpoint.
- [ ] Verify database connection.

### Frontend

- [ ] Start React/Vite application.
- [ ] Confirm backend base URL.
- [ ] Confirm login.
- [ ] Confirm dashboard.
- [ ] Confirm patient retrieval.
- [ ] Confirm appointments.
- [ ] Confirm prescriptions.
- [ ] Confirm schedule.
- [ ] Confirm profile.
- [ ] Confirm medical-report access.

### Parent-system integration

- [ ] Preserve API routes/methods.
- [ ] Preserve request/response contracts.
- [ ] Configure authentication integration.
- [ ] Provide compatible database schema/data.
- [ ] Verify report-file access.
- [ ] Test successful requests.
- [ ] Test authentication failures.
- [ ] Test database failures.
- [ ] Test missing/invalid records.
- [ ] Test appointment status transitions.

---

# 24. FINAL INTEGRATION SUMMARY

## What This Module Does

Provides a doctor-facing healthcare management portal backed by Node.js, Express and MySQL.

## What Is Already Implemented

- Doctor login.
- JWT authentication.
- bcrypt password verification.
- Doctor dashboard.
- Patient listing/details.
- Symptoms and medical history display.
- Prescription creation/retrieval.
- Appointment creation/listing/status management.
- Doctor schedule management.
- Doctor profile management.
- Medical-report access.

## What It Depends On

- Node.js.
- React/Vite frontend.
- Express backend.
- MySQL.
- Required database schema.
- Environment variables.
- JWT secret.
- Stored medical-report files where applicable.

## What It Provides

HTTP endpoints under:

```text
/api/auth
/api/doctor
```

plus static report access under:

```text
/uploads
```

## How It Should Be Integrated

Use the existing HTTP API boundary and preserve:

- route paths;
- HTTP methods;
- JWT Bearer authentication;
- request/response structures;
- database schema expectations.

## What the Parent System Must Provide

- runtime;
- database;
- configuration/secrets;
- network connectivity;
- compatible authentication handling;
- report storage/access if required;
- integration testing.

## Current Limitations

- AI/RAG pipeline not verified in this module.
- Drug-interaction logic not verified.
- Prescription safety analysis not verified.
- Patient portal not verified as part of this module.
- Production infrastructure not supplied.
- Automated test suite not supplied.
- Full repository audit was not possible because the repository itself was not uploaded.

## Known Risks

- Direct database coupling.
- JWT contract coupling.
- Hard-coded frontend backend URL.
- Static report exposure.
- Lack of verified automated tests.
- Production security controls not verified.

## Missing Pieces

For the larger RAG healthcare system:

- RAG retrieval implementation.
- Embedding/vector-store implementation.
- LLM inference.
- Clinical knowledge ingestion.
- Drug interaction engine.
- Prescription safety engine.
- Patient-side portal.

These are **UNVERIFIED / OUTSIDE THIS MODULE** rather than assumed to be absent from the entire project.

## Recommended Integration Boundary

```text
Parent System
      |
      v
HTTP/API Integration Layer
      |
      v
Doctor Portal Backend
      |
      +--> Authentication
      +--> Doctor Controllers
      |
      v
MySQL
```

## Things That Must Not Be Changed Casually

- API paths and HTTP methods.
- JWT/Bearer authentication behavior.
- Database table/column names.
- Foreign-key relationships.
- Appointment status values.
- Schedule fields.
- Report `/uploads` mapping.
- Environment-variable names.

## Overall Integration Readiness

### PARTIALLY READY

The doctor-side module has a functioning API/database/UI foundation and multiple manually verified endpoints. It is suitable as an integration component for the doctor-management portion, but a complete production integration cannot be declared ready because the full repository, automated test suite, deployment configuration and larger AI/RAG layer were not available for this audit.

---

# 25. AUDIT EVIDENCE

## Source material inspected/available in this conversation

### Frontend source

- `App.jsx` supplied as pasted source.
- React state, login, logout, API calls, navigation, patient details, appointments, prescriptions, schedule and profile implementation were inspected through the supplied source material.

### Backend implementation evidence

The following were explicitly established in the development record:

- `backend/server.js`
- `backend/src/app.js`
- `backend/src/config/db.js`
- `backend/src/controllers/authController.js`
- `backend/src/controllers/doctorController.js`
- `backend/src/middleware/authMiddleware.js`
- `backend/src/routes/authRoutes.js`
- `backend/src/routes/doctorRoutes.js`

### Database evidence

The following schema definitions were established:

- `users`
- `doctors`
- `patients`
- `medical_history`
- `symptoms`
- `appointments`
- `prescriptions`
- `prescription_medicines`
- `doctor_schedule`
- `medical_reports`

The `doctor_schedule` schema was subsequently altered to include:

```text
activity_type
location
notes
```

### Configuration evidence

The backend environment variable names were established as:

```text
PORT
DB_HOST
DB_USER
DB_PASSWORD
DB_NAME
JWT_SECRET
```

Actual secret values are intentionally excluded.

### File evidence

A medical report file was established during development:

```text
backend/uploads/reports/aarav_cbc_report.pdf
```

### Manual/API verification evidence

Explicitly recorded successful endpoint tests:

```text
GET  /api/doctor/profile
GET  /api/doctor/dashboard
GET  /api/doctor/patients
GET  /api/doctor/patients/1
GET  /api/doctor/schedule
GET  /api/doctor/appointments
POST /api/doctor/prescriptions
GET  /api/doctor/patients/1/prescriptions
POST /api/doctor/appointments
PUT  /api/doctor/appointments/2/status
PUT  /api/doctor/profile
POST /api/doctor/schedule
```

DELETE schedule implementation exists, but a successful DELETE verification was not recorded.

## Not directly available for audit

- Complete repository archive.
- Final complete `package.json` contents.
- Final `package-lock.json`.
- Complete final SQL dump.
- Complete final CSS.
- Automated test files/results.
- Docker/deployment files.
- AI/RAG source files.
- Model/vector-index files.
- Production configuration.

These remain **UNVERIFIED**.

---

## Final Consistency Check

| Check | Result |
|---|---|
| Documented APIs actually implemented | PASS for APIs established in the supplied implementation |
| Dependencies identified | PASS for dependencies established during development; exact versions UNVERIFIED |
| Configuration identified | PASS |
| Inputs/outputs documented | PASS for verified interfaces; uncertain details marked UNVERIFIED |
| Runtime flow documented | PASS |
| Integration boundary clear | PASS |
| Database requirements documented | PASS |
| AI/ML components documented | PASS — explicitly marked unverified/not part of this module |
| Failure modes documented | PASS |
| Security documented | PASS |
| Tests/verification documented | PASS |
| Documentation/implementation mismatches identified | PASS where evidence exists |
| Integration-sensitive components identified | PASS |
| Unknowns marked rather than invented | PASS |

**Audit conclusion:** This document describes the verified doctor-side module without intentionally adding functionality that was not established by the available implementation evidence.
