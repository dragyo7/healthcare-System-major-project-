-- Rollback 007: Revert Single Receptionist Invariant & Appointment Statuses
-- WARNING: DESTRUCTIVE OPERATION - Removes singleton constraint and resets extended appointment statuses

-- 1. Revert appointment status back to baseline enum
ALTER TABLE appointments
  MODIFY COLUMN status ENUM('scheduled','completed','cancelled') DEFAULT 'scheduled';

-- 2. Drop unique index and generated column on users
ALTER TABLE users
  DROP INDEX uq_single_receptionist,
  DROP COLUMN single_receptionist;
