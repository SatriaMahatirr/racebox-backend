const db = require('./db');

exports.findByEmail = async email => {
  const [r] = await db.query('SELECT * FROM users WHERE email=? LIMIT 1', [email]);
  return r[0] || null;
};

exports.findById = async id => {
  const [r] = await db.query('SELECT * FROM users WHERE id=? LIMIT 1', [id]);
  return r[0] || null;
};

exports.create = async u => {
  // Always enforce 'pending' status for new registrations unless explicitly set otherwise
  const status = u.status || 'pending';
  const role = u.role || 'pengguna';
  await db.query(
    'INSERT INTO users (id, name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)',
    [u.id, u.name, u.email, u.passwordHash, role, status]
  );
  return exports.findById(u.id);
};

exports.list = async () => {
  const [r] = await db.query(
    'SELECT id, name, email, role, status, approved_at, rejected_at, suspended_at, created_at, updated_at FROM users ORDER BY created_at DESC'
  );
  return r;
};

exports.getApprovalStats = async () => {
  const [[counts]] = await db.query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
      SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended
    FROM users
  `);
  return {
    total: Number(counts.total || 0),
    pending: Number(counts.pending || 0),
    approved: Number(counts.approved || 0),
    rejected: Number(counts.rejected || 0),
    suspended: Number(counts.suspended || 0)
  };
};

exports.listRegistrations = async ({ status, search } = {}) => {
  let where = [];
  let params = [];

  if (status && ['pending', 'approved', 'rejected', 'suspended'].includes(status)) {
    where.push('u.status = ?');
    params.push(status);
  }

  if (search && search.trim()) {
    where.push('(u.name LIKE ? OR u.email LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await db.query(`
    SELECT 
      u.id, u.name, u.email, u.role, u.status,
      u.created_at, u.updated_at,
      u.approved_at, u.approved_by,
      u.rejected_at, u.rejected_by, u.rejection_reason,
      u.suspended_at, u.suspended_by,
      admin_app.name AS approved_by_name,
      admin_rej.name AS rejected_by_name,
      admin_susp.name AS suspended_by_name,
      (SELECT COUNT(*) FROM vehicles v WHERE v.user_id = u.id) AS vehicles_count,
      (SELECT COUNT(*) FROM race_sessions r WHERE r.user_id = u.id) AS races_count
    FROM users u
    LEFT JOIN users admin_app ON admin_app.id = u.approved_by
    LEFT JOIN users admin_rej ON admin_rej.id = u.rejected_by
    LEFT JOIN users admin_susp ON admin_susp.id = u.suspended_by
    ${whereSql}
    ORDER BY 
      CASE WHEN u.status = 'pending' THEN 0 ELSE 1 END ASC,
      u.created_at DESC
  `, params);

  return rows;
};

exports.updateApprovalStatus = async (userId, { status, adminId, reason = null }) => {
  if (!['approved', 'rejected', 'suspended', 'pending'].includes(status)) {
    throw new Error('Status akun tidak valid.');
  }

  let updateSql = '';
  let params = [];

  if (status === 'approved') {
    updateSql = `
      UPDATE users 
      SET status = 'approved', approved_at = NOW(), approved_by = ?,
          rejected_at = NULL, rejected_by = NULL, rejection_reason = NULL,
          suspended_at = NULL, suspended_by = NULL
      WHERE id = ?
    `;
    params = [adminId, userId];
  } else if (status === 'rejected') {
    updateSql = `
      UPDATE users 
      SET status = 'rejected', rejected_at = NOW(), rejected_by = ?, rejection_reason = ?,
          suspended_at = NULL, suspended_by = NULL
      WHERE id = ?
    `;
    params = [adminId, reason || 'Pendaftaran tidak memenuhi kriteria verifikasi.', userId];
  } else if (status === 'suspended') {
    updateSql = `
      UPDATE users 
      SET status = 'suspended', suspended_at = NOW(), suspended_by = ?, rejection_reason = ?
      WHERE id = ?
    `;
    params = [adminId, reason || 'Akun dinonaktifkan sementara oleh admin.', userId];
  } else if (status === 'pending') {
    updateSql = `
      UPDATE users 
      SET status = 'pending', approved_at = NULL, approved_by = NULL,
          rejected_at = NULL, rejected_by = NULL, rejection_reason = NULL,
          suspended_at = NULL, suspended_by = NULL
      WHERE id = ?
    `;
    params = [userId];
  }

  const [res] = await db.query(updateSql, params);
  if (res.affectedRows === 0) {
    throw new Error('Pengguna tidak ditemukan.');
  }

  // Record into approval audit logs
  await db.query(`
    INSERT INTO registration_approval_logs (user_id, action, admin_id, reason)
    VALUES (?, ?, ?, ?)
  `, [userId, status, adminId, reason]);

  return exports.findById(userId);
};

exports.deleteById = async (userId, adminId) => {
  const user = await exports.findById(userId);
  if (!user) {
    throw new Error('Pengguna tidak ditemukan.');
  }
  if (user.role === 'admin') {
    throw new Error('Akun administrator tidak dapat dihapus.');
  }

  await db.query(
    'INSERT INTO registration_approval_logs (user_id, action, admin_id, reason) VALUES (?, ?, ?, ?)',
    [userId, 'deleted', adminId, 'Akun dihapus permanen oleh administrator']
  );

  await db.query('DELETE FROM users WHERE id = ?', [userId]);
  return user;
};

exports.getApprovalHistory = async (userId = null) => {
  let where = '';
  let params = [];
  if (userId) {
    where = 'WHERE l.user_id = ?';
    params.push(userId);
  }

  const [rows] = await db.query(`
    SELECT 
      l.id, l.user_id, l.action, l.reason, l.created_at,
      u.name AS user_name, u.email AS user_email,
      adm.name AS admin_name, adm.email AS admin_email
    FROM registration_approval_logs l
    LEFT JOIN users u ON u.id = l.user_id
    JOIN users adm ON adm.id = l.admin_id
    ${where}
    ORDER BY l.created_at DESC
    LIMIT 100
  `, params);

  return rows;
};
