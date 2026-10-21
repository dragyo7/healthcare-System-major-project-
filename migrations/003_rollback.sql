-- Rollback: 003_rollback.sql
-- Description: Drop prescription OCR jobs table.
--
-- DANGER & DESTRUCTIVE OPERATION WARNING:
-- Drops table 'prescription_ocr_jobs'. Permanently deletes OCR upload records,
-- raw extracted texts, candidate field JSONs, and clinician review audit logs.
-- Never execute against primary or production databases.

DROP TABLE IF EXISTS `prescription_ocr_jobs`;
