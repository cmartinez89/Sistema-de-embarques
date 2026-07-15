const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../db');

const DEMO_USERS = [
  { id: 1, usuario: 'admin',     password: 'admin123',     nombre: 'Administrador', rol: 'admin'    },
  { id: 2, usuario: 'embarques', password: 'embarques123', nombre: 'Op. Embarques', rol: 'operador' },
];

const makeToken = (user) =>
  jwt.sign(
    { id: user.id, usuario: user.usuario, rol: user.rol },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: '10h' }
  );

async function dbOk() {
  try { await pool.query('SELECT 1'); return true; } catch { return false; }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password)
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

  try {
    if (await dbOk()) {
      const [rows] = await pool.query(
        'SELECT * FROM usuarios WHERE usuario = ? AND activo = 1',
        [usuario]
      );
      if (rows.length > 0) {
        const user  = rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });
        return res.json({
          token: makeToken(user),
          user: { id: user.id, usuario: user.usuario, nombre: user.nombre, rol: user.rol },
        });
      }
    }
  } catch { /* DB no disponible */ }

  // Fallback demo
  const demo = DEMO_USERS.find((u) => u.usuario === usuario && u.password === password);
  if (!demo) return res.status(401).json({ error: 'Credenciales inválidas' });
  res.json({
    token: makeToken(demo),
    user: { id: demo.id, usuario: demo.usuario, nombre: demo.nombre, rol: demo.rol },
  });
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    if (await dbOk()) {
      const [rows] = await pool.query(
        'SELECT id, usuario, nombre, rol FROM usuarios WHERE id = ?',
        [req.user.id]
      );
      if (rows.length > 0) return res.json(rows[0]);
    }
  } catch { /* DB no disponible */ }

  const demo = DEMO_USERS.find((u) => u.id === req.user.id);
  if (demo) return res.json({ id: demo.id, usuario: demo.usuario, nombre: demo.nombre, rol: demo.rol });
  res.status(404).json({ error: 'Usuario no encontrado' });
});

module.exports = router;
