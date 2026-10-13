-- Hellfetty.com schema (MySQL/MariaDB, utf8mb4)
CREATE TABLE IF NOT EXISTS stores (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  address VARCHAR(255) NOT NULL DEFAULT '',
  lat DECIMAL(9,6) NOT NULL,
  lng DECIMAL(9,6) NOT NULL,
  status ENUM('active','closed','pending') NOT NULL DEFAULT 'active',
  yes_votes INT UNSIGNED NOT NULL DEFAULT 0,
  no_votes INT UNSIGNED NOT NULL DEFAULT 0,
  lp_reports INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS votes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  store_id INT UNSIGNED NOT NULL,
  period_key VARCHAR(16) NOT NULL,
  choice ENUM('yes','no') NOT NULL,
  fingerprint CHAR(64) NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_vote (store_id, period_key, fingerprint),
  INDEX idx_store_period (store_id, period_key),
  INDEX idx_created (created_at),
  CONSTRAINT fk_votes_store FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  k VARCHAR(64) NOT NULL PRIMARY KEY,
  v TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
