-- Rollback: 006_rollback.sql
-- Description: Drop consent audit columns from users table.
--
-- DANGER & DESTRUCTIVE OPERATION WARNING:
-- Drops columns 'consent_timestamp' and 'consent_version' from 'users' table.
-- Irreversibly destroys patient affirmative consent audit history required
-- under DPDP Act 2023 Section 6(1).
-- Never execute against primary or production databases.

ALTER TABLE `users`
  DROP COLUMN `consent_version`,
  DROP COLUMN `consent_timestamp`;
