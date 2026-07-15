const router = require('express').Router();
const auth   = require('../middleware/auth');
const pool   = require('../db');

const TIPOS = ['Ambos', 'De Procarne', 'San Carlos', 'Engorda', 'Corriente'];

const MEM_DEFAULT = [
  { id: 1,  codigo: '101', nombre: 'Lomo completo',        tipo_ganado: 'Ambos',       activo: true },
  { id: 2,  codigo: '102', nombre: 'Lomo fino',            tipo_ganado: 'Ambos',       activo: true },
  { id: 3,  codigo: '103', nombre: 'Costilla cargada',     tipo_ganado: 'Ambos',       activo: true },
  { id: 4,  codigo: '104', nombre: 'Costilla corta',       tipo_ganado: 'Ambos',       activo: true },
  { id: 5,  codigo: '105', nombre: 'Espaldilla completa',  tipo_ganado: 'Ambos',       activo: true },
  { id: 6,  codigo: '106', nombre: 'Chambarete delantero', tipo_ganado: 'Ambos',       activo: true },
  { id: 7,  codigo: '107', nombre: 'Chambarete trasero',   tipo_ganado: 'Ambos',       activo: true },
  { id: 8,  codigo: '108', nombre: 'Pierna completa',      tipo_ganado: 'Ambos',       activo: true },
  { id: 9,  codigo: '109', nombre: 'Bola de pierna',       tipo_ganado: 'Ambos',       activo: true },
  { id: 10, codigo: '110', nombre: 'Cuete',                tipo_ganado: 'Ambos',       activo: true },
  { id: 11, codigo: '111', nombre: 'Pulpa negra',          tipo_ganado: 'Ambos',       activo: true },
  { id: 12, codigo: '112', nombre: 'Paleta completa',      tipo_ganado: 'Ambos',       activo: true },
  { id: 13, codigo: '113', nombre: 'Pescuezo',             tipo_ganado: 'Ambos',       activo: true },
  { id: 14, codigo: '114', nombre: 'Falda',                tipo_ganado: 'Ambos',       activo: true },
  { id: 15, codigo: '115', nombre: 'Vísceras',             tipo_ganado: 'Ambos',       activo: true },
  { id: 16, codigo: '591', nombre: 'Corte especial 591',   tipo_ganado: 'De Procarne', activo: true },
];

let memProductos = [...MEM_DEFAULT];
let seq = MEM_DEFAULT.length + 1;

async function dbOk() {
  try { await pool.query('SELECT 1'); return true; } catch { return false; }
}

router.get('/', auth, async (req, res) => {
  if (await dbOk()) {
    try {
      const [rows] = await pool.query('SELECT * FROM productos ORDER BY codigo');
      if (rows.length) return res.json(rows);
    } catch { /* tabla no existe */ }
  }
  res.json(memProductos);
});

router.get('/tipos-ganado', auth, (_req, res) => res.json(TIPOS));

router.post('/', auth, async (req, res) => {
  const { codigo, nombre, tipo_ganado } = req.body;
  if (!codigo || !nombre) return res.status(400).json({ error: 'codigo y nombre son requeridos' });

  if (await dbOk()) {
    try {
      const [result] = await pool.query(
        'INSERT INTO productos (codigo, nombre, tipo_ganado, activo) VALUES (?,?,?,1)',
        [codigo, nombre, tipo_ganado || 'Ambos']
      );
      const [rows] = await pool.query('SELECT * FROM productos WHERE id=?', [result.insertId]);
      return res.json(rows[0]);
    } catch { /* fallback */ }
  }

  const prod = { id: seq++, codigo, nombre, tipo_ganado: tipo_ganado || 'Ambos', activo: true };
  memProductos.push(prod);
  res.json(prod);
});

router.put('/:id', auth, async (req, res) => {
  const { codigo, nombre, tipo_ganado, activo } = req.body;

  if (await dbOk()) {
    try {
      await pool.query(
        'UPDATE productos SET codigo=?, nombre=?, tipo_ganado=?, activo=? WHERE id=?',
        [codigo, nombre, tipo_ganado, activo !== undefined ? (activo ? 1 : 0) : 1, req.params.id]
      );
      const [rows] = await pool.query('SELECT * FROM productos WHERE id=?', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
      return res.json(rows[0]);
    } catch { /* fallback */ }
  }

  const idx = memProductos.findIndex(p => p.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  memProductos[idx] = { ...memProductos[idx], codigo, nombre, tipo_ganado, activo };
  res.json(memProductos[idx]);
});

router.delete('/:id', auth, async (req, res) => {
  if (await dbOk()) {
    try {
      await pool.query('UPDATE productos SET activo=0 WHERE id=?', [req.params.id]);
      return res.json({ ok: true });
    } catch { /* fallback */ }
  }
  const idx = memProductos.findIndex(p => p.id === Number(req.params.id));
  if (idx !== -1) memProductos[idx].activo = false;
  res.json({ ok: true });
});

module.exports = router;
