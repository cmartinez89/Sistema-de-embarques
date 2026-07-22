const router = require('express').Router();
const auth   = require('../middleware/auth');
const pool   = require('../db');
const { buildBarcode } = require('../lib/barcode');
const { renderZplEtiqueta } = require('../lib/zpl');
const { registrarBitacora } = require('../lib/bitacora');

const PRODUCTOS_DEFAULT = [
  { id: 1,  codigo: '101', nombre: 'Lomo completo',        tipo_ganado: 'Ambos' },
  { id: 2,  codigo: '102', nombre: 'Lomo fino',            tipo_ganado: 'Ambos' },
  { id: 3,  codigo: '103', nombre: 'Costilla cargada',     tipo_ganado: 'Ambos' },
  { id: 4,  codigo: '104', nombre: 'Costilla corta',       tipo_ganado: 'Ambos' },
  { id: 5,  codigo: '105', nombre: 'Espaldilla completa',  tipo_ganado: 'Ambos' },
  { id: 6,  codigo: '106', nombre: 'Chambarete delantero', tipo_ganado: 'Ambos' },
  { id: 7,  codigo: '107', nombre: 'Chambarete trasero',   tipo_ganado: 'Ambos' },
  { id: 8,  codigo: '108', nombre: 'Pierna completa',      tipo_ganado: 'Ambos' },
  { id: 9,  codigo: '109', nombre: 'Bola de pierna',       tipo_ganado: 'Ambos' },
  { id: 10, codigo: '110', nombre: 'Cuete',                tipo_ganado: 'Ambos' },
  { id: 11, codigo: '111', nombre: 'Pulpa negra',          tipo_ganado: 'Ambos' },
  { id: 12, codigo: '112', nombre: 'Paleta completa',      tipo_ganado: 'Ambos' },
  { id: 13, codigo: '113', nombre: 'Pescuezo',             tipo_ganado: 'Ambos' },
  { id: 14, codigo: '114', nombre: 'Falda',                tipo_ganado: 'Ambos' },
  { id: 15, codigo: '115', nombre: 'Vísceras',             tipo_ganado: 'Ambos' },
  { id: 16, codigo: '591', nombre: 'Corte especial 591',   tipo_ganado: 'De Procarne' },
];

let memEntradas   = [];
let memEtiquetas  = [];
let entradaSeq    = 1;
let etiquetaSeq   = 1;
let memCajaCounters = {}; // `${lote_id}:${codigo}` -> último número usado

async function dbOk() {
  try { await pool.query('SELECT 1'); return true; } catch { return false; }
}

/* ─── Productos (catálogo rápido para el formulario de entradas) ─── */
router.get('/productos', auth, async (req, res) => {
  if (await dbOk()) {
    try {
      const [rows] = await pool.query('SELECT * FROM productos ORDER BY codigo');
      if (rows.length) return res.json(rows);
    } catch { /* tabla no existe aún */ }
  }
  res.json(PRODUCTOS_DEFAULT);
});

/* ─── Entradas ─── */

router.get('/resumen-por-lote', auth, async (req, res) => {
  if (await dbOk()) {
    try {
      const [rows] = await pool.query(`
        SELECT lote_id, COALESCE(SUM(cajas),0) AS num_cajas, COALESCE(SUM(kilos),0) AS kilos_total
        FROM entradas
        GROUP BY lote_id
      `);
      return res.json(rows);
    } catch { /* tabla no existe */ }
  }
  const map = {};
  for (const e of memEntradas) {
    const key = e.lote_id;
    if (!map[key]) map[key] = { lote_id: key, num_cajas: 0, kilos_total: 0 };
    map[key].num_cajas += Number(e.cajas || 0);
    map[key].kilos_total += Number(e.kilos || 0);
  }
  res.json(Object.values(map));
});

router.get('/', auth, async (req, res) => {
  const { lote_id, fecha } = req.query;
  if (await dbOk()) {
    try {
      let q = `SELECT en.*, et.barcode
                FROM entradas en
                LEFT JOIN etiquetas et ON et.id = en.etiqueta_id
                WHERE 1=1`;
      const p = [];
      if (lote_id) { q += ' AND en.lote_id=?'; p.push(lote_id); }
      if (fecha)   { q += ' AND en.fecha=?';   p.push(fecha); }
      q += ' ORDER BY en.id';
      const [rows] = await pool.query(q, p);
      return res.json(rows);
    } catch { /* tabla no existe */ }
  }
  let rows = memEntradas.map((e) => ({ ...e, barcode: memEtiquetas.find((et) => et.id === e.etiqueta_id)?.barcode }));
  if (lote_id) rows = rows.filter(e => String(e.lote_id) === String(lote_id));
  if (fecha)   rows = rows.filter(e => e.fecha === fecha);
  res.json(rows);
});

router.post('/', auth, async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const saved = [];

  if (await dbOk()) {
    try {
      for (const item of items) {
        const [result] = await pool.query(
          `INSERT INTO entradas
           (lote_id, lote_num, fecha, tipo_ganado, codigo, producto, cajas, kilos, caja)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [item.lote_id || null, item.lote_num, item.fecha, item.tipo_ganado,
           item.codigo, item.producto, item.cajas, item.kilos, item.caja || null]
        );
        const [rows] = await pool.query('SELECT * FROM entradas WHERE id = ?', [result.insertId]);
        saved.push(rows[0]);
      }
      return res.json(saved);
    } catch { /* fallback */ }
  }

  for (const item of items) {
    const rec = { id: entradaSeq++, ...item };
    memEntradas.push(rec);
    saved.push(rec);
  }
  res.json(saved);
});

/* ─── Inventario inicial: cajas físicas que ya existen (con etiqueta ya
   impresa, de antes de usar el sistema o de un conteo físico). A diferencia
   de /caja, aquí el código de barras ya lo trae la caja escaneada — no se
   genera uno nuevo, y no hay lote_id real (queda NULL). Crea tanto la
   entrada como la etiqueta para que la caja se pueda escanear después en
   Salidas igual que cualquier otra. ─── */
router.post('/inventario-inicial', auth, async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const saved = [];

  if (await dbOk()) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const item of items) {
        const { barcode, lote_num, tipo_ganado, codigo, producto, kilos, caja, fecha } = item;
        const [etRes] = await conn.query(
          `INSERT INTO etiquetas (lote_id, lote_num, codigo, producto, caja, kilos, barcode, fecha, romaneaje, usuario_id)
           VALUES (NULL,?,?,?,?,?,?,?,NULL,?)`,
          [lote_num, codigo, producto, caja, kilos, barcode, fecha, req.user?.id || null]
        );
        const [enRes] = await conn.query(
          `INSERT INTO entradas (lote_id, lote_num, fecha, tipo_ganado, codigo, producto, cajas, kilos, caja, etiqueta_id)
           VALUES (NULL,?,?,?,?,?,1,?,?,?)`,
          [lote_num, fecha, tipo_ganado, codigo, producto, kilos, caja, etRes.insertId]
        );
        const [[entrada]] = await conn.query('SELECT * FROM entradas WHERE id=?', [enRes.insertId]);
        saved.push(entrada);
      }
      await conn.commit();
      return res.json(saved);
    } catch (err) {
      await conn.rollback();
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Una de estas cajas ya fue agregada antes (código de barras duplicado)' });
      }
      console.error(err);
      return res.status(500).json({ error: 'No se pudo agregar al inventario' });
    } finally {
      conn.release();
    }
  }

  for (const item of items) {
    const { barcode, lote_num, tipo_ganado, codigo, producto, kilos, caja, fecha } = item;
    if (memEtiquetas.some((e) => e.barcode === barcode)) {
      return res.status(409).json({ error: `La caja ${barcode} ya fue agregada antes` });
    }
    const etiqueta = { id: etiquetaSeq++, lote_id: null, lote_num, tipo_ganado, codigo, producto, caja, kilos, barcode, fecha, romaneaje: null, activa: true, veces_impresa: 1 };
    memEtiquetas.push(etiqueta);
    const entrada = { id: entradaSeq++, lote_id: null, lote_num, fecha, tipo_ganado, codigo, producto, cajas: 1, kilos, caja, etiqueta_id: etiqueta.id };
    memEntradas.push(entrada);
    saved.push(entrada);
  }
  res.json(saved);
});

router.delete('/:id', auth, async (req, res) => {
  const justificacion = (req.body?.justificacion || '').trim();
  if (!justificacion) {
    return res.status(400).json({ error: 'Se requiere una justificación para eliminar' });
  }

  if (await dbOk()) {
    try {
      const [rows] = await pool.query('SELECT * FROM entradas WHERE id=?', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'No encontrado' });

      await pool.query('DELETE FROM entradas WHERE id=?', [req.params.id]);
      await registrarBitacora(pool, {
        usuario_id: req.user?.id,
        usuario_nombre: req.user?.usuario,
        accion: 'eliminar',
        tabla: 'entradas',
        registro_id: req.params.id,
        justificacion,
        datos_antes: rows[0],
      });
      return res.json({ ok: true });
    } catch { /* fallback */ }
  }
  const idx = memEntradas.findIndex(e => e.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  const [eliminado] = memEntradas.splice(idx, 1);
  await registrarBitacora(pool, {
    usuario_id: req.user?.id,
    usuario_nombre: req.user?.usuario,
    accion: 'eliminar',
    tabla: 'entradas',
    registro_id: req.params.id,
    justificacion,
    datos_antes: eliminado,
  });
  res.json({ ok: true });
});

/* ─── Captura por caja individual (Fase 1) ───
   Cada caja de producto terminado es un renglón propio con su consecutivo
   de caja (por producto dentro del lote) y su etiqueta persistida. */

router.get('/siguiente-caja', auth, async (req, res) => {
  const { lote_id, codigo } = req.query;
  if (!lote_id || !codigo) return res.status(400).json({ error: 'lote_id y codigo son requeridos' });

  if (await dbOk()) {
    try {
      const [rows] = await pool.query(
        'SELECT COALESCE(MAX(caja),0)+1 AS siguiente FROM etiquetas WHERE lote_id=? AND codigo=?',
        [lote_id, codigo]
      );
      return res.json({ siguiente: rows[0].siguiente });
    } catch { /* fallback */ }
  }
  const key = `${lote_id}:${codigo}`;
  res.json({ siguiente: (memCajaCounters[key] || 0) + 1 });
});

router.post('/caja', auth, async (req, res) => {
  const { lote_id, lote_num, tipo_ganado, codigo, producto, kilos, fecha, romaneaje } = req.body;
  if (!lote_id || !lote_num || !codigo || kilos === undefined || kilos === null || kilos === '') {
    return res.status(400).json({ error: 'Faltan datos para registrar la caja' });
  }

  if (await dbOk()) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // INSERT IGNORE + UPDATE (nunca INSERT..ON DUPLICATE KEY) para que
      // LAST_INSERT_ID(actual+1) SIEMPRE se fije, incluso la primera caja
      // de un producto nuevo en el lote.
      await conn.query('INSERT IGNORE INTO contador_cajas (lote_id, codigo, actual) VALUES (?,?,0)', [lote_id, codigo]);
      await conn.query('UPDATE contador_cajas SET actual = LAST_INSERT_ID(actual + 1) WHERE lote_id=? AND codigo=?', [lote_id, codigo]);
      const [[{ caja }]] = await conn.query('SELECT LAST_INSERT_ID() AS caja');
      const barcode = buildBarcode({ codigo, lote: lote_num, caja, kilos });

      const [etRes] = await conn.query(
        `INSERT INTO etiquetas (lote_id, lote_num, codigo, producto, caja, kilos, barcode, fecha, romaneaje, usuario_id)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [lote_id, lote_num, codigo, producto, caja, kilos, barcode, fecha, romaneaje || null, req.user?.id || null]
      );
      const [enRes] = await conn.query(
        `INSERT INTO entradas (lote_id, lote_num, fecha, tipo_ganado, codigo, producto, cajas, kilos, caja, etiqueta_id)
         VALUES (?,?,?,?,?,?,1,?,?,?)`,
        [lote_id, lote_num, fecha, tipo_ganado, codigo, producto, kilos, caja, etRes.insertId]
      );
      await conn.commit();

      const [[entrada]]  = await conn.query('SELECT * FROM entradas WHERE id=?', [enRes.insertId]);
      const [[etiqueta]] = await conn.query('SELECT * FROM etiquetas WHERE id=?', [etRes.insertId]);
      const zpl = renderZplEtiqueta({ lote: lote_num, codigo, caja, kilos, producto, fecha, romaneaje });
      return res.json({ entrada, etiqueta, zpl });
    } catch (err) {
      await conn.rollback();
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Esta caja ya tiene una etiqueta registrada (posible duplicado)' });
      }
      console.error(err);
      return res.status(500).json({ error: 'No se pudo registrar la caja' });
    } finally {
      conn.release();
    }
  }

  // Fallback en memoria (sin DB disponible)
  const key = `${lote_id}:${codigo}`;
  const caja = (memCajaCounters[key] || 0) + 1;
  memCajaCounters[key] = caja;
  let barcode;
  try {
    barcode = buildBarcode({ codigo, lote: lote_num, caja, kilos });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const etiqueta = { id: etiquetaSeq++, lote_id, lote_num, tipo_ganado, codigo, producto, caja, kilos, barcode, fecha, romaneaje: romaneaje || null, activa: true, veces_impresa: 1 };
  memEtiquetas.push(etiqueta);
  const entrada = { id: entradaSeq++, lote_id, lote_num, fecha, tipo_ganado, codigo, producto, cajas: 1, kilos, caja, etiqueta_id: etiqueta.id };
  memEntradas.push(entrada);
  const zpl = renderZplEtiqueta({ lote: lote_num, codigo, caja, kilos, producto, fecha, romaneaje });
  res.json({ entrada, etiqueta, zpl });
});

/* ─── Escaneo de caja para Salidas: busca una etiqueta ya emitida por su
   código de barras y regresa lote, tipo de ganado, producto y kilos. ─── */
router.get('/buscar-etiqueta', auth, async (req, res) => {
  const { barcode } = req.query;
  if (!barcode) return res.status(400).json({ error: 'Falta el código de barras' });

  if (await dbOk()) {
    try {
      const [rows] = await pool.query(
        `SELECT et.*, en.tipo_ganado
         FROM etiquetas et
         LEFT JOIN entradas en ON en.etiqueta_id = et.id
         WHERE et.barcode = ?`,
        [barcode]
      );
      if (!rows.length) return res.status(404).json({ error: 'Caja no encontrada' });
      if (!rows[0].activa) return res.status(400).json({ error: 'Esta etiqueta fue anulada' });
      return res.json(rows[0]);
    } catch { /* fallback */ }
  }
  const etiqueta = memEtiquetas.find((e) => e.barcode === barcode);
  if (!etiqueta) return res.status(404).json({ error: 'Caja no encontrada' });
  if (!etiqueta.activa) return res.status(400).json({ error: 'Esta etiqueta fue anulada' });
  res.json(etiqueta);
});

router.getMemEntradas = () => memEntradas;
router.getMemEtiquetas = () => memEtiquetas;

module.exports = router;
