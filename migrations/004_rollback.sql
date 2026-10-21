-- Rollback: 004_rollback.sql
-- Description: Drop account activations table.
--
-- DANGER & DESTRUCTIVE OPERATION WARNING:
-- Drops table 'account_activations'. Permanently deletes pending single-use
-- cryptographic activation tokens and expiration timestamps.
-- Never execute against primary or production databases.

DROP TABLE IF EXISTS `account_activations`;
