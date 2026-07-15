// Ejecutar UNA VEZ después de crear las tablas:
//   node setup.js
// Crea el usuario admin y carga el catálogo de productos iniciales.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool   = require('./src/db');

const PRODUCTOS = [
  ['101', 'Lomo completo',        'Ambos'],
  ['102', 'Lomo fino',            'Ambos'],
  ['103', 'Costilla cargada',     'Ambos'],
  ['104', 'Costilla corta',       'Ambos'],
  ['105', 'Espaldilla completa',  'Ambos'],
  ['106', 'Chambarete delantero', 'Ambos'],
  ['107', 'Chambarete trasero',   'Ambos'],
  ['108', 'Pierna completa',      'Ambos'],
  ['109', 'Bola de pierna',       'Ambos'],
  ['110', 'Cuete',                'Ambos'],
  ['111', 'Pulpa negra',          'Ambos'],
  ['112', 'Paleta completa',      'Ambos'],
  ['113', 'Pescuezo',             'Ambos'],
  ['114', 'Falda',                'Ambos'],
  ['115', 'Vísceras',             'Ambos'],
  ['591', 'Corte especial 591',   'De Procarne'],
];

async function main() {
  console.log('Conectando a la base de datos...');

  // Usuario admin
  const hash = await bcrypt.hash('admin123', 10);
  await pool.query(
    `INSERT INTO usuarios (usuario, password_hash, nombre, rol, activo)
     VALUES ('admin', ?, 'Administrador', 'admin', 1)
     ON DUPLICATE KEY UPDATE usuario=usuario`,
    [hash]
  );
  console.log('✓ Usuario admin creado (password: admin123)');

  // Usuario operador
  const hash2 = await bcrypt.hash('embarques123', 10);
  await pool.query(
    `INSERT INTO usuarios (usuario, password_hash, nombre, rol, activo)
     VALUES ('embarques', ?, 'Op. Embarques', 'operador', 1)
     ON DUPLICATE KEY UPDATE usuario=usuario`,
    [hash2]
  );
  console.log('✓ Usuario embarques creado (password: embarques123)');

  // Catálogo de productos
  for (const [codigo, nombre, tipo_ganado] of PRODUCTOS) {
    await pool.query(
      `INSERT INTO productos (codigo, nombre, tipo_ganado, activo)
       VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE codigo=codigo`,
      [codigo, nombre, tipo_ganado]
    );
  }
  console.log('✓ Catálogo de productos cargado');

  console.log('\nSetup completado. Ya puedes iniciar el servidor con: npm start');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
