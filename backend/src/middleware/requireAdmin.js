// Usar después de `auth` — requiere que req.user ya esté poblado.
module.exports = (req, res, next) => {
  if (req.user?.rol !== 'admin') {
    return res.status(403).json({ error: 'Solo el administrador puede acceder a esto' });
  }
  next();
};
