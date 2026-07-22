const router       = require('express').Router();
const auth         = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const pool         = require('../db');
const { registrarBitacora } = require('../lib/bitacora');

const MOTIVOS = ['merma', 'decomiso', 'pérdida', 'corrección', 'otro'];
const TIPOS_MOVIMIENTO = ['entrada', 'salida'];

let memMovimientos = [];
let movSeq = 1;

async function dbOk() {
  try { await pool.query('SELECT 1'); return true; } catch { return false; }
}

router.get('/motivos', auth, (_req, res) => res.json(MOTIVOS));
router.get('/tipos-movimiento', auth, (_req, res) => res.json(TIPOS_MOVIMIENTO));

router.get('/', auth, async (req, res) => {
  const { fecha_inicio, fecha_fin, estado, tipo_movimiento } = req.query;
  if (await dbOk()) {
    try {
      let q = 'SELECT * FROM movimientos_inventario WHERE 1=1';
      const p = [];
      if (fecha_inicio)     { q += ' AND fecha>=?';          p.push(fecha_inicio); }
      if (fecha_fin)        { q += ' AND fecha<=?';          p.push(fecha_fin); }
      if (estado)           { q += ' AND estado=?';          p.push(estado); }
      if (tipo_movimiento)  { q += ' AND tipo_movimiento=?'; p.push(tipo_movimiento); }
      q += ' ORDER BY id DESC';
      const [rows] = await pool.query(q, p);
      return res.json(rows);
    } catch { /* fallback */ }
  }
  let rows = memMovimientos;
  if (fecha_inicio)    rows = rows.filter(m => m.fecha >= fecha_inicio);
  if (fecha_fin)       rows = rows.filter(m => m.fecha <= fecha_fin);
  if (estado)          rows = rows.filter(m => m.estado === estado);
  if (tipo_movimiento) rows = rows.filter(m => m.tipo_movimiento === tipo_movimiento);
  res.json(rows.slice().reverse());
});

// Solicitar uno o más movimientos — siempre nace en estado 'pendiente',
// sin importar el rol de quien lo captura. Requiere autorización aparte.
router.post('/', auth, async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const saved = [];

  if (await dbOk()) {
    try {
      for (const item of items) {
        const [result] = await pool.query(
          `INSERT INTO movimientos_inventario
           (fecha, tipo_movimiento, lote_num, codigo, producto, tipo_ganado, cajas, kilos, motivo, observaciones, estado, solicitado_por)
           VALUES (?,?,?,?,?,?,?,?,?,?,'pendiente',?)`,
          [item.fecha, item.tipo_movimiento === 'entrada' ? 'entrada' : 'salida',
           item.lote_num, item.codigo, item.producto, item.tipo_ganado,
           item.cajas, item.kilos, item.motivo || 'otro', item.observaciones || '', req.user?.id || null]
        );
        const [rows] = await pool.query('SELECT * FROM movimientos_inventario WHERE id=?', [result.insertId]);
        saved.push(rows[0]);
      }
      return res.json(saved);
    } catch { /* fallback */ }
  }

  for (const item of items) {
    const rec = {
      id: movSeq++,
      ...item,
      tipo_movimiento: item.tipo_movimiento === 'entrada' ? 'entrada' : 'salida',
      motivo: item.motivo || 'otro',
      observaciones: item.observaciones || '',
      estado: 'pendiente',
      solicitado_por: req.user?.id || null,
      autorizado_por: null,
      fecha_autorizacion: null,
      comentario_autorizacion: null,
    };
    memMovimientos.push(rec);
    saved.push(rec);
  }
  res.json(saved);
});

router.put('/:id/autorizar', auth, requireAdmin, async (req, res) => {
  const comentario = (req.body?.comentario || '').trim();

  if (await dbOk()) {
    const [rows] = await pool.query('SELECT * FROM movimientos_inventario WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    if (rows[0].estado !== 'pendiente') {
      return res.status(400).json({ error: 'Este movimiento ya fue procesado' });
    }
    await pool.query(
      `UPDATE movimientos_inventario
       SET estado='autorizado', autorizado_por=?, fecha_autorizacion=NOW(), comentario_autorizacion=?
       WHERE id=?`,
      [req.user?.id || null, comentario || null, req.params.id]
    );
    const [rows2] = await pool.query('SELECT * FROM movimientos_inventario WHERE id=?', [req.params.id]);
    await registrarBitacora(pool, {
      usuario_id: req.user?.id,
      usuario_nombre: req.user?.usuario,
      accion: 'autorizar',
      tabla: 'movimientos_inventario',
      registro_id: req.params.id,
      justificacion: comentario || 'Autorizado sin comentarios',
      datos_antes: rows[0],
      datos_despues: rows2[0],
    });
    return res.json(rows2[0]);
  }

  const mov = memMovimientos.find(m => m.id === Number(req.params.id));
  if (!mov) return res.status(404).json({ error: 'No encontrado' });
  if (mov.estado !== 'pendiente') return res.status(400).json({ error: 'Este movimiento ya fue procesado' });
  const antes = { ...mov };
  mov.estado = 'autorizado';
  mov.autorizado_por = req.user?.id || null;
  mov.fecha_autorizacion = new Date().toISOString();
  mov.comentario_autorizacion = comentario || null;
  await registrarBitacora(pool, {
    usuario_id: req.user?.id,
    usuario_nombre: req.user?.usuario,
    accion: 'autorizar',
    tabla: 'movimientos_inventario',
    registro_id: req.params.id,
    justificacion: comentario || 'Autorizado sin comentarios',
    datos_antes: antes,
    datos_despues: mov,
  });
  res.json(mov);
});

router.put('/:id/rechazar', auth, requireAdmin, async (req, res) => {
  const comentario = (req.body?.comentario || '').trim();
  if (!comentario) {
    return res.status(400).json({ error: 'Se requiere un comentario para rechazar el movimiento' });
  }

  if (await dbOk()) {
    const [rows] = await pool.query('SELECT * FROM movimientos_inventario WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    if (rows[0].estado !== 'pendiente') {
      return res.status(400).json({ error: 'Este movimiento ya fue procesado' });
    }
    await pool.query(
      `UPDATE movimientos_inventario
       SET estado='rechazado', autorizado_por=?, fecha_autorizacion=NOW(), comentario_autorizacion=?
       WHERE id=?`,
      [req.user?.id || null, comentario, req.params.id]
    );
    const [rows2] = await pool.query('SELECT * FROM movimientos_inventario WHERE id=?', [req.params.id]);
    await registrarBitacora(pool, {
      usuario_id: req.user?.id,
      usuario_nombre: req.user?.usuario,
      accion: 'rechazar',
      tabla: 'movimientos_inventario',
      registro_id: req.params.id,
      justificacion: comentario,
      datos_antes: rows[0],
      datos_despues: rows2[0],
    });
    return res.json(rows2[0]);
  }

  const mov = memMovimientos.find(m => m.id === Number(req.params.id));
  if (!mov) return res.status(404).json({ error: 'No encontrado' });
  if (mov.estado !== 'pendiente') return res.status(400).json({ error: 'Este movimiento ya fue procesado' });
  const antes = { ...mov };
  mov.estado = 'rechazado';
  mov.autorizado_por = req.user?.id || null;
  mov.fecha_autorizacion = new Date().toISOString();
  mov.comentario_autorizacion = comentario;
  await registrarBitacora(pool, {
    usuario_id: req.user?.id,
    usuario_nombre: req.user?.usuario,
    accion: 'rechazar',
    tabla: 'movimientos_inventario',
    registro_id: req.params.id,
    justificacion: comentario,
    datos_antes: antes,
    datos_despues: mov,
  });
  res.json(mov);
});

router.put('/:id', auth, async (req, res) => {
  const justificacion = (req.body?.justificacion || '').trim();
  if (!justificacion) {
    return res.status(400).json({ error: 'Se requiere una justificación para editar' });
  }

  if (await dbOk()) {
    const [rows] = await pool.query('SELECT * FROM movimientos_inventario WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    if (rows[0].estado !== 'pendiente') {
      return res.status(400).json({ error: 'Solo se pueden editar movimientos pendientes de autorización' });
    }
    await pool.query(
      `UPDATE movimientos_inventario
       SET fecha=?, tipo_movimiento=?, lote_num=?, codigo=?, producto=?, tipo_ganado=?, cajas=?, kilos=?, motivo=?, observaciones=?
       WHERE id=?`,
      [req.body.fecha, req.body.tipo_movimiento === 'entrada' ? 'entrada' : 'salida',
       req.body.lote_num, req.body.codigo, req.body.producto, req.body.tipo_ganado,
       req.body.cajas, req.body.kilos, req.body.motivo || 'otro', req.body.observaciones || '', req.params.id]
    );
    const [rows2] = await pool.query('SELECT * FROM movimientos_inventario WHERE id=?', [req.params.id]);
    await registrarBitacora(pool, {
      usuario_id: req.user?.id,
      usuario_nombre: req.user?.usuario,
      accion: 'editar',
      tabla: 'movimientos_inventario',
      registro_id: req.params.id,
      justificacion,
      datos_antes: rows[0],
      datos_despues: rows2[0],
    });
    return res.json(rows2[0]);
  }

  const idx = memMovimientos.findIndex(m => m.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  if (memMovimientos[idx].estado !== 'pendiente') {
    return res.status(400).json({ error: 'Solo se pueden editar movimientos pendientes de autorización' });
  }
  const antes = memMovimientos[idx];
  memMovimientos[idx] = { ...memMovimientos[idx], ...req.body };
  await registrarBitacora(pool, {
    usuario_id: req.user?.id,
    usuario_nombre: req.user?.usuario,
    accion: 'editar',
    tabla: 'movimientos_inventario',
    registro_id: req.params.id,
    justificacion,
    datos_antes: antes,
    datos_despues: memMovimientos[idx],
  });
  res.json(memMovimientos[idx]);
});

router.delete('/:id', auth, async (req, res) => {
  const justificacion = (req.body?.justificacion || '').trim();
  if (!justificacion) {
    return res.status(400).json({ error: 'Se requiere una justificación para eliminar' });
  }

  if (await dbOk()) {
    const [rows] = await pool.query('SELECT * FROM movimientos_inventario WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });

    await pool.query('DELETE FROM movimientos_inventario WHERE id=?', [req.params.id]);
    await registrarBitacora(pool, {
      usuario_id: req.user?.id,
      usuario_nombre: req.user?.usuario,
      accion: 'eliminar',
      tabla: 'movimientos_inventario',
      registro_id: req.params.id,
      justificacion,
      datos_antes: rows[0],
    });
    return res.json({ ok: true });
  }

  const idx = memMovimientos.findIndex(m => m.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  const [eliminado] = memMovimientos.splice(idx, 1);
  await registrarBitacora(pool, {
    usuario_id: req.user?.id,
    usuario_nombre: req.user?.usuario,
    accion: 'eliminar',
    tabla: 'movimientos_inventario',
    registro_id: req.params.id,
    justificacion,
    datos_antes: eliminado,
  });
  res.json({ ok: true });
});

router.getMemMovimientos = () => memMovimientos;

module.exports = router;
