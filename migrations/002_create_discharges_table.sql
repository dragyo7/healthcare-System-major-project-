-- Migration: 002_create_discharges_table.sql
-- Description: Create dedicated discharges table for patient post-discharge care & follow-up.
-- Safe, additive migration. Preserves all existing tables and data.

CREATE TABLE IF NOT EXISTS discharges (
    discharge_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    admission_date DATE NULL,
    discharge_date DATE NOT NULL,
    diagnosis VARCHAR(255) NULL,
    discharge_summary TEXT NULL,
    discharge_instructions TEXT NOT NULL,
    follow_up_instructions TEXT NULL,
    follow_up_date DATE NULL,
    warning_signs TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'discharged',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    INDEX idx_discharge_patient (patient_id),
    INDEX idx_discharge_doctor (doctor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed initial clinical discharge record for Patient 1 (Aarav Patil) under Doctor 1 (Dr. Rahul Sharma)
INSERT INTO discharges (
    patient_id, doctor_id, admission_date, discharge_date, diagnosis,
    discharge_summary, discharge_instructions, follow_up_instructions, follow_up_date, warning_signs, status
)
SELECT
    1, 1, '2026-09-20', '2026-09-25', 'Essential Hypertension & Mild Angina',
    'Patient admitted for blood pressure stabilization. Responded well to Amlodipine 5mg regimen.',
    'Take Amlodipine 5mg daily every morning with water. Maintain low-sodium diet (less than 2g salt daily). Monitor blood pressure twice daily.',
    'Follow up in Cardiology OPD in 4 weeks with home blood pressure logs.',
    '2026-10-25',
    'Seek immediate emergency care if experiencing severe chest pressure or pain radiating to left arm, shortness of breath at rest, severe dizziness, or sudden fainting.',
    'discharged'
FROM DUAL
WHERE EXISTS (SELECT 1 FROM patients WHERE patient_id = 1)
  AND EXISTS (SELECT 1 FROM doctors WHERE doctor_id = 1)
  AND NOT EXISTS (SELECT 1 FROM discharges WHERE patient_id = 1);
