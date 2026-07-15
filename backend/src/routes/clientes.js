const router = require('express').Router();
const auth   = require('../middleware/auth');
const pool   = require('../db');

let memClientes = [
  { id: 1, nombre: 'Distribuidora La Hacienda', rfc: 'DLH890412AB1', contacto: 'Juan Pérez',  telefono: '6671234567', activo: true },
  { id: 2, nombre: 'Carnicería El Corral',      rfc: 'CEC010101XY2', contacto: 'María López', telefono: '6679876543', activo: true },
  { id: 3, nombre: 'Supermercado Fresco',        rfc: 'SFR150630MN3', contacto: 'Carlos Ruiz', telefono: '6675554433', activo: true },
  { id: 4, nombre: 'Restaurantes del Norte',     rfc: 'RDN200101PQ4', contacto: 'Ana Torres',  telefono: '6673332211', activo: true },
];
let clienteSeq = 5;

async function dbOk() {
  try { await pool.query('SELECT 1'); return true; } catch { return false; }
}

router.get('/', auth, async (req, res) => {
  if (await dbOk()) {
    try {
      const [rows] = await pool.query('SELECT * FROM clientes ORDER BY activo DESC, nombre ASC');
      return res.json(rows);
    } catch { /* fallback */ }
  }
  res.json(memClientes.slice().sort((a, b) => b.activo - a.activo));
});

router.post('/', auth, async (req, res) => {
  const { nombre, rfc, contacto, telefono } = req.body;
  if (await dbOk()) {
    try {
      const [result] = await pool.query(
        'INSERT INTO clientes (nombre, rfc, contacto, telefono, activo) VALUES (?,?,?,?,1)',
        [nombre, rfc, contacto, telefono]
      );
      const [rows] = await pool.query('SELECT * FROM clientes WHERE id = ?', [result.insertId]);
      return res.json(rows[0]);
    } catch { /* fallback */ }
  }
  const c = { id: clienteSeq++, nombre, rfc, contacto, telefono, activo: true };
  memClientes.push(c);
  res.json(c);
});

router.put('/:id', auth, async (req, res) => {
  const { nombre, rfc, contacto, telefono, activo } = req.body;
  const { id } = req.params;
  if (await dbOk()) {
    try {
      await pool.query(
        'UPDATE clientes SET nombre=?, rfc=?, contacto=?, telefono=?, activo=? WHERE id=?',
        [nombre, rfc, contacto, telefono, activo ? 1 : 0, id]
      );
      const [rows] = await pool.query('SELECT * FROM clientes WHERE id=?', [id]);
      return res.json(rows[0]);
    } catch { /* fallback */ }
  }
  const idx = memClientes.findIndex(c => c.id === Number(id));
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  memClientes[idx] = { ...memClientes[idx], nombre, rfc, contacto, telefono, activo };
  res.json(memClientes[idx]);
});

router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;
  if (await dbOk()) {
    try {
      await pool.query('UPDATE clientes SET activo=0 WHERE id=?', [id]);
      return res.json({ ok: true });
    } catch { /* fallback */ }
  }
  const c = memClientes.find(c => c.id === Number(id));
  if (c) c.activo = false;
  res.json({ ok: true });
});

module.exports = router;
