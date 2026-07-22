const router = require('express').Router();
const auth   = require('../middleware/auth');
const pool   = require('../db');
const entradasRouter = require('./entradas');
const salidasRouter = require('./salidas');
const movimientosRouter = require('./movimientos');
const canalesRouter = require('./canales');
const existenciasRouter = require('./existencias');

async function dbOk() {
  try { await pool.query('SELECT 1'); return true; } catch { return false; }
}

function enRango(fecha, fecha_inicio, fecha_fin) {
  if (fecha_inicio && fecha < fecha_inicio) return false;
  if (fecha_fin && fecha > fecha_fin) return false;
  return true;
}

router.get('/entradas', auth, async (req, res) => {
  const { fecha_inicio, fecha_fin, lote_num, agrupado } = req.query;
  if (await dbOk()) {
    try {
      const p = [];
      let q;
      if (agrupado) {
        q = `SELECT codigo, producto, tipo_ganado,
               SUM(cajas) AS total_cajas,
               SUM(kilos) AS total_kilos,
               GROUP_CONCAT(caja ORDER BY caja SEPARATOR ', ') AS cajas_lista
             FROM entradas WHERE 1=1`;
      } else {
        q = 'SELECT * FROM entradas WHERE 1=1';
      }
      if (fecha_inicio) { q += ' AND fecha>=?';    p.push(fecha_inicio); }
      if (fecha_fin)    { q += ' AND fecha<=?';    p.push(fecha_fin); }
      if (lote_num)     { q += ' AND lote_num=?';  p.push(lote_num); }
      q += agrupado ? ' GROUP BY codigo, producto, tipo_ganado ORDER BY producto' : ' ORDER BY fecha, lote_num, codigo';
      const [rows] = await pool.query(q, p);
      return res.json(rows);
    } catch { /* fallback */ }
  }

  let rows = entradasRouter.getMemEntradas().filter((e) => enRango(e.fecha, fecha_inicio, fecha_fin));
  if (lote_num) rows = rows.filter((e) => e.lote_num === lote_num);
  if (agrupado) {
    const grupos = new Map();
    for (const e of rows) {
      const key = `${e.codigo}|${e.tipo_ganado || ''}`;
      if (!grupos.has(key)) {
        grupos.set(key, { codigo: e.codigo, producto: e.producto, tipo_ganado: e.tipo_ganado, total_cajas: 0, total_kilos: 0, cajasVistas: [] });
      }
      const g = grupos.get(key);
      g.total_cajas += Number(e.cajas || 0);
      g.total_kilos += Number(e.kilos || 0);
      if (e.caja != null) g.cajasVistas.push(e.caja);
    }
    const result = [...grupos.values()]
      .sort((a, b) => (a.producto || '').localeCompare(b.producto || ''))
      .map((g) => ({ ...g, cajas_lista: g.cajasVistas.sort((a, b) => a - b).join(', ') }));
    return res.json(result);
  }
  rows = rows.slice().sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.lote_num).localeCompare(String(b.lote_num)) || a.codigo.localeCompare(b.codigo));
  res.json(rows);
});

router.get('/salidas', auth, async (req, res) => {
  const { fecha_inicio, fecha_fin, cliente_id, agrupado } = req.query;
  if (await dbOk()) {
    try {
      const p = [];
      let q;
      if (agrupado) {
        q = `SELECT codigo, producto, tipo_ganado,
               SUM(cajas) AS total_cajas,
               SUM(kilos) AS total_kilos,
               COUNT(*) AS num_registros
             FROM salidas WHERE 1=1`;
      } else {
        q = 'SELECT * FROM salidas WHERE 1=1';
      }
      if (fecha_inicio) { q += ' AND fecha>=?';      p.push(fecha_inicio); }
      if (fecha_fin)    { q += ' AND fecha<=?';      p.push(fecha_fin); }
      if (cliente_id)   { q += ' AND cliente_id=?';  p.push(cliente_id); }
      q += agrupado ? ' GROUP BY codigo, producto, tipo_ganado ORDER BY producto' : ' ORDER BY folio, fecha';
      const [rows] = await pool.query(q, p);
      return res.json(rows);
    } catch { /* fallback */ }
  }

  let rows = salidasRouter.getMemSalidas().filter((s) => enRango(s.fecha, fecha_inicio, fecha_fin));
  if (cliente_id) rows = rows.filter((s) => String(s.cliente_id) === String(cliente_id));
  if (agrupado) {
    const grupos = new Map();
    for (const s of rows) {
      const key = `${s.codigo}|${s.tipo_ganado || ''}`;
      if (!grupos.has(key)) {
        grupos.set(key, { codigo: s.codigo, producto: s.producto, tipo_ganado: s.tipo_ganado, total_cajas: 0, total_kilos: 0, num_registros: 0 });
      }
      const g = grupos.get(key);
      g.total_cajas += Number(s.cajas || 0);
      g.total_kilos += Number(s.kilos || 0);
      g.num_registros += 1;
    }
    return res.json([...grupos.values()].sort((a, b) => (a.producto || '').localeCompare(b.producto || '')));
  }
  rows = rows.slice().sort((a, b) => Number(a.folio) - Number(b.folio) || a.fecha.localeCompare(b.fecha));
  res.json(rows);
});

router.get('/movimientos', auth, async (req, res) => {
  const { fecha_inicio, fecha_fin, estado, tipo_movimiento } = req.query;
  if (await dbOk()) {
    try {
      let q = 'SELECT * FROM movimientos_inventario WHERE 1=1';
      const p = [];
      if (fecha_inicio)    { q += ' AND fecha>=?';          p.push(fecha_inicio); }
      if (fecha_fin)       { q += ' AND fecha<=?';          p.push(fecha_fin); }
      if (estado)          { q += ' AND estado=?';          p.push(estado); }
      if (tipo_movimiento) { q += ' AND tipo_movimiento=?'; p.push(tipo_movimiento); }
      q += ' ORDER BY fecha DESC, id DESC';
      const [rows] = await pool.query(q, p);
      return res.json(rows);
    } catch { /* fallback */ }
  }

  let rows = movimientosRouter.getMemMovimientos().filter((m) => enRango(m.fecha, fecha_inicio, fecha_fin));
  if (estado)          rows = rows.filter((m) => m.estado === estado);
  if (tipo_movimiento) rows = rows.filter((m) => m.tipo_movimiento === tipo_movimiento);
  rows = rows.slice().sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  res.json(rows);
});

// Los movimientos de inventario solo cuentan una vez autorizados; el neto
// suma si tipo_movimiento='entrada' y resta si tipo_movimiento='salida'.
// `fecha` opcional -> existencia histórica a esa fecha; sin ella, actual.
router.get('/existencias', auth, async (req, res) => {
  const limite = req.query.fecha || '9999-12-31';
  if (await dbOk()) {
    try {
      const [rows] = await pool.query(`
        SELECT
          e.codigo,
          e.producto,
          e.tipo_ganado,
          SUM(e.cajas)
            - COALESCE((SELECT SUM(s.cajas) FROM salidas s WHERE s.codigo=e.codigo AND s.tipo_ganado<=>e.tipo_ganado AND s.fecha<=?),0)
            + COALESCE((SELECT SUM(CASE WHEN m.tipo_movimiento='entrada' THEN m.cajas ELSE -m.cajas END)
                        FROM movimientos_inventario m
                        WHERE m.codigo=e.codigo AND m.tipo_ganado<=>e.tipo_ganado AND m.estado='autorizado' AND m.fecha<=?),0) AS cajas_existentes,
          SUM(e.kilos)
            - COALESCE((SELECT SUM(s.kilos) FROM salidas s WHERE s.codigo=e.codigo AND s.tipo_ganado<=>e.tipo_ganado AND s.fecha<=?),0)
            + COALESCE((SELECT SUM(CASE WHEN m.tipo_movimiento='entrada' THEN m.kilos ELSE -m.kilos END)
                        FROM movimientos_inventario m
                        WHERE m.codigo=e.codigo AND m.tipo_ganado<=>e.tipo_ganado AND m.estado='autorizado' AND m.fecha<=?),0) AS kilos_existentes
        FROM entradas e
        WHERE e.fecha <= ?
        GROUP BY e.codigo, e.producto, e.tipo_ganado
        HAVING
          SUM(e.cajas)
            - COALESCE((SELECT SUM(s.cajas) FROM salidas s WHERE s.codigo=e.codigo AND s.tipo_ganado<=>e.tipo_ganado AND s.fecha<=?),0)
            + COALESCE((SELECT SUM(CASE WHEN m.tipo_movimiento='entrada' THEN m.cajas ELSE -m.cajas END)
                        FROM movimientos_inventario m
                        WHERE m.codigo=e.codigo AND m.tipo_ganado<=>e.tipo_ganado AND m.estado='autorizado' AND m.fecha<=?),0) > 0
        ORDER BY e.tipo_ganado, e.codigo
      `, Array(7).fill(limite));
      return res.json(rows);
    } catch { /* fallback */ }
  }
  res.json(existenciasRouter.calcularExistenciasMemoria(limite));
});

router.get('/canales', auth, async (req, res) => {
  const { lote_num } = req.query;
  if (await dbOk()) {
    try {
      let q = `
        SELECT c.*, l.numero AS lote_numero, l.tipo_ganado, l.romaneaje, l.observaciones AS lote_observaciones
        FROM canales c
        JOIN lotes l ON l.id = c.lote_id
        WHERE 1=1
      `;
      const p = [];
      if (lote_num) { q += ' AND l.numero=?'; p.push(lote_num); }
      q += ' ORDER BY l.numero, c.consecutivo';
      const [rows] = await pool.query(q, p);
      return res.json(rows);
    } catch { /* fallback */ }
  }

  const lotes = canalesRouter.getMemLotes();
  let rows = canalesRouter.getMemCanales().map((c) => {
    const lote = lotes.find((l) => String(l.id) === String(c.lote_id));
    return {
      ...c,
      lote_numero: lote?.numero,
      tipo_ganado: lote?.tipo_ganado,
      romaneaje: lote?.romaneaje,
      lote_observaciones: lote?.observaciones,
    };
  });
  if (lote_num) rows = rows.filter((c) => String(c.lote_numero) === String(lote_num));
  rows = rows.slice().sort((a, b) => String(a.lote_numero).localeCompare(String(b.lote_numero), undefined, { numeric: true }) || a.consecutivo - b.consecutivo);
  res.json(rows);
});

module.exports = router;
