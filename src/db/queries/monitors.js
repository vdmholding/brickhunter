import db from '../index.js';

export async function create(monitor) {
  const { rows } = await db.query(
    `INSERT INTO monitors (set_number, condition, target_price, sources)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [monitor.setNumber, monitor.condition, monitor.targetPrice, monitor.sources || null]
  );
  return rows[0];
}

export async function findById(id) {
  const { rows } = await db.query('SELECT * FROM monitors WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function listActive() {
  const { rows } = await db.query(
    'SELECT * FROM monitors WHERE active = true ORDER BY created_at ASC'
  );
  return rows;
}

export async function listAll() {
  const { rows } = await db.query('SELECT * FROM monitors ORDER BY created_at DESC');
  return rows;
}

export async function updateCheck(id, { price, source }) {
  const { rows } = await db.query(
    `UPDATE monitors SET last_checked = now(), last_price = $2, last_source = $3
     WHERE id = $1 RETURNING *`,
    [id, price, source]
  );
  return rows[0];
}

export async function deactivate(id) {
  const { rows } = await db.query(
    'UPDATE monitors SET active = false WHERE id = $1 RETURNING *',
    [id]
  );
  return rows[0];
}

export async function recordAlert(alert) {
  const { rows } = await db.query(
    `INSERT INTO alerts (monitor_id, price, source, url)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [alert.monitorId, alert.price, alert.source, alert.url]
  );
  return rows[0];
}

export async function getAlerts(monitorId, limit = 20) {
  const { rows } = await db.query(
    'SELECT * FROM alerts WHERE monitor_id = $1 ORDER BY triggered_at DESC LIMIT $2',
    [monitorId, limit]
  );
  return rows;
}

export async function recentAlerts(limit = 50) {
  const { rows } = await db.query(
    `SELECT a.*, m.set_number, m.target_price, m.condition
     FROM alerts a
     JOIN monitors m ON m.id = a.monitor_id
     ORDER BY a.triggered_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}
