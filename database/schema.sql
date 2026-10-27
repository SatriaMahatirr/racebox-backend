CREATE DATABASE IF NOT EXISTS racebox CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE racebox;

-- Aman untuk database baru maupun database yang sudah ada: TIDAK ADA DROP TABLE.
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL, role ENUM('pengguna','admin') NOT NULL DEFAULT 'pengguna',
  status ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
  approved_at DATETIME NULL, approved_by CHAR(36) NULL,
  rejected_at DATETIME NULL, rejected_by CHAR(36) NULL, rejection_reason TEXT NULL,
  suspended_at DATETIME NULL, suspended_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehicles (
  id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, name VARCHAR(120) NOT NULL, type VARCHAR(50) NULL,
  weight_kg DECIMAL(8,2) NULL, bore_mm DECIMAL(8,2) NULL, stroke_mm DECIMAL(8,2) NULL,
  custom_cc DECIMAL(8,2) NULL, custom_specs JSON NULL, notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vehicle_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_vehicle_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vehicle_setups (
  id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, vehicle_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL, final_gear VARCHAR(100) NULL, notes TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_setup_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_setup_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  INDEX idx_setup_vehicle (vehicle_id), INDEX idx_setup_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS race_sessions (
  id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, vehicle_id CHAR(36) NULL, setup_id CHAR(36) NULL,
  test_type VARCHAR(30) NOT NULL, target_value DECIMAL(12,3) NOT NULL,
  start_time DATETIME NOT NULL, end_time DATETIME NULL, duration_ms DECIMAL(14,3) NULL, distance_m DECIMAL(14,3) NULL,
  max_speed_kmh DECIMAL(10,3) NULL, max_acceleration_ms2 DECIMAL(10,3) NULL, max_braking_ms2 DECIMAL(10,3) NULL,
  time_0_60_ms DECIMAL(14,3) NULL, time_0_100_ms DECIMAL(14,3) NULL, time_0_120_ms DECIMAL(14,3) NULL,
  time_201m_ms DECIMAL(14,3) NULL, time_402m_ms DECIMAL(14,3) NULL,
  data_quality VARCHAR(30) NOT NULL DEFAULT 'unknown', data_quality_score DECIMAL(6,3) NOT NULL DEFAULT 0,
  notes TEXT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_race_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_race_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
  CONSTRAINT fk_race_setup FOREIGN KEY (setup_id) REFERENCES vehicle_setups(id) ON DELETE SET NULL,
  INDEX idx_race_user_created (user_id, created_at), INDEX idx_race_vehicle (vehicle_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS telemetry_points (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, session_id CHAR(36) NOT NULL, timestamp_ms BIGINT NOT NULL,
  latitude DECIMAL(10,7) NULL, longitude DECIMAL(10,7) NULL, altitude DECIMAL(10,3) NULL,
  speed_kmh DECIMAL(10,3) NULL, acceleration_ms2 DECIMAL(10,3) NULL, g_force DECIMAL(10,4) NULL,
  gyro_x DECIMAL(10,4) NULL, gyro_y DECIMAL(10,4) NULL, gyro_z DECIMAL(10,4) NULL,
  heading DECIMAL(10,3) NULL, gps_accuracy DECIMAL(10,3) NULL,
  CONSTRAINT fk_telemetry_session FOREIGN KEY (session_id) REFERENCES race_sessions(id) ON DELETE CASCADE,
  INDEX idx_telemetry_session_time (session_id, timestamp_ms)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS registration_approval_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  action ENUM('approved','rejected','suspended','reactivated','deleted') NOT NULL,
  admin_id CHAR(36) NOT NULL,
  reason TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_approval_user (user_id),
  INDEX idx_approval_admin (admin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
