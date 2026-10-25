-- Migration 008: Add Staff Status and Approval Lifecycle
-- Target: users table
-- Adds staff_status column to users table:
-- Allowed values: 'approved', 'pending_approval', 'suspended', 'revoked'
-- Canonical Security Policy (DEC-040):
-- Newly registered staff accounts MUST default to 'pending_approval'.
-- Historical accounts are NOT blanket-approved; only verified baseline clinical accounts
-- from authoritative seed configurations are explicitly backfilled to 'approved'.
-- Primary production database is protected and not altered automatically.

SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'staff_status');
SET @sql = IF(@col_exists > 0,
  "ALTER TABLE users MODIFY COLUMN staff_status ENUM('approved', 'pending_approval', 'suspended', 'revoked') NOT NULL DEFAULT 'pending_approval'",
  "ALTER TABLE users ADD COLUMN staff_status ENUM('approved', 'pending_approval', 'suspended', 'revoked') NOT NULL DEFAULT 'pending_approval'");
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill ONLY verified baseline administrator and core seed accounts:
UPDATE users 
SET staff_status = 'approved' 
WHERE role IN ('doctor', 'receptionist') 
  AND email IN ('dr.bhumi@hospital.com', 'ketki.reception@hospital.com', 'admin@hospital.com', 'doctor@gmail.com', 'receptionist@gmail.com');

-- Patient accounts do not participate in staff approval gate:
UPDATE users
SET staff_status = 'approved'
WHERE role = 'patient';
