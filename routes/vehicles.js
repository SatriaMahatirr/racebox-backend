const router = require('express').Router();
const crypto = require('crypto');
const db = require('../models/db');
const M = require('../models/vehicle');
const GarageLog = require('../models/garage-log');
const { auth } = require('../middleware/auth');
router.use(auth);

const num = v => (v === undefined || v === null ? null : Number(v));

const parseSpecs = v => {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch (_) { return {}; }
};

const mapVehicle = v => {
  if (!v) return null;
  return {
    id: v.id,
    user_id: v.user_id,
    name: v.name,
    type: v.type,
    weight_kg: num(v.weight_kg),
    bore_mm: num(v.bore_mm),
    stroke_mm: num(v.stroke_mm),
    custom_cc: num(v.custom_cc),
    custom_specs: parseSpecs(v.custom_specs),
    notes: v.notes,
    created_at: v.created_at,
    updated_at: v.updated_at,
  };
};

router.get('/', async (req, res, next) => {
  try {
    const list = await M.list(req.user.sub);
    res.json({ success: true, data: { vehicles: list.map(mapVehicle) } });
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const v = await M.find(req.params.id, req.user.sub);
    if (!v) return res.status(404).json({ success: false, message: 'Kendaraan tidak ditemukan.' });
    res.json({ success: true, data: { vehicle: mapVehicle(v) } });
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const b = req.body;
    
    // Validasi user
    if (!req.user || !req.user.sub) {
      return res.status(401).json({ success: false, message: 'User tidak valid atau session expired.' });
    }

    // Validasi input
    if (!b.name || !b.name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama kendaraan wajib diisi.' });
    }

    const targetId = b.id || crypto.randomUUID();
    const isNew = !b.id;
    
    const v = await M.upsert({
      id: targetId,
      userId: req.user.sub,
      name: b.name.trim(),
      type: b.type ?? null,
      weightKg: num(b.weightKg),
      boreMm: num(b.boreMm),
      strokeMm: num(b.strokeMm),
      customCc: num(b.customCc),
      customSpecs: b.customSpecs || {},
      notes: b.notes ?? null,
    });

    if (!v) {
      return res.status(500).json({ success: false, message: 'Gagal menyimpan kendaraan ke database.' });
    }

    // Log aktivitas
    await GarageLog.logActivity(
      req.user.sub, 
      targetId, 
      isNew ? 'vehicle_added' : 'vehicle_updated',
      { name: v.name, type: v.type, customCc: v.custom_cc }
    );

    res.status(201).json({ success: true, data: { vehicle: mapVehicle(v) } });
  } catch (e) {
    console.error('Error creating vehicle:', e);
    next(e);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const b = req.body;

    // Validasi user
    if (!req.user || !req.user.sub) {
      return res.status(401).json({ success: false, message: 'User tidak valid atau session expired.' });
    }

    // Validasi input
    if (!b.name || !b.name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama kendaraan wajib diisi.' });
    }

    // Upsert: jika motor belum ada di server (baru dari offline), buat.
    // Jika sudah ada DAN dimiliki user lain → tolak (anti-hijack).
    const existing = await M.find(req.params.id, req.user.sub);
    if (existing === null) {
      // Cek apakah ID dipakai user lain
      const [ownedByOther] = await db.query(
        'SELECT user_id FROM vehicles WHERE id=? LIMIT 1',
        [req.params.id]
      );
      if (ownedByOther && ownedByOther.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'Kendaraan ini milik akun lain. Tidak dapat menyimpan perubahan.',
          code: 'VEHICLE_OWNED_BY_OTHER'
        });
      }
    }

    const v = await M.upsert({
      id: req.params.id,
      userId: req.user.sub,
      name: b.name.trim(),
      type: b.type ?? null,
      weightKg: num(b.weightKg),
      boreMm: num(b.boreMm),
      strokeMm: num(b.strokeMm),
      customCc: num(b.customCc),
      customSpecs: b.customSpecs || {},
      notes: b.notes ?? null,
    });

    if (!v) {
      return res.status(500).json({ success: false, message: 'Gagal menyimpan kendaraan.' });
    }

    // Log aktivitas
    await GarageLog.logActivity(
      req.user.sub,
      req.params.id,
      existing ? 'vehicle_updated' : 'vehicle_added',
      { name: v.name, type: v.type, customCc: v.custom_cc }
    );

    res.json({ success: true, data: { vehicle: mapVehicle(v) } });
  } catch (e) {
    console.error('Error updating vehicle:', e);
    next(e);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const vehicleToDelete = await M.find(req.params.id, req.user.sub);
    
    if (!(await M.remove(req.params.id, req.user.sub))) {
      return res.status(404).json({ success: false, message: 'Kendaraan tidak ditemukan.' });
    }

    // Log aktivitas penghapusan
    if (vehicleToDelete) {
      await GarageLog.logActivity(
        req.user.sub,
        req.params.id,
        'vehicle_deleted',
        { name: vehicleToDelete.name, type: vehicleToDelete.type }
      );
    }

    res.json({ success: true, message: 'Kendaraan dihapus.' });
  } catch (e) {
    next(e);
  }
});

router.get('/:vehicleId/setups', async (req, res, next) => {
  try {
    const setups = await M.setups(req.params.vehicleId, req.user.sub);
    res.json({ success: true, data: { setups } });
  } catch (e) {
    next(e);
  }
});

router.post('/:vehicleId/setups', async (req, res, next) => {
  try {
    const b = req.body;
    if (!b.name) return res.status(400).json({ success: false, message: 'Nama setup wajib diisi.' });
    const targetId = b.id || crypto.randomUUID();
    const s = await M.upsertSetup({
      id: targetId,
      userId: req.user.sub,
      vehicleId: req.params.vehicleId,
      name: b.name,
      finalGear: b.finalGear ?? null,
      notes: b.notes ?? null,
    });
    res.status(201).json({ success: true, data: { setup: s } });
  } catch (e) {
    next(e);
  }
});

router.put('/setups/:id', async (req, res, next) => {
  try {
    const b = req.body;
    const s = await M.updateSetup(req.params.id, req.user.sub, {
      name: b.name,
      finalGear: b.finalGear ?? null,
      notes: b.notes ?? null,
    });
    if (!s) return res.status(404).json({ success: false, message: 'Setup tidak ditemukan.' });
    res.json({ success: true, data: { setup: s } });
  } catch (e) {
    next(e);
  }
});

router.delete('/setups/:id', async (req, res, next) => {
  try {
    if (!(await M.removeSetup(req.params.id, req.user.sub))) {
      return res.status(404).json({ success: false, message: 'Setup tidak ditemukan.' });
    }
    res.json({ success: true, message: 'Setup dihapus.' });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
