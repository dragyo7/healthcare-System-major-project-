-- Migration 006: Add consent audit columns to users table
-- Supports auditable, version-tracked consent records per DPDP Act, 2023 Section 6(1).
-- Avoids IP address logging to minimize data collection per privacy-by-design principles.
-- Safe, additive migration. Preserves all existing records.

ALTER TABLE `users`
  ADD COLUMN `consent_timestamp` TIMESTAMP NULL DEFAULT NULL AFTER `created_at`,
  ADD COLUMN `consent_version` VARCHAR(20) NULL DEFAULT NULL AFTER `consent_timestamp`;
