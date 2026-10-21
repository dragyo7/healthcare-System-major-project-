-- Rollback: 005_rollback.sql
-- Description: Drop prescription idempotency keys table.
--
-- DANGER & DESTRUCTIVE OPERATION WARNING:
-- Drops table 'prescription_idempotency_keys'. Removes deduplication hashes
-- and cached idempotency response payloads.
-- Never execute against primary or production databases.

DROP TABLE IF EXISTS prescription_idempotency_keys;
