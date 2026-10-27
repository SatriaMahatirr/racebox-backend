const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { auth } = require('../middleware/auth');

const pub = u => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  rejectionReason: u.rejection_reason || null,
  createdAt: u.created_at,
  updatedAt: u.updated_at
});

const tokens = u => ({
  accessToken: jwt.sign(
    { sub: u.id, email: u.email, role: u.role, status: u.status, type: 'access' },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  ),
  refreshToken: jwt.sign(
    { sub: u.id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  )
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Nama, email, dan password wajib diisi.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password minimal 6 karakter.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await User.findByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email sudah terdaftar.', code: 'EMAIL_EXISTS' });
    }

    // Force role: 'pengguna' and status: 'pending' (cannot be overridden by request payload)
    const newUser = await User.create({
      id: crypto.randomUUID(),
      name: name.trim(),
      email: cleanEmail,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'pengguna',
      status: 'pending'
    });

    res.status(201).json({
      success: true,
      message: 'Pendaftaran berhasil dikirim. Akun RACEBOX Anda sedang menunggu persetujuan admin. Anda akan dapat menggunakan aplikasi setelah akun disetujui.',
      data: {
        user: pub(newUser),
        status: 'pending'
      }
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const password = req.body.password || '';

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
    }

    const u = await User.findByEmail(email);
    if (!u || !(await bcrypt.compare(password, u.password_hash))) {
      return res.status(401).json({ success: false, message: 'Email atau password salah.', code: 'INVALID_CREDENTIALS' });
    }

    // Enforce Account Status Restrictions
    if (u.status === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Pendaftaran berhasil dikirim. Akun RACEBOX Anda sedang menunggu persetujuan admin. Anda akan dapat menggunakan aplikasi setelah akun disetujui.',
        code: 'ACCOUNT_PENDING',
        status: 'pending',
        data: {
          email: u.email,
          status: 'pending'
        }
      });
    }

    if (u.status === 'rejected') {
      return res.status(403).json({
        success: false,
        message: 'Pendaftaran akun Anda ditolak oleh admin.',
        code: 'ACCOUNT_REJECTED',
        status: 'rejected',
        rejectionReason: u.rejection_reason || 'Pendaftaran tidak memenuhi kriteria verifikasi.',
        data: {
          email: u.email,
          status: 'rejected',
          rejectionReason: u.rejection_reason || null
        }
      });
    }

    if (u.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Akun Anda sedang ditangguhkan dan akses aplikasi dibatasi.',
        code: 'ACCOUNT_SUSPENDED',
        status: 'suspended',
        data: {
          email: u.email,
          status: 'suspended'
        }
      });
    }

    if (u.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak. Status akun tidak valid.',
        code: 'ACCOUNT_NOT_APPROVED',
        status: u.status
      });
    }

    // Account is approved: issue tokens
    res.json({
      success: true,
      message: 'Login berhasil.',
      data: {
        user: pub(u),
        ...tokens(u)
      }
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/auth/status?email=...
router.get('/status', async (req, res, next) => {
  try {
    const email = (req.query.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: 'Parameter email wajib disertakan.' });
    }

    const u = await User.findByEmail(email);
    if (!u) {
      return res.status(404).json({ success: false, message: 'Akun dengan email tersebut tidak ditemukan.' });
    }

    let statusMessage = '';
    if (u.status === 'pending') {
      statusMessage = 'Pendaftaran berhasil dikirim. Akun RACEBOX Anda sedang menunggu persetujuan admin. Anda akan dapat menggunakan aplikasi setelah akun disetujui.';
    } else if (u.status === 'approved') {
      statusMessage = 'Akun Anda telah disetujui. Silakan login untuk menggunakan RACEBOX.';
    } else if (u.status === 'rejected') {
      statusMessage = 'Pendaftaran akun Anda belum disetujui oleh admin.';
    } else if (u.status === 'suspended') {
      statusMessage = 'Akun sedang ditangguhkan dan akses aplikasi dibatasi.';
    }

    res.json({
      success: true,
      data: {
        email: u.email,
        name: u.name,
        status: u.status,
        message: statusMessage,
        rejectionReason: u.status === 'rejected' ? (u.rejection_reason || null) : null,
        approvedAt: u.approved_at,
        createdAt: u.created_at
      }
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res, next) => {
  try {
    const u = await User.findById(req.user.sub);
    if (!u) return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
    res.json({ success: true, data: { user: pub(u) } });
  } catch (e) {
    next(e);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const p = jwt.verify(req.body.refreshToken || '', process.env.JWT_REFRESH_SECRET);
    if (p.type !== 'refresh') throw new Error();
    const u = await User.findById(p.sub);
    if (!u) throw new Error();

    // Check status during refresh as well
    if (u.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Status akun tidak lagi aktif.',
        code: 'ACCOUNT_NOT_APPROVED',
        status: u.status
      });
    }

    res.json({ success: true, data: tokens(u) });
  } catch (e) {
    res.status(401).json({ success: false, message: 'Refresh token tidak valid.', code: 'TOKEN_EXPIRED' });
  }
});

// POST /api/auth/logout
router.post('/logout', auth, (_req, res) => res.json({ success: true, message: 'Logout berhasil.' }));

module.exports = router;
