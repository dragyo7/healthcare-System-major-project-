-- Migration 000 Rollback: Drop 10 Core Tables
--
-- DANGER & DESTRUCTIVE OPERATION WARNING:
-- Drops entire core relational EHR schema: prescription_medicines, prescriptions,
-- medical_reports, medical_history, symptoms, appointments, doctor_schedule,
-- doctors, patients, and users.
--
-- STRICT INVARIANTS:
-- 1. Suitable ONLY for explicitly verified disposable test environments (e.g. '*_test', '*_disposable').
-- 2. MUST NEVER be executed automatically by forward migration runners.
-- 3. Execution against primary application database 'rag_healthcare' or production is strictly forbidden.

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `prescription_medicines`;
DROP TABLE IF EXISTS `prescriptions`;
DROP TABLE IF EXISTS `medical_reports`;
DROP TABLE IF EXISTS `medical_history`;
DROP TABLE IF EXISTS `symptoms`;
DROP TABLE IF EXISTS `appointments`;
DROP TABLE IF EXISTS `doctor_schedule`;
DROP TABLE IF EXISTS `doctors`;
DROP TABLE IF EXISTS `patients`;
DROP TABLE IF EXISTS `users`;

SET FOREIGN_KEY_CHECKS = 1;
