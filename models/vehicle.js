const db = require('./db');

exports.list = async uid => {
  const [r] = await db.query('SELECT * FROM vehicles WHERE user_id=? ORDER BY name', [uid]);
  return r;
};

exports.find = async (id, uid) => {
  const [r] = await db.query('SELECT * FROM vehicles WHERE id=? AND user_id=? LIMIT 1', [id, uid]);
  return r[0] || null;
};

exports.create = async v => {
  await db.query(
    'INSERT INTO vehicles (id,user_id,name,type,weight_kg,bore_mm,stroke_mm,custom_cc,custom_specs,notes) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [v.id, v.userId, v.name, v.type, v.weightKg, v.boreMm, v.strokeMm, v.customCc, JSON.stringify(v.customSpecs || {}), v.notes]
  );
  return exports.find(v.id, v.userId);
};

exports.upsert = async v => {
  await db.query(`
    INSERT INTO vehicles (id,user_id,name,type,weight_kg,bore_mm,stroke_mm,custom_cc,custom_specs,notes)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
      name=VALUES(name), type=VALUES(type), weight_kg=VALUES(weight_kg),
      bore_mm=VALUES(bore_mm), stroke_mm=VALUES(stroke_mm), custom_cc=VALUES(custom_cc),
      custom_specs=VALUES(custom_specs), notes=VALUES(notes), updated_at=NOW()
  `, [v.id, v.userId, v.name, v.type, v.weightKg, v.boreMm, v.strokeMm, v.customCc, JSON.stringify(v.customSpecs || {}), v.notes]);
  return exports.find(v.id, v.userId);
};

exports.update = async (id, uid, v) => {
  await db.query(
    'UPDATE vehicles SET name=?,type=?,weight_kg=?,bore_mm=?,stroke_mm=?,custom_cc=?,custom_specs=?,notes=? WHERE id=? AND user_id=?',
    [v.name, v.type, v.weightKg, v.boreMm, v.strokeMm, v.customCc, JSON.stringify(v.customSpecs || {}), v.notes, id, uid]
  );
  return exports.find(id, uid);
};

exports.remove = async (id, uid) => {
  const [r] = await db.query('DELETE FROM vehicles WHERE id=? AND user_id=?', [id, uid]);
  return r.affectedRows > 0;
};

exports.setups = async (vehicleId, uid) => {
  const [r] = await db.query('SELECT s.* FROM vehicle_setups s WHERE s.vehicle_id=? AND s.user_id=? ORDER BY s.name', [vehicleId, uid]);
  return r;
};

exports.setup = async (id, uid) => {
  const [r] = await db.query('SELECT * FROM vehicle_setups WHERE id=? AND user_id=? LIMIT 1', [id, uid]);
  return r[0] || null;
};

exports.createSetup = async s => {
  await db.query(
    'INSERT INTO vehicle_setups (id,user_id,vehicle_id,name,final_gear,notes) VALUES (?,?,?,?,?,?)',
    [s.id, s.userId, s.vehicleId, s.name, s.finalGear, s.notes]
  );
  return exports.setup(s.id, s.userId);
};

exports.upsertSetup = async s => {
  await db.query(`
    INSERT INTO vehicle_setups (id,user_id,vehicle_id,name,final_gear,notes)
    VALUES (?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
      name=VALUES(name), final_gear=VALUES(final_gear), notes=VALUES(notes)
  `, [s.id, s.userId, s.vehicleId, s.name, s.finalGear, s.notes]);
  return exports.setup(s.id, s.userId);
};

exports.updateSetup = async (id, uid, s) => {
  await db.query(
    'UPDATE vehicle_setups SET name=?,final_gear=?,notes=? WHERE id=? AND user_id=?',
    [s.name, s.finalGear, s.notes, id, uid]
  );
  return exports.setup(id, uid);
};

exports.removeSetup = async (id, uid) => {
  const [r] = await db.query('DELETE FROM vehicle_setups WHERE id=? AND user_id=?', [id, uid]);
  return r.affectedRows > 0;
};
