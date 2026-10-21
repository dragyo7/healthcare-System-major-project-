-- Rollback: 001_rollback.sql
-- Description: Revert receptionist role from users table role ENUM.
--
-- DANGER & DESTRUCTIVE OPERATION WARNING:
-- Reverts ENUM column to 'doctor', 'patient'.
--
-- SAFETY INVARIANT: Broad unconditional deletion of receptionist accounts
-- has been strictly eliminated to prevent catastrophic loss of legitimate staff accounts.
--
-- PREREQUISITE: This rollback is safe only when zero users possess the 'receptionist' role.
-- In MySQL strict mode (STRICT_TRANS_TABLES), this statement will fail if receptionist records exist,
-- protecting active accounts from silent data truncation.

ALTER TABLE users MODIFY COLUMN role ENUM('doctor', 'patient') NOT NULL;
