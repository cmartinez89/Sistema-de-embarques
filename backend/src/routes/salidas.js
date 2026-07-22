const router = require('express').Router();
const auth   = require('../middleware/auth');
const pool   = require('../db');
const { registrarBitacora } = require('../lib/bitacora');

let memSalidas = [];
let salidaSeq  = 1;

async function dbOk() {
  try { await pool.query('SELECT 1'); return true; } catch { return false; }
}

router.get('/folio/siguiente', auth, async (req, res) => {
  if (await dbOk()) {
    try {
      const [rows] = await pool.query('SELECT COALESCE(MAX(folio),0)+1 AS siguiente FROM salidas');
      return res.json({ siguiente: rows[0].siguiente });
    } catch { /* fallback */ }
  }
  const max = memSalidas.reduce((m, s) => Math.max(m, s.folio || 0), 0);
  res.json({ siguiente: max + 1 });
});

router.get('/', auth, async (req, res) => {
  const { fecha, cliente_id, folio, lote_canal, fecha_inicio, fecha_fin } = req.query;
  if (await dbOk()) {
    try {
      let q = 'SELECT * FROM salidas WHERE 1=1';
      const p = [];
      if (fecha)        { q += ' AND fecha=?';        p.push(fecha); }
      if (cliente_id)   { q += ' AND cliente_id=?';   p.push(cliente_id); }
      if (folio)        { q += ' AND folio=?';        p.push(folio); }
      if (lote_canal)   { q += ' AND lote_canal=?';   p.push(lote_canal); }
      if (fecha_inicio) { q += ' AND fecha>=?';        p.push(fecha_inicio); }
      if (fecha_fin)    { q += ' AND fecha<=?';        p.push(fecha_fin); }
      q += ' ORDER BY folio DESC, id DESC';
      const [rows] = await pool.query(q, p);
      return res.json(rows);
    } catch { /* fallback */ }
  }
  let rows = memSalidas;
  if (fecha)        rows = rows.filter(s => s.fecha === fecha);
  if (cliente_id)   rows = rows.filter(s => String(s.cliente_id) === String(cliente_id));
  if (folio)        rows = rows.filter(s => String(s.folio) === String(folio));
  if (lote_canal)   rows = rows.filter(s => s.lote_canal === lote_canal);
  if (fecha_inicio) rows = rows.filter(s => s.fecha >= fecha_inicio);
  if (fecha_fin)    rows = rows.filter(s => s.fecha <= fecha_fin);
  res.json(rows);
});

router.post('/', auth, async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const saved = [];
  const barcodes = items.map((i) => i.barcode).filter(Boolean);

  if (await dbOk()) {
    try {
      if (barcodes.length) {
        const [dup] = await pool.query('SELECT barcode FROM salidas WHERE barcode IN (?)', [barcodes]);
        if (dup.length) {
          return res.status(409).json({ error: `La caja ${dup[0].barcode} ya fue registrada en una salida` });
        }
      }
      for (const item of items) {
        const [result] = await pool.query(
          `INSERT INTO salidas
           (folio, fecha, cliente_id, cliente_nombre, lote_canal, codigo, producto,
            tipo_ganado, cajas, kilos, barcode, entregado_por, observaciones)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [item.folio, item.fecha, item.cliente_id, item.cliente_nombre,
           item.lote_canal, item.codigo, item.producto, item.tipo_ganado,
           item.cajas, item.kilos, item.barcode || null, item.entregado_por, item.observaciones || '']
        );
        const [rows] = await pool.query('SELECT * FROM salidas WHERE id=?', [result.insertId]);
        saved.push(rows[0]);
      }
      return res.json(saved);
    } catch { /* fallback */ }
  }

  if (barcodes.length) {
    const dup = memSalidas.find((s) => barcodes.includes(s.barcode));
    if (dup) {
      return res.status(409).json({ error: `La caja ${dup.barcode} ya fue registrada en una salida` });
    }
  }
  for (const item of items) {
    const rec = { id: salidaSeq++, ...item };
    memSalidas.push(rec);
    saved.push(rec);
  }
  res.json(saved);
});

// El documento de salida (escáner) se puede corregir, pero exige
// justificación — queda registrado en la bitácora con el antes/después.
router.put('/:id', auth, async (req, res) => {
  const justificacion = (req.body?.justificacion || '').trim();
  if (!justificacion) {
    return res.status(400).json({ error: 'Se requiere una justificación para editar' });
  }

  if (await dbOk()) {
    try {
      const [rows] = await pool.query('SELECT * FROM salidas WHERE id=?', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'No encontrado' });

      await pool.query(
        `UPDATE salidas SET cliente_id=?, cliente_nombre=?, lote_canal=?, codigo=?, producto=?,
         tipo_ganado=?, cajas=?, kilos=?, entregado_por=?, observaciones=?
         WHERE id=?`,
        [req.body.cliente_id, req.body.cliente_nombre, req.body.lote_canal, req.body.codigo, req.body.producto,
         req.body.tipo_ganado, req.body.cajas, req.body.kilos, req.body.entregado_por, req.body.observaciones || '',
         req.params.id]
      );
      const [rows2] = await pool.query('SELECT * FROM salidas WHERE id=?', [req.params.id]);
      await registrarBitacora(pool, {
        usuario_id: req.user?.id,
        usuario_nombre: req.user?.usuario,
        accion: 'editar',
        tabla: 'salidas',
        registro_id: req.params.id,
        justificacion,
        datos_antes: rows[0],
        datos_despues: rows2[0],
      });
      return res.json(rows2[0]);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'No se pudo actualizar la salida' });
    }
  }

  const idx = memSalidas.findIndex(s => s.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  const antes = memSalidas[idx];
  memSalidas[idx] = { ...memSalidas[idx], ...req.body };
  await registrarBitacora(pool, {
    usuario_id: req.user?.id,
    usuario_nombre: req.user?.usuario,
    accion: 'editar',
    tabla: 'salidas',
    registro_id: req.params.id,
    justificacion,
    datos_antes: antes,
    datos_despues: memSalidas[idx],
  });
  res.json(memSalidas[idx]);
});

router.delete('/:id', auth, async (req, res) => {
  if (await dbOk()) {
    try {
      await pool.query('DELETE FROM salidas WHERE id=?', [req.params.id]);
      return res.json({ ok: true });
    } catch { /* fallback */ }
  }
  memSalidas = memSalidas.filter(s => s.id !== Number(req.params.id));
  res.json({ ok: true });
});

router.getMemSalidas = () => memSalidas;

module.exports = router;
