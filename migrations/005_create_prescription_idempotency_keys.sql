-- Migration 005: Create prescription_idempotency_keys table
-- Supports robust, cryptographic idempotency tracking with payload hashing and actor-scoped uniqueness.

CREATE TABLE IF NOT EXISTS prescription_idempotency_keys (
    idempotency_key VARCHAR(128) NOT NULL,
    doctor_id INT NOT NULL,
    patient_id INT NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    prescription_id INT NOT NULL,
    response_body JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (doctor_id, idempotency_key),
    KEY idx_patient (patient_id),
    KEY idx_created (created_at),
    CONSTRAINT fk_idemp_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    CONSTRAINT fk_idemp_patient FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    CONSTRAINT fk_idemp_rx FOREIGN KEY (prescription_id) REFERENCES prescriptions(prescription_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
