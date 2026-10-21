-- Migration: 001_add_receptionist_role.sql
-- Description: Add 'receptionist' to users table role ENUM.
-- Safe, additive schema migration. Preserves all existing records.
--
-- SECURITY NOTE: Hard-coded default receptionist credentials (e.g. 'receptionist123')
-- have been strictly removed per secure account lifecycle standards.
-- In production, front-desk staff accounts are provisioned securely via least-privilege
-- administration and single-use cryptographic activation links (Migration 004).
-- In test/disposable environments, synthetic test fixtures are populated via scripts/seed_disposable_test_db.js.

ALTER TABLE users MODIFY COLUMN role ENUM('doctor', 'patient', 'receptionist') NOT NULL;
