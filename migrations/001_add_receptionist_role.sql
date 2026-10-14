-- Migration: 001_add_receptionist_role.sql
-- Description: Add 'receptionist' to users table role ENUM and seed a default receptionist account.
-- Safe, additive migration. Preserves all existing records.

ALTER TABLE users MODIFY COLUMN role ENUM('doctor', 'patient', 'receptionist') NOT NULL;

-- Seed default receptionist account if not exists
-- Password hash for 'receptionist123' generated with bcrypt (10 rounds):
-- $2b$10$w816y9bZfN9h0PZqH85J1e0YgK8F9jQ3sM5nL2kZ1qXwVu7tPrO3m (or hash generated dynamically)
INSERT INTO users (full_name, email, password, role, phone)
SELECT 'Pooja Verma', 'receptionist@gmail.com', '$2b$10$w816y9bZfN9h0PZqH85J1e0YgK8F9jQ3sM5nL2kZ1qXwVu7tPrO3m', 'receptionist', '9876500001'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'receptionist@gmail.com');
