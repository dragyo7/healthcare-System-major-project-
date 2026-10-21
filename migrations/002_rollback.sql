-- Rollback: 002_rollback.sql
-- Description: Drop discharges table.
--
-- DANGER & DESTRUCTIVE OPERATION WARNING:
-- Drops table 'discharges'. Permanently deletes all post-discharge clinical summaries,
-- discharge directives, follow-up instructions, and warning sign documentation.
-- Never execute against primary or production databases.

DROP TABLE IF EXISTS discharges;
