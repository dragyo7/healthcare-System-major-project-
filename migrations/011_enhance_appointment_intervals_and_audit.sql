-- Migration 011: Enhance Appointment Performance Indexing & Audit Timestamps
-- Target: appointments table
-- Adds:
-- 1. created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
-- 2. updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)
-- 3. Composite indexing on (doctor_id, appointment_date, start_time, end_time)
-- 4. Composite indexing on (patient_id, appointment_date, start_time, end_time)

ALTER TABLE appointments
    ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ADD INDEX idx_doc_appt_interval (doctor_id, appointment_date, start_time, end_time),
    ADD INDEX idx_pat_appt_interval (patient_id, appointment_date, start_time, end_time);
