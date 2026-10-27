const jwt = require('jsonwebtoken');
const User = require('../models/user');

async function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token diperlukan.', code: 'UNAUTHORIZED' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    
    // Server-side verification of fresh status against database
    const user = await User.findById(decoded.sub);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Akun tidak ditemukan.', code: 'USER_NOT_FOUND' });
    }

    if (user.status === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Akun Anda sedang menunggu persetujuan admin. Anda belum dapat mengakses fitur ini.',
        code: 'ACCOUNT_PENDING',
        status: 'pending'
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        success: false,
        message: 'Pendaftaran akun Anda ditolak oleh admin.',
        code: 'ACCOUNT_REJECTED',
        status: 'rejected',
        rejection_reason: user.rejection_reason || null
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Akun Anda dinonaktifkan sementara oleh admin.',
        code: 'ACCOUNT_SUSPENDED',
        status: 'suspended'
      });
    }

    if (user.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak. Status akun belum disetujui.',
        code: 'ACCOUNT_NOT_APPROVED'
      });
    }

    req.user = {
      sub: user.id,
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      name: user.name
    };
    next();
  } catch (e) {
    return res.status(401).json({
      success: false,
      message: 'Token tidak valid atau kedaluwarsa.',
      code: 'TOKEN_EXPIRED'
    });
  }
}

function admin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak. Memerlukan hak akses administrator.',
      code: 'FORBIDDEN'
    });
  }
  next();
}

module.exports = { auth, admin };
