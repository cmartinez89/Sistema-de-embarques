// Ejecutar UNA VEZ después de actualizar schema.sql (Fase 1 — trazabilidad):
//   node migrate.js
// Idempotente: seguro de correr varias veces. Verifica columnas vía
// information_schema porque MySQL/MariaDB en cPanel no soporta de forma
// confiable `ADD COLUMN IF NOT EXISTS`.

require('dotenv').config();
const pool = require('./src/db');

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].n > 0;
}

async function indexExists(table, indexName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return rows[0].n > 0;
}

async function tableExists(table) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows[0].n > 0;
}

async function columnNullable(table, column) {
  const [rows] = await pool.query(
    `SELECT IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0]?.IS_NULLABLE === 'YES';
}

async function main() {
  console.log('Conectando a la base de datos...');

  if (!(await columnExists('entradas', 'caja'))) {
    await pool.query('ALTER TABLE entradas ADD COLUMN caja INT NULL AFTER codigo');
    console.log('✓ entradas.caja agregada');
  } else {
    console.log('· entradas.caja ya existía');
  }

  if (!(await columnExists('entradas', 'etiqueta_id'))) {
    await pool.query('ALTER TABLE entradas ADD COLUMN etiqueta_id INT NULL AFTER caja');
    console.log('✓ entradas.etiqueta_id agregada');
  } else {
    console.log('· entradas.etiqueta_id ya existía');
  }

  if (!(await indexExists('entradas', 'idx_entradas_etiqueta_id'))) {
    await pool.query('ALTER TABLE entradas ADD INDEX idx_entradas_etiqueta_id (etiqueta_id)');
    console.log('✓ índice idx_entradas_etiqueta_id agregado');
  } else {
    console.log('· índice idx_entradas_etiqueta_id ya existía');
  }

  if (!(await columnExists('lotes', 'romaneaje_pdf'))) {
    await pool.query('ALTER TABLE lotes ADD COLUMN romaneaje_pdf VARCHAR(255) NULL AFTER romaneaje');
    console.log('✓ lotes.romaneaje_pdf agregada');
  } else {
    console.log('· lotes.romaneaje_pdf ya existía');
  }

  // Fase 3: bajas -> movimientos_inventario (renombra preservando los datos
  // existentes; si la base ya es nueva y nunca tuvo `bajas`, no hace nada).
  if ((await tableExists('bajas')) && !(await tableExists('movimientos_inventario'))) {
    await pool.query('RENAME TABLE bajas TO movimientos_inventario');
    console.log('✓ tabla bajas renombrada a movimientos_inventario');
  } else if (await tableExists('movimientos_inventario')) {
    console.log('· movimientos_inventario ya existía');
  } else {
    await pool.query(`
      CREATE TABLE movimientos_inventario (
        id                       INT AUTO_INCREMENT PRIMARY KEY,
        fecha                    DATE         NOT NULL,
        tipo_movimiento          ENUM('entrada','salida') NOT NULL DEFAULT 'salida',
        lote_num                 VARCHAR(50),
        codigo                   VARCHAR(20),
        producto                 VARCHAR(100),
        tipo_ganado              VARCHAR(50),
        cajas                    INT          DEFAULT 0,
        kilos                    DECIMAL(10,2) DEFAULT 0,
        motivo                   VARCHAR(50)  DEFAULT 'otro',
        observaciones            TEXT,
        estado                   ENUM('pendiente','autorizado','rechazado') NOT NULL DEFAULT 'pendiente',
        solicitado_por           INT,
        autorizado_por           INT,
        fecha_autorizacion       DATETIME,
        comentario_autorizacion  TEXT
      )
    `);
    console.log('✓ tabla movimientos_inventario creada');
  }

  const movCols = [
    ['tipo_movimiento', "ENUM('entrada','salida') NOT NULL DEFAULT 'salida' AFTER fecha"],
    ['estado', "ENUM('pendiente','autorizado','rechazado') NOT NULL DEFAULT 'autorizado' AFTER motivo"],
    ['solicitado_por', 'INT NULL'],
    ['autorizado_por', 'INT NULL'],
    ['fecha_autorizacion', 'DATETIME NULL'],
    ['comentario_autorizacion', 'TEXT NULL'],
  ];
  for (const [col, def] of movCols) {
    if (!(await columnExists('movimientos_inventario', col))) {
      await pool.query(`ALTER TABLE movimientos_inventario ADD COLUMN ${col} ${def}`);
      console.log(`✓ movimientos_inventario.${col} agregada`);
    } else {
      console.log(`· movimientos_inventario.${col} ya existía`);
    }
  }
  if (!(await columnExists('salidas', 'observaciones'))) {
    await pool.query('ALTER TABLE salidas ADD COLUMN observaciones TEXT NULL');
    console.log('✓ salidas.observaciones agregada');
  } else {
    console.log('· salidas.observaciones ya existía');
  }

  if (!(await columnExists('salidas', 'barcode'))) {
    await pool.query('ALTER TABLE salidas ADD COLUMN barcode VARCHAR(80) NULL AFTER kilos');
    console.log('✓ salidas.barcode agregada');
  } else {
    console.log('· salidas.barcode ya existía');
  }

  // Inventario inicial: cajas físicas preexistentes sin lote real capturado
  // en el sistema — su etiqueta necesita poder guardarse con lote_id NULL.
  if (!(await columnNullable('etiquetas', 'lote_id'))) {
    await pool.query('ALTER TABLE etiquetas MODIFY lote_id INT NULL');
    console.log('✓ etiquetas.lote_id ahora acepta NULL');
  } else {
    console.log('· etiquetas.lote_id ya aceptaba NULL');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bitacora (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id     INT,
      usuario_nombre VARCHAR(100),
      accion         VARCHAR(20)  NOT NULL,
      tabla          VARCHAR(50)  NOT NULL,
      registro_id    INT,
      justificacion  TEXT         NOT NULL,
      datos_antes    JSON,
      datos_despues  JSON,
      fecha          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);
  console.log('✓ tabla bitacora verificada');

  // Semilla del consecutivo de lote: continúa desde el último número real
  // ya capturado en producción (no reinicia en 1). INSERT IGNORE hace esto
  // seguro de correr muchas veces — solo siembra la primera vez.
  await pool.query(`
    INSERT IGNORE INTO contador_lotes (id, actual)
    SELECT 1, COALESCE(MAX(CAST(numero AS UNSIGNED)), 0) FROM lotes
  `);
  const [[{ actual }]] = await pool.query('SELECT actual FROM contador_lotes WHERE id=1');
  console.log(`✓ contador_lotes verificado (siguiente número de lote: ${actual + 1})`);

  console.log('\nMigración completada.');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
