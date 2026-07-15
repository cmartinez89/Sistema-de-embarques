require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// Sirve el build de React (frontend/dist copiado a public/)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Rutas API
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/canales',     require('./routes/canales'));
app.use('/api/entradas',    require('./routes/entradas'));
app.use('/api/etiquetas',   require('./routes/etiquetas'));
app.use('/api/clientes',    require('./routes/clientes'));
app.use('/api/productos',   require('./routes/productos'));
app.use('/api/salidas',     require('./routes/salidas'));
app.use('/api/existencias', require('./routes/existencias'));
app.use('/api/movimientos', require('./routes/movimientos'));
app.use('/api/reportes',    require('./routes/reportes'));
app.use('/api/bitacora',    require('./routes/bitacora'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));

// SPA fallback — todas las rutas no-API sirven index.html
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
