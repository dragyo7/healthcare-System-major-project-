-- Migration: 010_create_password_resets.sql
-- Description: Additive table for secure time-limited, single-use password reset tokens.
-- Safe, additive migration. Preserves all existing tables and records.

CREATE TABLE IF NOT EXISTS password_resets (
    reset_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_resets_token_hash (token_hash),
    INDEX idx_resets_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
