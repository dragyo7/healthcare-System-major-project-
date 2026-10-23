-- Migration 007: Enforce Single Receptionist Invariant & Expand Appointment Statuses
-- Target: users, appointments tables
-- Invariant 1: Exactly ONE receptionist user permitted across the database
-- Invariant 2: Support complete appointment lifecycle: pending, scheduled, confirmed, completed, cancelled, rejected, reschedule_requested

-- 1. Enforce single-receptionist invariant via generated virtual column with unique constraint
-- In MySQL, NULL values are permitted in unique indices, allowing unlimited patients and doctors.
-- For role = 'receptionist', the generated value is 'RECEPTIONIST_SINGLETON', guaranteeing that
-- at most one receptionist user can exist across the entire database.
ALTER TABLE users
  ADD COLUMN single_receptionist VARCHAR(25)
  GENERATED ALWAYS AS (IF(role = 'receptionist', 'RECEPTIONIST_SINGLETON', NULL)) STORED,
  ADD UNIQUE KEY uq_single_receptionist (single_receptionist);

-- 2. Expand appointments status enum to support complete patient request & receptionist approval lifecycle
ALTER TABLE appointments
  MODIFY COLUMN status ENUM('pending','scheduled','confirmed','completed','cancelled','rejected','reschedule_requested') DEFAULT 'pending';
