-- Migration 009 Rollback: Remove confirmed_by_doctor_id column
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = DATABASE() AND table_name = 'prescription_ocr_jobs' AND constraint_name = 'fk_ocr_confirmed_doctor');
SET @sql_fk = IF(@fk_exists > 0, 'ALTER TABLE prescription_ocr_jobs DROP FOREIGN KEY fk_ocr_confirmed_doctor', 'SELECT 1');
PREPARE stmt_fk FROM @sql_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'prescription_ocr_jobs' AND column_name = 'confirmed_by_doctor_id');
SET @sql_col = IF(@col_exists > 0, 'ALTER TABLE prescription_ocr_jobs DROP COLUMN confirmed_by_doctor_id', 'SELECT 1');
PREPARE stmt_col FROM @sql_col;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;
