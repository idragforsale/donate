-- =====================================================
-- Donate Screen Database Schema
-- รัน: mysql -u root -p < schema.sql
-- =====================================================

CREATE DATABASE IF NOT EXISTS venue_donation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE venue_donation;

-- ===== venues =====
CREATE TABLE IF NOT EXISTS venues (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL DEFAULT 'My Bar',
  slug        VARCHAR(100) UNIQUE NOT NULL DEFAULT 'mybar',
  donate_url  VARCHAR(500) DEFAULT '',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== packages =====
CREATE TABLE IF NOT EXISTS packages (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  venue_id     INT NOT NULL DEFAULT 1,
  name         VARCHAR(100) NOT NULL,
  price        INT NOT NULL,
  duration_sec INT NOT NULL,
  tier         TINYINT NOT NULL DEFAULT 1,
  effect       VARCHAR(50) DEFAULT 'none',
  is_active    BOOLEAN DEFAULT TRUE,
  INDEX idx_venue (venue_id)
);

-- ===== donations =====
CREATE TABLE IF NOT EXISTS donations (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  venue_id     INT NOT NULL DEFAULT 1,
  package_id   INT NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  message      VARCHAR(60) DEFAULT '',
  ig           VARCHAR(100) DEFAULT '',
  fb           VARCHAR(100) DEFAULT '',
  tiktok       VARCHAR(100) DEFAULT '',
  image_url    VARCHAR(500) DEFAULT '',
  amount       INT NOT NULL,
  duration_sec INT NOT NULL,
  tier         TINYINT DEFAULT 1,
  effect       VARCHAR(50) DEFAULT 'none',
  status       ENUM('PENDING','QUEUED','PLAYING','DONE','REJECTED') DEFAULT 'PENDING',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_venue_status (venue_id, status)
);

-- ===== queue_items =====
CREATE TABLE IF NOT EXISTS queue_items (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  donation_id  BIGINT NOT NULL,
  venue_id     INT NOT NULL DEFAULT 1,
  status       ENUM('WAITING','PLAYING','DONE') DEFAULT 'WAITING',
  duration_sec INT NOT NULL,
  priority     INT DEFAULT 1,
  started_at   TIMESTAMP NULL,
  ended_at     TIMESTAMP NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_venue_status (venue_id, status)
);

-- ===== Seed: default venue =====
INSERT IGNORE INTO venues (id, name, slug, donate_url)
VALUES (1, 'My Bar', 'mybar', 'http://localhost:5173/donate');

-- ===== Seed: packages (4 tiers) =====
INSERT IGNORE INTO packages (id, venue_id, name, price, duration_sec, tier, effect) VALUES
(1, 1, '🔥 Basic',    50,  10,  1, 'none'),
(2, 1, '🔥🔥 Plus',   100, 20,  2, 'glow'),
(3, 1, '👑 Premium',  300, 60,  3, 'spotlight'),
(4, 1, '💎 VIP',      500, 90,  4, 'confetti');
