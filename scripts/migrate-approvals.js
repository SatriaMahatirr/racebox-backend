const db = require('../models/db');

async function migrate() {
  console.log('Running migration for user approval system...');
  
  // Check if status column exists
  const [cols] = await db.query("SHOW COLUMNS FROM users LIKE 'status'");
  if (cols.length === 0) {
    await db.query(`
      ALTER TABLE users
      ADD COLUMN status ENUM('pending', 'approved', 'rejected', 'suspended') NOT NULL DEFAULT 'pending' AFTER role,
      ADD COLUMN approved_at DATETIME NULL AFTER status,
      ADD COLUMN approved_by CHAR(36) NULL AFTER approved_at,
      ADD COLUMN rejected_at DATETIME NULL AFTER approved_by,
      ADD COLUMN rejected_by CHAR(36) NULL AFTER rejected_at,
      ADD COLUMN rejection_reason TEXT NULL AFTER rejected_by,
      ADD COLUMN suspended_at DATETIME NULL AFTER rejection_reason,
      ADD COLUMN suspended_by CHAR(36) NULL AFTER suspended_at
    `);
    console.log('Added status & approval columns to users table.');
  } else {
    console.log('Status columns already exist in users table.');
  }

  // Create approval logs table
  await db.query(`
    CREATE TABLE IF NOT EXISTS registration_approval_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id CHAR(36) NOT NULL,
      action ENUM('approved', 'rejected', 'suspended', 'reactivated') NOT NULL,
      admin_id CHAR(36) NOT NULL,
      reason TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_id),
      INDEX idx_admin (admin_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('Created registration_approval_logs table.');

  // Migrate existing users to 'approved'
  const [updateResult] = await db.query(`
    UPDATE users 
    SET status = 'approved', approved_at = NOW() 
    WHERE status = 'pending'
  `);
  console.log('Migrated existing users to approved:', updateResult.affectedRows);

  const [users] = await db.query('SELECT id, name, email, role, status FROM users');
  console.log('Current users:', users);
}

migrate()
  .then(() => {
    console.log('Migration finished successfully.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
