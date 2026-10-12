-- Migration: 003_create_prescription_ocr_jobs.sql
-- Description: Additive table for prescription image upload, OCR processing, and human clinical review workflow.
-- Safe, additive migration. Preserves all existing tables and data.

CREATE TABLE IF NOT EXISTS prescription_ocr_jobs (
    job_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes INT NOT NULL,
    raw_extracted_text TEXT NULL,
    candidate_fields JSON NULL,
    review_status VARCHAR(30) DEFAULT 'pending_review',
    confirmed_prescription_id INT NULL,
    confidence_score FLOAT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    FOREIGN KEY (confirmed_prescription_id) REFERENCES prescriptions(prescription_id) ON DELETE SET NULL,
    INDEX idx_ocr_patient (patient_id),
    INDEX idx_ocr_doctor (doctor_id),
    INDEX idx_ocr_status (review_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
