const db = require('./db');

/**
 * Log aktivitas garasi untuk audit trail
 * @param {string} userId - ID user yang melakukan aksi
 * @param {string|null} vehicleId - ID motor (optional)
 * @param {string} action - Jenis aksi: vehicle_added, vehicle_updated, vehicle_deleted, setup_added, setup_updated, setup_deleted
 * @param {object|null} details - Detail tambahan dalam bentuk JSON
 */
exports.logActivity = async (userId, vehicleId, action, details = null) => {
  try {
    await db.query(
      'INSERT INTO garage_activity_logs (user_id, vehicle_id, action, details) VALUES (?, ?, ?, ?)',
      [userId, vehicleId, action, details ? JSON.stringify(details) : null]
    );
  } catch (error) {
    console.error('Error logging garage activity:', error);
    // Jangan throw error agar tidak mengganggu operasi utama
  }
};

/**
 * Ambil riwayat aktivitas garasi
 * @param {string|null} userId - Filter by user ID (optional)
 * @param {number} limit - Limit jumlah record
 */
exports.getActivityLogs = async (userId = null, limit = 100) => {
  let query = `
    SELECT 
      l.id, l.user_id, l.vehicle_id, l.action, l.details, l.created_at,
      u.name as user_name, u.email as user_email,
      v.name as vehicle_name
    FROM garage_activity_logs l
    JOIN users u ON u.id = l.user_id
    LEFT JOIN vehicles v ON v.id = l.vehicle_id
  `;
  
  const params = [];
  
  if (userId) {
    query += ' WHERE l.user_id = ?';
    params.push(userId);
  }
  
  query += ' ORDER BY l.created_at DESC LIMIT ?';
  params.push(limit);
  
  const [rows] = await db.query(query, params);
  return rows;
};

/**
 * Ambil statistik aktivitas garasi
 */
exports.getActivityStats = async () => {
  const [[stats]] = await db.query(`
    SELECT
      COUNT(*) AS total_activities,
      SUM(CASE WHEN action LIKE 'vehicle_%' THEN 1 ELSE 0 END) AS vehicle_activities,
      SUM(CASE WHEN action LIKE 'setup_%' THEN 1 ELSE 0 END) AS setup_activities,
      SUM(CASE WHEN action IN ('vehicle_added', 'setup_added') THEN 1 ELSE 0 END) AS additions,
      SUM(CASE WHEN action IN ('vehicle_updated', 'setup_updated') THEN 1 ELSE 0 END) AS updates,
      SUM(CASE WHEN action IN ('vehicle_deleted', 'setup_deleted') THEN 1 ELSE 0 END) AS deletions,
      MAX(created_at) AS last_activity_date
    FROM garage_activity_logs
  `);
  
  return {
    total: Number(stats.total_activities || 0),
    vehicles: Number(stats.vehicle_activities || 0),
    setups: Number(stats.setup_activities || 0),
    additions: Number(stats.additions || 0),
    updates: Number(stats.updates || 0),
    deletions: Number(stats.deletions || 0),
    lastActivity: stats.last_activity_date
  };
};

module.exports = exports;
