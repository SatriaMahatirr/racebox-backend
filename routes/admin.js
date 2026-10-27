const router = require('express').Router();
const db = require('../models/db');
const User = require('../models/user');
const { auth, admin } = require('../middleware/auth');

router.use(auth, admin);

router.get('/dashboard', async (_req, res, next) => {
  try {
    const [[users]] = await db.query('SELECT COUNT(*) total FROM users');
    const [[vehicles]] = await db.query('SELECT COUNT(*) total FROM vehicles');
    const [[races]] = await db.query('SELECT COUNT(*) total FROM race_sessions');
    const [[telemetry]] = await db.query('SELECT COUNT(*) total FROM telemetry_points');
    const stats = await User.getApprovalStats();
    res.json({
      success: true,
      data: {
        users: Number(users.total),
        vehicles: Number(vehicles.total),
        sessions: Number(races.total),
        telemetryPoints: Number(telemetry.total),
        approvals: stats
      }
    });
  } catch (e) {
    next(e);
  }
});

router.get('/users', async (_req, res, next) => {
  try {
    res.json({ success: true, data: { users: await User.list() } });
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/approvals
router.get('/approvals', async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const registrations = await User.listRegistrations({ status, search });
    const stats = await User.getApprovalStats();
    res.json({
      success: true,
      data: {
        stats,
        registrations
      }
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/admin/approvals/:id/approve
router.post('/approvals/:id/approve', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }
    const updated = await User.updateApprovalStatus(req.params.id, {
      status: 'approved',
      adminId: req.user.sub
    });
    res.json({
      success: true,
      message: `Pendaftaran pengguna ${user.name} (${user.email}) berhasil disetujui.`,
      data: { user: updated }
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/admin/approvals/:id/reject
router.post('/approvals/:id/reject', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }
    const reason = (req.body.reason || '').trim() || 'Pendaftaran tidak memenuhi kriteria verifikasi.';
    const updated = await User.updateApprovalStatus(req.params.id, {
      status: 'rejected',
      adminId: req.user.sub,
      reason
    });
    res.json({
      success: true,
      message: `Pendaftaran pengguna ${user.name} (${user.email}) telah ditolak.`,
      data: { user: updated, reason }
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/admin/approvals/:id/suspend
router.post('/approvals/:id/suspend', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }
    const reason = (req.body.reason || '').trim() || 'Akun dinonaktifkan sementara oleh administrator.';
    const updated = await User.updateApprovalStatus(req.params.id, {
      status: 'suspended',
      adminId: req.user.sub,
      reason
    });
    res.json({
      success: true,
      message: `Akun ${user.name} (${user.email}) berhasil ditangguhkan.`,
      data: { user: updated, reason }
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/admin/approvals/:id/reactivate
router.post('/approvals/:id/reactivate', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }
    const updated = await User.updateApprovalStatus(req.params.id, {
      status: 'approved',
      adminId: req.user.sub
    });
    res.json({
      success: true,
      message: `Akun ${user.name} (${user.email}) berhasil diaktifkan kembali.`,
      data: { user: updated }
    });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/admin/approvals/:id/delete
router.post('/approvals/:id/delete', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Akun administrator tidak dapat dihapus.' });
    }
    const deleted = await User.deleteById(req.params.id, req.user.sub);
    res.json({
      success: true,
      message: `Akun ${deleted.name} (${deleted.email}) berhasil dihapus permanen.`,
      data: { user: { id: deleted.id, name: deleted.name, email: deleted.email } }
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/approvals/history
router.get('/approvals/history', async (req, res, next) => {
  try {
    const history = await User.getApprovalHistory(req.query.userId || null);
    res.json({ success: true, data: { history } });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
