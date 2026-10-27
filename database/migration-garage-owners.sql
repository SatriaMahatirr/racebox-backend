-- ============================================================
-- Migration: Fix Garasi System - Pemilik Motor & Audit Trail
-- ============================================================
-- Script ini AMAN dijalankan berulang kali (idempoten).
-- Tidak ada DROP TABLE, tidak menghapus data existing.
--
-- Perubahan:
--   1. Buat tabel garage_activity_logs (audit trail)
--   2. Tambah index untuk performa query garasi
--   3. Tidak membuat SQL VIEW (query langsung dipakai di route)
--
-- Catatan: Setelah migration ini, jalankan: npm start
-- ============================================================

USE racebox;

-- 1. Buat tabel untuk log aktivitas garasi (audit trail)
CREATE TABLE IF NOT EXISTS garage_activity_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  vehicle_id CHAR(36) NULL,
  action ENUM(
    'vehicle_added',
    'vehicle_updated',
    'vehicle_deleted',
    'setup_added',
    'setup_updated',
    'setup_deleted'
  ) NOT NULL,
  details JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_garage_log_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_garage_log_user_action (user_id, action, created_at),
  INDEX idx_garage_log_vehicle (vehicle_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tambah index untuk performa (abaikan jika sudah ada via IGNORE)
-- MySQL tidak mendukung CREATE INDEX IF NOT EXISTS sampai versi tertentu,
-- jadi kita pakai pendekatan aman: cek INFORMATION_SCHEMA dulu.
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'racebox'
    AND TABLE_NAME = 'vehicles'
    AND INDEX_NAME = 'idx_vehicles_user_created'
);
SET @sql := IF(@idx_exists = 0,
  'CREATE INDEX idx_vehicles_user_created ON vehicles(user_id, created_at DESC)',
  'SELECT "idx_vehicles_user_created already exists" AS msg');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Verifikasi tidak ada vehicle "yatim" (user_id tidak match user manapun)
SELECT
  v.id AS vehicle_id,
  v.name AS vehicle_name,
  v.user_id AS orphan_user_id,
  v.created_at
FROM vehicles v
LEFT JOIN users u ON u.id = v.user_id
WHERE u.id IS NULL;

-- 4. Statistik awal (debug only)
SELECT
  (SELECT COUNT(*) FROM vehicles) AS total_vehicles,
  (SELECT COUNT(*) FROM users WHERE role='pengguna') AS total_users,
  (SELECT COUNT(DISTINCT user_id) FROM vehicles) AS total_owners_with_vehicles,
  (SELECT COUNT(*) FROM vehicles v LEFT JOIN users u ON u.id=v.user_id WHERE u.id IS NULL) AS orphaned_vehicles;

-- ============================================================
-- Selesai. Tidak ada SQL VIEW yang dibuat.
-- Route /admin/garage-owners memakai query langsung (LEFT JOIN)
-- sehingga tidak ada dependency tambahan.
-- ============================================================
