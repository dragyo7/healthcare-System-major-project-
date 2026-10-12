-- Migration: 004_create_account_activations.sql
-- Description: Additive table for secure patient account activation and password setup lifecycle.
-- Safe, additive migration. Preserves all existing tables and records.

CREATE TABLE IF NOT EXISTS account_activations (
    activation_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_activations_token_hash (token_hash),
    INDEX idx_activations_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
