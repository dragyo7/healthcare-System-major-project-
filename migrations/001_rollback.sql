-- Rollback: 001_rollback.sql
-- Description: Revert receptionist role from users table.

DELETE FROM users WHERE role = 'receptionist';
ALTER TABLE users MODIFY COLUMN role ENUM('doctor', 'patient') NOT NULL;
