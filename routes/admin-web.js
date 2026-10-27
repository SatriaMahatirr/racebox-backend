const router = require('express').Router();
const db = require('../models/db');
const User = require('../models/user');
const bcrypt = require('bcryptjs');

// Global middleware for admin routes to provide pending registrations count and admin profile
router.use(async (req, res, next) => {
  res.locals.admin = req.session && req.session.admin ? req.session.admin : null;
  res.locals.dbConnected = true;
  res.locals.currentPath = req.baseUrl + (req.path === '/' ? '' : req.path);
  if (req.session && req.session.admin) {
    try {
      const stats = await User.getApprovalStats();
      res.locals.pendingApprovalsCount = stats.pending;
    } catch {
      res.locals.pendingApprovalsCount = 0;
    }
  } else {
    res.locals.pendingApprovalsCount = 0;
  }
  next();
});

function requireAdminWeb(req, res, next) {
  if (req.session && req.session.admin) return next();
  return res.redirect('/admin/login');
}

// Public Registration Status Page
router.get('/register-status', async (req, res, next) => {
  try {
    const email = (req.query.email || '').trim().toLowerCase();
    let account = null;
    if (email) {
      account = await User.findByEmail(email);
    }
    res.render('admin/register-status', { email, account });
  } catch (e) {
    next(e);
  }
});

// Login GET
router.get('/login', (req, res) => {
  if (req.session?.admin) return res.redirect('/admin');
  res.render('admin/login', { error: null });
});

// Login POST
router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) {
      return res.status(400).render('admin/login', { error: 'Email dan password wajib diisi.' });
    }
    const user = await User.findByEmail(email);
    if (!user || user.role !== 'admin' || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).render('admin/login', { error: 'Login admin gagal. Periksa email dan password.' });
    }
    req.session.admin = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.redirect('/admin');
  } catch (e) {
    next(e);
  }
});

// Logout POST
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// Main Analytics Dashboard GET
router.get('/', requireAdminWeb, async (req, res, next) => {
  try {
    const [[users]] = await db.query('SELECT COUNT(*) total FROM users');
    const [[vehicles]] = await db.query('SELECT COUNT(*) total FROM vehicles');
    const [[races]] = await db.query('SELECT COUNT(*) total FROM race_sessions');
    const [[verified]] = await db.query("SELECT COUNT(*) total FROM race_sessions WHERE data_quality IN ('good', 'fair') OR max_speed_kmh > 0");
    const [[topSpeed]] = await db.query('SELECT MAX(max_speed_kmh) val FROM race_sessions');
    const [[best201]] = await db.query('SELECT MIN(time_201m_ms) val FROM race_sessions WHERE time_201m_ms > 0');
    const [[best402]] = await db.query('SELECT MIN(time_402m_ms) val FROM race_sessions WHERE time_402m_ms > 0');
    const approvalStats = await User.getApprovalStats();

    // List of vehicles for filter dropdown
    const [vehiclesList] = await db.query(`
      SELECT v.id, v.name, v.type, v.custom_cc, u.name as user_name
      FROM vehicles v
      JOIN users u ON u.id = v.user_id
      ORDER BY v.name ASC
    `);

    // Latest real race sessions
    const [latestRaces] = await db.query(`
      SELECT r.id, r.test_type, r.max_speed_kmh, r.time_0_60_ms, r.time_0_100_ms,
             r.time_201m_ms, r.time_402m_ms, r.data_quality, r.data_quality_score,
             r.created_at, u.name as user_name, v.name as vehicle_name
      FROM race_sessions r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN vehicles v ON v.id = r.vehicle_id
      ORDER BY r.created_at DESC
      LIMIT 15
    `);

    // Distribution by test type
    const [testTypesDist] = await db.query(`
      SELECT test_type, COUNT(*) as count
      FROM race_sessions
      GROUP BY test_type
    `);

    // Leaderboard: Top motorcycles by top speed
    const [leaderboard] = await db.query(`
      SELECT v.id, v.name, v.type, v.custom_cc,
             COUNT(r.id) as sessions_count,
             MAX(r.max_speed_kmh) as top_speed,
             MIN(r.time_201m_ms) as best_201m
      FROM vehicles v
      JOIN race_sessions r ON r.vehicle_id = v.id
      GROUP BY v.id, v.name, v.type, v.custom_cc
      ORDER BY top_speed DESC
      LIMIT 5
    `);

    res.render('admin/dashboard', {
      admin: req.session.admin,
      stats: {
        users: Number(users.total || 0),
        vehicles: Number(vehicles.total || 0),
        races: Number(races.total || 0),
        verified: Number(verified.total || 0),
        topSpeed: topSpeed.val ? Number(topSpeed.val).toFixed(1) : null,
        best201m: best201.val ? (Number(best201.val) / 1000).toFixed(3) : null,
        best402m: best402.val ? (Number(best402.val) / 1000).toFixed(3) : null,
        approvalStats
      },
      vehiclesList,
      latestRaces,
      testTypesDist,
      leaderboard,
      dbConnected: true
    });
  } catch (e) {
    next(e);
  }
});

// REST API for Analytics dynamic filtering
router.get('/api/analytics', requireAdminWeb, async (req, res, next) => {
  try {
    const { vehicleId, testType, range } = req.query;
    let whereClauses = [];
    let params = [];

    if (vehicleId && vehicleId !== 'all') {
      whereClauses.push('r.vehicle_id = ?');
      params.push(vehicleId);
    }

    if (testType && testType !== 'all') {
      whereClauses.push('r.test_type = ?');
      params.push(testType);
    }

    if (range === '7d') {
      whereClauses.push('r.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    } else if (range === '30d') {
      whereClauses.push('r.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [races] = await db.query(`
      SELECT r.id, r.test_type, r.max_speed_kmh, r.time_0_60_ms, r.time_0_100_ms,
             r.time_201m_ms, r.time_402m_ms, r.duration_ms, r.distance_m,
             r.data_quality, r.created_at, u.name as user_name, v.name as vehicle_name
      FROM race_sessions r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN vehicles v ON v.id = r.vehicle_id
      ${whereSql}
      ORDER BY r.created_at ASC
    `, params);

    const [[metrics]] = await db.query(`
      SELECT COUNT(*) as total_races,
             MAX(max_speed_kmh) as max_speed,
             AVG(max_speed_kmh) as avg_speed,
             MIN(time_201m_ms) as best_201m,
             MIN(time_402m_ms) as best_402m
      FROM race_sessions r
      ${whereSql}
    `, params);

    res.json({
      success: true,
      count: races.length,
      metrics: {
        totalRaces: Number(metrics.total_races || 0),
        maxSpeed: metrics.max_speed ? Number(metrics.max_speed).toFixed(1) : null,
        avgSpeed: metrics.avg_speed ? Number(metrics.avg_speed).toFixed(1) : null,
        best201m: metrics.best_201m ? (Number(metrics.best_201m) / 1000).toFixed(3) : null,
        best402m: metrics.best_402m ? (Number(metrics.best_402m) / 1000).toFixed(3) : null
      },
      races
    });
  } catch (e) {
    next(e);
  }
});

// Approvals Management Page GET
router.get('/approvals', requireAdminWeb, async (req, res, next) => {
  try {
    const statusFilter = req.query.status || 'pending';
    const searchQuery = req.query.search || '';
    const msg = req.query.msg || '';

    const stats = await User.getApprovalStats();
    const registrations = await User.listRegistrations({
      status: statusFilter === 'all' ? null : statusFilter,
      search: searchQuery
    });
    const history = await User.getApprovalHistory();

    res.render('admin/approvals', {
      admin: req.session.admin,
      stats,
      registrations,
      history,
      statusFilter,
      searchQuery,
      msg
    });
  } catch (e) {
    next(e);
  }
});

// Approvals Action: Approve POST
router.post('/approvals/:id/approve', requireAdminWeb, async (req, res, next) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.redirect('/admin/approvals?msg=error_not_found');
    }
    await User.updateApprovalStatus(req.params.id, {
      status: 'approved',
      adminId: req.session.admin.id
    });
    res.redirect('/admin/approvals?msg=approved&email=' + encodeURIComponent(targetUser.email));
  } catch (e) {
    next(e);
  }
});

// Approvals Action: Reject POST
router.post('/approvals/:id/reject', requireAdminWeb, async (req, res, next) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.redirect('/admin/approvals?msg=error_not_found');
    }
    const reason = (req.body.reason || '').trim() || 'Pendaftaran tidak memenuhi kriteria verifikasi identitas.';
    await User.updateApprovalStatus(req.params.id, {
      status: 'rejected',
      adminId: req.session.admin.id,
      reason
    });
    res.redirect('/admin/approvals?msg=rejected&email=' + encodeURIComponent(targetUser.email));
  } catch (e) {
    next(e);
  }
});

// Approvals Action: Suspend POST
router.post('/approvals/:id/suspend', requireAdminWeb, async (req, res, next) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.redirect('/admin/approvals?msg=error_not_found');
    }
    const reason = (req.body.reason || '').trim() || 'Akun dinonaktifkan sementara oleh administrator.';
    await User.updateApprovalStatus(req.params.id, {
      status: 'suspended',
      adminId: req.session.admin.id,
      reason
    });
    res.redirect('/admin/approvals?msg=suspended&email=' + encodeURIComponent(targetUser.email));
  } catch (e) {
    next(e);
  }
});

// Approvals Action: Reactivate POST
router.post('/approvals/:id/reactivate', requireAdminWeb, async (req, res, next) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.redirect('/admin/approvals?msg=error_not_found');
    }
    await User.updateApprovalStatus(req.params.id, {
      status: 'approved',
      adminId: req.session.admin.id
    });
    res.redirect('/admin/approvals?msg=reactivated&email=' + encodeURIComponent(targetUser.email));
  } catch (e) {
    next(e);
  }
});

// Approvals Action: Delete POST
router.post('/approvals/:id/delete', requireAdminWeb, async (req, res, next) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.redirect('/admin/approvals?msg=error_not_found');
    }
    if (targetUser.role === 'admin') {
      return res.redirect('/admin/approvals?msg=error_delete_admin');
    }
    await User.deleteById(req.params.id, req.session.admin.id);
    res.redirect('/admin/approvals?msg=deleted');
  } catch (e) {
    next(e);
  }
});

// Users Management GET
router.get('/users', requireAdminWeb, async (req, res, next) => {
  try {
    const [users] = await db.query(`
      SELECT u.id, u.name, u.email, u.role, u.status, u.created_at,
             (SELECT COUNT(*) FROM vehicles v WHERE v.user_id = u.id) as vehicles_count,
             (SELECT COUNT(*) FROM race_sessions r WHERE r.user_id = u.id) as races_count
      FROM users u
      ORDER BY u.created_at DESC
    `);
    res.render('admin/users', { admin: req.session.admin, users });
  } catch (e) {
    next(e);
  }
});

// Vehicles / Garage Management GET
router.get('/vehicles', requireAdminWeb, async (req, res, next) => {
  try {
    // LEFT JOIN agar vehicle "yatim" (user terhapus/tdk valid) tetap tampil & bisa didiagnosis
    const [vehicles] = await db.query(`
      SELECT v.*, 
             u.name as user_name, u.email as user_email, u.status as user_status,
             (SELECT COUNT(*) FROM race_sessions r WHERE r.vehicle_id = v.id) as races_count,
             (SELECT MAX(r.max_speed_kmh) FROM race_sessions r WHERE r.vehicle_id = v.id) as max_speed,
             (SELECT COUNT(*) FROM vehicle_setups s WHERE s.vehicle_id = v.id) as setups_count,
             CASE WHEN u.id IS NULL THEN 1 ELSE 0 END AS owner_invalid
      FROM vehicles v
      LEFT JOIN users u ON u.id = v.user_id
      ORDER BY owner_invalid DESC, v.created_at DESC
    `);
    res.render('admin/vehicles', { admin: req.session.admin, vehicles });
  } catch (e) {
    next(e);
  }
});

// NEW: Garage Owners View - Garasi per Pemilik (tanpa dependency SQL VIEW)
router.get('/garage-owners', requireAdminWeb, async (req, res, next) => {
  try {
    // Ambil summary per pemilik langsung via query (tidak butuh VIEW migration)
    const [ownersSummary] = await db.query(`
      SELECT 
        u.id AS user_id,
        u.name AS owner_name,
        u.email AS owner_email,
        u.status AS owner_status,
        u.role AS owner_role,
        u.created_at AS owner_since,
        COUNT(DISTINCT v.id) AS total_vehicles,
        COUNT(DISTINCT vs.id) AS total_setups,
        COUNT(DISTINCT r.id) AS total_races,
        MAX(r.max_speed_kmh) AS best_top_speed,
        MAX(v.created_at) AS last_vehicle_added,
        MAX(r.created_at) AS last_race_date
      FROM users u
      LEFT JOIN vehicles v ON v.user_id = u.id
      LEFT JOIN vehicle_setups vs ON vs.user_id = u.id
      LEFT JOIN race_sessions r ON r.user_id = u.id
      WHERE u.role = 'pengguna'
      GROUP BY u.id, u.name, u.email, u.status, u.role, u.created_at
      HAVING total_vehicles > 0 OR total_races > 0
      ORDER BY total_vehicles DESC, total_races DESC
    `);

    // Untuk setiap pemilik, ambil detail motor mereka
    const owners = [];
    for (const owner of ownersSummary) {
      const [vehicles] = await db.query(`
        SELECT v.*,
               (SELECT COUNT(*) FROM race_sessions r WHERE r.vehicle_id = v.id) as races_count,
               (SELECT COUNT(*) FROM vehicle_setups s WHERE s.vehicle_id = v.id) as setups_count
        FROM vehicles v
        WHERE v.user_id = ?
        ORDER BY v.created_at DESC
      `, [owner.user_id]);

      owners.push({
        ...owner,
        vehicles: vehicles
      });
    }

    // Statistik global
    const [[globalStats]] = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM vehicles) AS total_vehicles,
        (SELECT COUNT(*) FROM vehicles v LEFT JOIN users u ON u.id = v.user_id WHERE u.id IS NULL) AS orphaned_vehicles,
        (SELECT COUNT(DISTINCT user_id) FROM vehicles) AS total_owners
    `);

    res.render('admin/garage-owners', { 
      admin: req.session.admin, 
      owners,
      globalStats
    });
  } catch (e) {
    console.error('Error loading garage owners:', e);
    next(e);
  }
});

// NEW: Garage Activity Logs - Log aktivitas garasi
router.get('/garage-logs', requireAdminWeb, async (req, res, next) => {
  try {
    const GarageLog = require('../models/garage-log');
    
    const logs = await GarageLog.getActivityLogs(null, 200);
    const stats = await GarageLog.getActivityStats();

    res.render('admin/garage-logs', { 
      admin: req.session.admin, 
      logs,
      stats
    });
  } catch (e) {
    console.error('Error loading garage logs:', e);
    next(e);
  }
});

// Race Sessions GET
router.get('/races', requireAdminWeb, async (req, res, next) => {
  try {
    const [races] = await db.query(`
      SELECT r.*, u.name as user_name, u.email as user_email, v.name as vehicle_name
      FROM race_sessions r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN vehicles v ON v.id = r.vehicle_id
      ORDER BY r.created_at DESC
      LIMIT 200
    `);
    res.render('admin/races', { admin: req.session.admin, races });
  } catch (e) {
    next(e);
  }
});

// Race Session Detail GET
router.get('/races/:id', requireAdminWeb, async (req, res, next) => {
  try {
    const [[race]] = await db.query(`
      SELECT r.*, u.name as user_name, u.email as user_email, v.name as vehicle_name,
             v.type as vehicle_type, v.custom_cc as vehicle_cc, v.weight_kg as vehicle_weight
      FROM race_sessions r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN vehicles v ON v.id = r.vehicle_id
      WHERE r.id = ?
    `, [req.params.id]);

    if (!race) {
      return res.status(404).render('admin/not-found', { admin: req.session.admin });
    }

    const [telemetry] = await db.query(
      'SELECT * FROM telemetry_points WHERE session_id = ? ORDER BY timestamp_ms ASC LIMIT 2000',
      [req.params.id]
    );

    res.render('admin/race-detail', { admin: req.session.admin, race, telemetry });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
