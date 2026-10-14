# DATA MODEL SPECIFICATION — APPLICATION DATABASE

**Database Engine**: MySQL 8.0 (InnoDB)  
**Database Name**: `rag_healthcare`  
**Character Set / Collation**: `utf8mb4` / `utf8mb4_0900_ai_ci`  
**Primary Source of Truth**: `Portal Major P/Bhumi/Dump20261003 (1).sql` (342 lines DDL & Seed)  

---

## 1. Schema Topology & Entity-Relationship Model

The current operational database contains exactly **10 tables**, modeling clinical actors, operational schedules, patient health records, and prescription transactions.

```text
       ┌────────────────────────┐
       │         users          │
       │ PK: user_id            │
       │     full_name          │
       │     email (UNIQUE)     │
       │     password (hash)    │
       │     role (ENUM)        │
       │     phone, created_at  │
       └───────┬────────┬───────┘
               │ 1      │ 1
               │        │
               │ 1      │ 1
       ┌───────▼────────┐  ┌────────▼───────┐
       │    doctors     │  │    patients    │
       │ PK: doctor_id  │  │ PK: patient_id │
       │ FK: user_id    │  │ FK: user_id    │
       │     specializ. │  │     DOB, gender│
       │     qualific.  │  │     blood_group│
       │     license_no │  │     address    │
       │     experience │  │     allergies  │
       └─┬───┬────────┬─┘  └──┬───┬───┬───┬─┘
         │   │        │       │   │   │   │
         │   │      1 │     1 │   │   │   │
         │   │   ┌────▼───────▼┐  │   │   │
         │   │   │ appointments│  │   │   │
         │   │   │PK: appt_id  │  │   │   │
         │   │   │FK: doctor_id│  │   │   │
         │   │   │FK:patient_id│  │   │   │
         │   │   │    date/time│  │   │   │
         │   │   │    status   │  │   │   │
         │   │   └─────────────┘  │   │   │
       1 │   │ 1                  │ 1 │ 1 │ 1
    ┌────▼─┐ │   ┌─────────────┐  │   │   │
    │doc_  │ └───►prescriptions◄──┘   │   │
    │sched │     │PK: prescr_id│      │   │
    │PK:id │     │FK: doctor_id│      │   │
    │FK:doc│     │FK:patient_id│      │   │
    └──────┘     │    diagnosis│      │   │
                 └──────┬──────┘      │   │
                      1 │             │   │
                        │             │   │
                 ┌──────▼──────┐      │   │
                 │prescription_│      │   │
                 │  medicines  │      │   │
                 │PK: med_id   │      │   │
                 │FK: prescr_id│      │   │
                 │    drug/dose│      │   │
                 └─────────────┘      │   │
                                      │   │
          ┌───────────────────────────┘   │
          │ 1                             │ 1
  ┌───────▼────────┐             ┌────────▼───────┐
  │medical_history │             │    symptoms    │
  │PK: history_id  │             │PK: symptom_id  │
  │FK: patient_id  │             │FK: patient_id  │
  │    condition   │             │    symptoms    │
  │    diagnosis   │             │    severity    │
  └────────────────┘             └────────────────┘
                                          │ 1
                                          ▼
                                 ┌────────────────┐
                                 │medical_reports │
                                 │PK: report_id   │
                                 │FK: patient_id  │
                                 │    file_path   │
                                 └────────────────┘
```

---

## 2. Table-by-Table Schema Breakdown

### 2.1 `users`
Core identity table storing credentials and system role.
```sql
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('doctor','patient') NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
- **Role Model**: Strictly `enum('doctor','patient')`.
- **Note**: Receptionist is **NOT** represented in the active schema. Do not alter until receptionist integration is audited.

### 2.2 `doctors`
Professional metadata for physician accounts.
```sql
CREATE TABLE `doctors` (
  `doctor_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `specialization` varchar(100) DEFAULT NULL,
  `qualification` varchar(150) DEFAULT NULL,
  `license_number` varchar(100) DEFAULT NULL,
  `experience_years` int DEFAULT NULL,
  `bio` text,
  PRIMARY KEY (`doctor_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `doctors_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.3 `patients`
Clinical profile and demographic baseline for patients.
```sql
CREATE TABLE `patients` (
  `patient_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `date_of_birth` date DEFAULT NULL,
  `gender` varchar(20) DEFAULT NULL,
  `blood_group` varchar(10) DEFAULT NULL,
  `address` text,
  `emergency_contact` varchar(20) DEFAULT NULL,
  `allergies` text,
  PRIMARY KEY (`patient_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `patients_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
- **CDS-Critical Attribute**: `allergies` (text column containing critical drug hypersensitivity alerts like `"Penicillin"`).

### 2.4 `appointments`
Consultation appointments linking doctors and patients.
```sql
CREATE TABLE `appointments` (
  `appointment_id` int NOT NULL AUTO_INCREMENT,
  `doctor_id` int NOT NULL,
  `patient_id` int NOT NULL,
  `appointment_date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time DEFAULT NULL,
  `reason` text,
  `status` enum('scheduled','completed','cancelled') DEFAULT 'scheduled',
  PRIMARY KEY (`appointment_id`),
  KEY `doctor_id` (`doctor_id`),
  KEY `patient_id` (`patient_id`),
  CONSTRAINT `appointments_ibfk_1` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`doctor_id`) ON DELETE CASCADE,
  CONSTRAINT `appointments_ibfk_2` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`patient_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.5 `doctor_schedule`
Physician weekly availability calendar.
```sql
CREATE TABLE `doctor_schedule` (
  `schedule_id` int NOT NULL AUTO_INCREMENT,
  `doctor_id` int NOT NULL,
  `day_of_week` varchar(20) NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `activity_type` varchar(100) DEFAULT NULL,
  `location` varchar(150) DEFAULT NULL,
  `notes` text,
  `available` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`schedule_id`),
  KEY `doctor_id` (`doctor_id`),
  CONSTRAINT `doctor_schedule_ibfk_1` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`doctor_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.6 `medical_history`
Past chronic illnesses, surgeries, or established medical conditions.
```sql
CREATE TABLE `medical_history` (
  `history_id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `condition_name` varchar(150) DEFAULT NULL,
  `diagnosis` text,
  `diagnosed_date` date DEFAULT NULL,
  `notes` text,
  PRIMARY KEY (`history_id`),
  KEY `patient_id` (`patient_id`),
  CONSTRAINT `medical_history_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`patient_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.7 `symptoms`
Active symptoms reported by the patient or noted by the physician.
```sql
CREATE TABLE `symptoms` (
  `symptom_id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `symptoms` text NOT NULL,
  `severity` varchar(30) DEFAULT NULL,
  `description` text,
  `reported_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`symptom_id`),
  KEY `patient_id` (`patient_id`),
  CONSTRAINT `symptoms_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`patient_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.8 `medical_reports`
Uploaded diagnostic laboratory documents.
```sql
CREATE TABLE `medical_reports` (
  `report_id` int NOT NULL AUTO_INCREMENT,
  `patient_id` int NOT NULL,
  `report_type` varchar(100) DEFAULT NULL,
  `report_name` varchar(200) DEFAULT NULL,
  `report_date` date DEFAULT NULL,
  `report_summary` text,
  `file_path` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`report_id`),
  KEY `patient_id` (`patient_id`),
  CONSTRAINT `medical_reports_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`patient_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.9 `prescriptions`
Parent prescription header record.
```sql
CREATE TABLE `prescriptions` (
  `prescription_id` int NOT NULL AUTO_INCREMENT,
  `doctor_id` int NOT NULL,
  `patient_id` int NOT NULL,
  `diagnosis` text,
  `prescription_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` text,
  PRIMARY KEY (`prescription_id`),
  KEY `doctor_id` (`doctor_id`),
  KEY `patient_id` (`patient_id`),
  CONSTRAINT `prescriptions_ibfk_1` FOREIGN KEY (`doctor_id`) REFERENCES `doctors` (`doctor_id`) ON DELETE CASCADE,
  CONSTRAINT `prescriptions_ibfk_2` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`patient_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 2.10 `prescription_medicines`
Child items specifying individual medications, doses, and schedules.
```sql
CREATE TABLE `prescription_medicines` (
  `medicine_id` int NOT NULL AUTO_INCREMENT,
  `prescription_id` int NOT NULL,
  `medicine_name` varchar(150) NOT NULL,
  `dosage` varchar(100) DEFAULT NULL,
  `frequency` varchar(100) DEFAULT NULL,
  `duration` varchar(100) DEFAULT NULL,
  `instructions` text,
  PRIMARY KEY (`medicine_id`),
  KEY `prescription_id` (`prescription_id`),
  CONSTRAINT `prescription_medicines_ibfk_1` FOREIGN KEY (`prescription_id`) REFERENCES `prescriptions` (`prescription_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 3. Structural Observations & Identified Deficiencies

1. **Implicit Doctor-Patient Relationship (Inferred vs. Explicit)**:
   - There is **no explicit `doctor_patient` association table**.
   - Access is inferred dynamically via `appointments`. If a doctor has an appointment with patient $P$, the doctor is granted full access to $P$'s history.
2. **Missing Table Defect (`patient_followups`)**:
   - `doctorController.js` lines 1139 and 1180 query `patient_followups`.
   - Table `patient_followups` is **completely absent from `Dump20261003 (1).sql`**.
   - Frontend makes zero calls to this table. Classified as dead teammate code; **do not expand schema**.
3. **Seed Data Integrity Vulnerability**:
   - User ID 2 (`aarav@gmail.com`) has password `'patient123'` stored in **plain text**.
   - User IDs 1 and 3 use standard bcrypt hashes.
4. **Demo Data Volume**:
   - Exactly 3 users (1 doctor, 2 patients).
   - Exactly 6 appointments (patient 1 has 5 appointments; patient 2 has 1).
   - Confirms that case similarity search over this dataset is physically impossible.
