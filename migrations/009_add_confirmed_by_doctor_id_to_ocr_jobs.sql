-- Migration 009: Add confirmed_by_doctor_id to prescription_ocr_jobs
-- Target: prescription_ocr_jobs table
-- Records the ID of the clinician who reviewed and confirmed the OCR candidate into a prescription

SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'prescription_ocr_jobs' AND column_name = 'confirmed_by_doctor_id');
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE prescription_ocr_jobs ADD COLUMN confirmed_by_doctor_id INT NULL AFTER confirmed_prescription_id, ADD CONSTRAINT fk_ocr_confirmed_doctor FOREIGN KEY (confirmed_by_doctor_id) REFERENCES doctors(doctor_id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
