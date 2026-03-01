/*
 Navicat Premium Data Transfer

 Source Server         : localhost
 Source Server Type    : MySQL
 Source Server Version : 110805 (11.8.5-MariaDB)
 Source Host           : localhost:3306
 Source Schema         : donate_screen

 Target Server Type    : MySQL
 Target Server Version : 110805 (11.8.5-MariaDB)
 File Encoding         : 65001

 Date: 02/03/2026 03:06:24
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for donations
-- ----------------------------
DROP TABLE IF EXISTS `donations`;
CREATE TABLE `donations`  (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `venue_id` int NOT NULL DEFAULT 1,
  `package_id` int NOT NULL,
  `display_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` varchar(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `ig` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `fb` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `tiktok` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `image_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `amount` int NOT NULL,
  `duration_sec` int NOT NULL,
  `tier` tinyint NULL DEFAULT 1,
  `effect` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'none',
  `status` enum('PENDING','QUEUED','PLAYING','DONE','REJECTED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'PENDING',
  `created_at` timestamp NULL DEFAULT current_timestamp,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_venue_status`(`venue_id` ASC, `status` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of donations
-- ----------------------------

-- ----------------------------
-- Table structure for packages
-- ----------------------------
DROP TABLE IF EXISTS `packages`;
CREATE TABLE `packages`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `venue_id` int NOT NULL DEFAULT 1,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `price` int NOT NULL,
  `duration_sec` int NOT NULL,
  `tier` tinyint NOT NULL DEFAULT 1,
  `effect` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'none',
  `is_active` tinyint(1) NULL DEFAULT 1,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_venue`(`venue_id` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 5 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of packages
-- ----------------------------
INSERT INTO `packages` VALUES (1, 1, '🔥 Basic', 50, 10, 1, 'none', 1);
INSERT INTO `packages` VALUES (2, 1, '🔥🔥 Plus', 100, 20, 2, 'glow', 1);
INSERT INTO `packages` VALUES (3, 1, '👑 Premium', 300, 60, 3, 'spotlight', 1);
INSERT INTO `packages` VALUES (4, 1, '💎 VIP', 500, 90, 4, 'confetti', 1);

-- ----------------------------
-- Table structure for queue_items
-- ----------------------------
DROP TABLE IF EXISTS `queue_items`;
CREATE TABLE `queue_items`  (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `donation_id` bigint NOT NULL,
  `venue_id` int NOT NULL DEFAULT 1,
  `status` enum('WAITING','PLAYING','DONE') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT 'WAITING',
  `duration_sec` int NOT NULL,
  `priority` int NULL DEFAULT 1,
  `started_at` timestamp NULL DEFAULT NULL,
  `ended_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_venue_status`(`venue_id` ASC, `status` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of queue_items
-- ----------------------------

-- ----------------------------
-- Table structure for venues
-- ----------------------------
DROP TABLE IF EXISTS `venues`;
CREATE TABLE `venues`  (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'My Bar',
  `slug` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'mybar',
  `donate_url` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT '',
  `created_at` timestamp NULL DEFAULT current_timestamp,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `slug`(`slug` ASC) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of venues
-- ----------------------------
INSERT INTO `venues` VALUES (1, 'My Bar', 'mybar', 'http://localhost:5173/donate', '2026-03-02 02:33:48');

SET FOREIGN_KEY_CHECKS = 1;
