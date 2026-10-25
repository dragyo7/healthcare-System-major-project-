-- Rollback for Migration 011
ALTER TABLE appointments
    DROP INDEX idx_doc_appt_interval,
    DROP INDEX idx_pat_appt_interval,
    DROP COLUMN updated_at,
    DROP COLUMN created_at;
