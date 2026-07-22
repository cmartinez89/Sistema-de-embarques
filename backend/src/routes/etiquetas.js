const router = require('express').Router();
const auth   = require('../middleware/auth');
const pool   = require('../db');
const { buildBarcode } = require('../lib/barcode');
const { renderZplEtiqueta } = require('../lib/zpl');
const { registrarBitacora } = require('../lib/bitacora');
const entradasRouter = require('./entradas');
const salidasRouter = require('./salidas');

async function dbOk() {
  try { await pool.query('SELECT 1'); return true; } catch { return false; }
}

// Herramienta manual/ad-hoc para regenerar un ZPL a mano (pruebas de impresora,
// casos fuera del flujo normal). El camino real de negocio para producto terminado
// es Entradas → POST /api/entradas/caja, que persiste la etiqueta en la tabla `etiquetas`.

// POST /api/etiquetas/zpl
router.post('/zpl', auth, (req, res) => {
  const { lote, codigo, caja, kilos, producto, fecha, romaneaje } = req.body;
  if (!lote || !codigo || !kilos) {
    return res.status(400).json({ error: 'Faltan datos para generar la etiqueta' });
  }
  const cajaNum = caja || 1;
  try {
    const zpl = renderZplEtiqueta({ lote, codigo, caja: cajaNum, kilos, producto, fecha, romaneaje });
    res.json({ zpl, barcode: buildBarcode({ codigo, lote, caja: cajaNum, kilos }) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/etiquetas/zpl-batch  (múltiples etiquetas)
router.post('/zpl-batch', auth, (req, res) => {
  const { etiquetas } = req.body;
  if (!Array.isArray(etiquetas) || !etiquetas.length) {
    return res.status(400).json({ error: 'Se requiere un arreglo de etiquetas' });
  }
  try {
    const zpl = etiquetas.map((e) => renderZplEtiqueta({ ...e, caja: e.caja || 1 })).join('\n');
    res.json({ zpl });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Buscar etiquetas ya emitidas (para el buscador por artículo/lote/caja).
// Se muestran siempre, hayan salido ya a un cliente o no — `embarcada`
// solo indica si ese código de barras ya aparece en alguna salida.
router.get('/', auth, async (req, res) => {
  const { codigo, lote, caja, estado } = req.query;

  if (await dbOk()) {
    try {
      let q = `SELECT et.*, EXISTS(SELECT 1 FROM salidas s WHERE s.barcode = et.barcode) AS embarcada
                FROM etiquetas et WHERE 1=1`;
      const p = [];
      if (codigo) { q += ' AND et.codigo=?';   p.push(codigo); }
      if (lote)   { q += ' AND et.lote_num=?'; p.push(lote); }
      if (caja)   { q += ' AND et.caja=?';     p.push(caja); }
      if (estado === 'activa')   q += ' AND et.activa=1';
      if (estado === 'eliminada') q += ' AND et.activa=0';
      q += ' ORDER BY et.created_at DESC LIMIT 300';
      const [rows] = await pool.query(q, p);
      return res.json(rows);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'No se pudo buscar etiquetas' });
    }
  }

  const memSalidas = salidasRouter.getMemSalidas();
  let rows = entradasRouter.getMemEtiquetas().map((e) => ({
    ...e,
    activa: e.activa ? 1 : 0,
    embarcada: memSalidas.some((s) => s.barcode === e.barcode),
  }));
  if (codigo) rows = rows.filter((e) => e.codigo === codigo);
  if (lote)   rows = rows.filter((e) => e.lote_num === lote);
  if (caja)   rows = rows.filter((e) => String(e.caja) === String(caja));
  if (estado === 'activa')   rows = rows.filter((e) => e.activa === 1);
  if (estado === 'eliminada') rows = rows.filter((e) => e.activa === 0);
  rows = rows.slice().reverse().slice(0, 300);
  res.json(rows);
});

// Elimina (anula) una etiqueta — no se borra físicamente, se marca inactiva
// para conservar el historial y que el código de barras no se pueda reusar.
router.delete('/:id', auth, async (req, res) => {
  const justificacion = (req.body?.justificacion || '').trim();
  if (!justificacion) {
    return res.status(400).json({ error: 'Se requiere una justificación para eliminar' });
  }

  if (await dbOk()) {
    const [rows] = await pool.query('SELECT * FROM etiquetas WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });

    await pool.query('UPDATE etiquetas SET activa=0 WHERE id=?', [req.params.id]);
    await registrarBitacora(pool, {
      usuario_id: req.user?.id,
      usuario_nombre: req.user?.usuario,
      accion: 'eliminar',
      tabla: 'etiquetas',
      registro_id: req.params.id,
      justificacion,
      datos_antes: rows[0],
    });
    return res.json({ ok: true });
  }

  const etiqueta = entradasRouter.getMemEtiquetas().find((e) => e.id === Number(req.params.id));
  if (!etiqueta) return res.status(404).json({ error: 'No encontrada' });
  const antes = { ...etiqueta };
  etiqueta.activa = false;
  await registrarBitacora(pool, {
    usuario_id: req.user?.id,
    usuario_nombre: req.user?.usuario,
    accion: 'eliminar',
    tabla: 'etiquetas',
    registro_id: req.params.id,
    justificacion,
    datos_antes: antes,
  });
  res.json({ ok: true });
});

// Reimprime una etiqueta ya emitida — regenera el ZPL a partir de los datos
// guardados y aumenta el contador de reimpresiones.
router.put('/:id/reimprimir', auth, async (req, res) => {
  if (await dbOk()) {
    const [rows] = await pool.query('SELECT * FROM etiquetas WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrada' });
    const etiqueta = rows[0];
    if (!etiqueta.activa) {
      return res.status(400).json({ error: 'Esta etiqueta fue eliminada, no se puede reimprimir' });
    }

    await pool.query('UPDATE etiquetas SET veces_impresa = veces_impresa + 1 WHERE id=?', [req.params.id]);
    const zpl = renderZplEtiqueta({
      lote: etiqueta.lote_num,
      codigo: etiqueta.codigo,
      caja: etiqueta.caja,
      kilos: etiqueta.kilos,
      producto: etiqueta.producto,
      fecha: etiqueta.fecha,
      romaneaje: etiqueta.romaneaje,
    });
    return res.json({ etiqueta: { ...etiqueta, veces_impresa: etiqueta.veces_impresa + 1 }, zpl });
  }

  const etiqueta = entradasRouter.getMemEtiquetas().find((e) => e.id === Number(req.params.id));
  if (!etiqueta) return res.status(404).json({ error: 'No encontrada' });
  if (!etiqueta.activa) {
    return res.status(400).json({ error: 'Esta etiqueta fue eliminada, no se puede reimprimir' });
  }
  etiqueta.veces_impresa += 1;
  const zpl = renderZplEtiqueta({
    lote: etiqueta.lote_num,
    codigo: etiqueta.codigo,
    caja: etiqueta.caja,
    kilos: etiqueta.kilos,
    producto: etiqueta.producto,
    fecha: etiqueta.fecha,
    romaneaje: etiqueta.romaneaje,
  });
  res.json({ etiqueta, zpl });
});

module.exports = router;
