const router       = require('express').Router();
const auth         = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const pool         = require('../db');

const TABLAS_AUDITADAS = ['canales', 'entradas', 'bajas'];
const ACCIONES = ['crear', 'editar', 'eliminar'];

function parseJson(value) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
}

router.get('/tablas', auth, requireAdmin, (_req, res) => res.json(TABLAS_AUDITADAS));
router.get('/acciones', auth, requireAdmin, (_req, res) => res.json(ACCIONES));

router.get('/', auth, requireAdmin, async (req, res) => {
  const { fecha_inicio, fecha_fin, tabla, accion, usuario } = req.query;
  try {
    let q = 'SELECT * FROM bitacora WHERE 1=1';
    const p = [];
    if (fecha_inicio) { q += ' AND DATE(fecha) >= ?'; p.push(fecha_inicio); }
    if (fecha_fin)    { q += ' AND DATE(fecha) <= ?'; p.push(fecha_fin); }
    if (tabla)        { q += ' AND tabla = ?'; p.push(tabla); }
    if (accion)       { q += ' AND accion = ?'; p.push(accion); }
    if (usuario)      { q += ' AND usuario_nombre LIKE ?'; p.push(`%${usuario}%`); }
    q += ' ORDER BY fecha DESC, id DESC LIMIT 500';

    const [rows] = await pool.query(q, p);
    const parsed = rows.map((r) => ({
      ...r,
      datos_antes: parseJson(r.datos_antes),
      datos_despues: parseJson(r.datos_despues),
    }));
    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo consultar la bitácora' });
  }
});

module.exports = router;
