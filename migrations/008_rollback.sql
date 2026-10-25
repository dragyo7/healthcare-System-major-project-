-- Migration 008 Rollback: Remove Staff Status column
ALTER TABLE users
  DROP COLUMN staff_status;
