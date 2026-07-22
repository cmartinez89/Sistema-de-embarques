const router = require('express').Router();
const auth   = require('../middleware/auth');
const pool   = require('../db');
const { registrarBitacora } = require('../lib/bitacora');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const TIPOS_GANADO = ['De Procarne', 'San Carlos', 'Engorda', 'Corriente'];

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'romaneajes');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const uploadPdf = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, `lote-${req.params.id}-${Date.now()}.pdf`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Solo se permiten archivos PDF'));
    cb(null, true);
  },
});

let memLotes      = [];
let memCanales     = [];
let loteSeq        = 1;
let canalSeq       = 1;
let memLoteNumero  = 0;

async function dbOk() {
  try { await pool.query('SELECT 1'); return true; } catch { return false; }
}

function calcularPesoFrio(item) {
  const tipo = item.tipo === 'medios' ? 'medios' : 'cuartos';
  const medio_1 = Number(item.medio_1) || 0;
  const medio_2 = Number(item.medio_2) || 0;
  const cuarto_1 = Number(item.cuarto_1) || 0;
  const cuarto_2 = Number(item.cuarto_2) || 0;
  const cuarto_3 = Number(item.cuarto_3) || 0;
  const cuarto_4 = Number(item.cuarto_4) || 0;
  const peso_frio = tipo === 'medios' ? (medio_1 + medio_2) : (cuarto_1 + cuarto_2 + cuarto_3 + cuarto_4);
  const peso_caliente = Number(item.peso_caliente) || 0;
  const diferencia_pct = peso_caliente
    ? Math.round(((peso_caliente - peso_frio) / peso_caliente) * 10000) / 100
    : 0;
  return { tipo, medio_1, medio_2, cuarto_1, cuarto_2, cuarto_3, cuarto_4, peso_caliente, peso_frio, diferencia_pct };
}

/* ─── LOTES ─── */

router.get('/lotes', auth, async (req, res) => {
  if (await dbOk()) {
    const [rows] = await pool.query(`
      SELECT l.*,
        COUNT(c.id) AS num_canales,
        COALESCE(SUM(c.peso_caliente),0) AS peso_caliente_total,
        COALESCE(SUM(c.peso_frio),0) AS peso_frio_total
      FROM lotes l
      LEFT JOIN canales c ON c.lote_id = l.id
      GROUP BY l.id
      ORDER BY l.fecha DESC, l.id DESC
    `);
    return res.json(rows);
  }
  const rows = memLotes.slice().reverse().map((l) => {
    const canales = memCanales.filter((c) => String(c.lote_id) === String(l.id));
    return {
      ...l,
      num_canales: canales.length,
      peso_caliente_total: canales.reduce((s, c) => s + (Number(c.peso_caliente) || 0), 0),
      peso_frio_total: canales.reduce((s, c) => s + (Number(c.peso_frio) || 0), 0),
    };
  });
  res.json(rows);
});

router.get('/lotes/siguiente-numero', auth, async (req, res) => {
  if (await dbOk()) {
    const [rows] = await pool.query('SELECT actual FROM contador_lotes WHERE id = 1');
    return res.json({ siguiente: (rows[0]?.actual || 0) + 1 });
  }
  res.json({ siguiente: memLoteNumero + 1 });
});

router.get('/lotes/:id', auth, async (req, res) => {
  if (await dbOk()) {
    const [rows] = await pool.query('SELECT * FROM lotes WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Lote no encontrado' });
    return res.json(rows[0]);
  }
  const lote = memLotes.find((l) => String(l.id) === String(req.params.id));
  if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
  res.json(lote);
});

router.post('/lotes/:id/romaneaje-pdf', auth, (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: 'Id de lote inválido' });

  uploadPdf.single('pdf')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message || 'No se pudo subir el archivo' });
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

    if (await dbOk()) {
      const [rows] = await pool.query('SELECT romaneaje_pdf FROM lotes WHERE id = ?', [req.params.id]);
      if (!rows.length) {
        fs.unlink(req.file.path, () => {});
        return res.status(404).json({ error: 'Lote no encontrado' });
      }
      if (rows[0].romaneaje_pdf) {
        fs.unlink(path.join(UPLOAD_DIR, rows[0].romaneaje_pdf), () => {});
      }
      await pool.query('UPDATE lotes SET romaneaje_pdf = ? WHERE id = ?', [req.file.filename, req.params.id]);
      return res.json({ ok: true, romaneaje_pdf: req.file.filename });
    }

    const lote = memLotes.find((l) => String(l.id) === String(req.params.id));
    if (!lote) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Lote no encontrado' });
    }
    lote.romaneaje_pdf = req.file.filename;
    res.json({ ok: true, romaneaje_pdf: req.file.filename });
  });
});

router.get('/lotes/:id/romaneaje-pdf', auth, async (req, res) => {
  let filename;
  if (await dbOk()) {
    const [rows] = await pool.query('SELECT romaneaje_pdf FROM lotes WHERE id = ?', [req.params.id]);
    filename = rows[0]?.romaneaje_pdf;
  } else {
    filename = memLotes.find((l) => String(l.id) === String(req.params.id))?.romaneaje_pdf;
  }
  if (!filename) return res.status(404).json({ error: 'Este lote no tiene PDF de romaneaje' });
  const filePath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado en el servidor' });
  res.setHeader('Content-Type', 'application/pdf');
  res.sendFile(filePath);
});

router.post('/lotes', auth, async (req, res) => {
  const { fecha, fecha_sacrificio, tipo_ganado, romaneaje, observaciones } = req.body;

  if (await dbOk()) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // INSERT IGNORE + UPDATE (nunca INSERT..ON DUPLICATE KEY) para que
      // LAST_INSERT_ID(actual+1) SIEMPRE se fije, incluso la primera vez
      // que se usa el contador (si fuera INSERT..ON DUPLICATE KEY, la
      // primera inserción no dispara la rama UPDATE y LAST_INSERT_ID
      // queda en 0).
      await conn.query('INSERT IGNORE INTO contador_lotes (id, actual) VALUES (1, 0)');
      await conn.query('UPDATE contador_lotes SET actual = LAST_INSERT_ID(actual + 1) WHERE id = 1');
      const [[{ numero }]] = await conn.query('SELECT LAST_INSERT_ID() AS numero');
      const [result] = await conn.query(
        'INSERT INTO lotes (numero, fecha, fecha_sacrificio, tipo_ganado, romaneaje, observaciones) VALUES (?,?,?,?,?,?)',
        [String(numero), fecha, fecha_sacrificio, tipo_ganado, romaneaje, observaciones]
      );
      await conn.commit();
      const [rows] = await conn.query('SELECT * FROM lotes WHERE id = ?', [result.insertId]);
      return res.json(rows[0]);
    } catch (err) {
      await conn.rollback();
      console.error(err);
      return res.status(500).json({ error: 'No se pudo registrar el lote' });
    } finally {
      conn.release();
    }
  }

  memLoteNumero += 1;
  const lote = { id: loteSeq++, numero: String(memLoteNumero), fecha, fecha_sacrificio, tipo_ganado, romaneaje, observaciones };
  memLotes.push(lote);
  res.json(lote);
});

/* ─── CANALES ─── */

router.get('/', auth, async (req, res) => {
  const { lote_id } = req.query;
  if (await dbOk()) {
    const [rows] = await pool.query(
      'SELECT * FROM canales WHERE lote_id = ? ORDER BY consecutivo',
      [lote_id]
    );
    return res.json(rows);
  }
  res.json(memCanales.filter(c => String(c.lote_id) === String(lote_id)));
});

router.post('/', auth, async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const saved = [];

  if (await dbOk()) {
    for (const item of items) {
      const calc = calcularPesoFrio(item);
      const [result] = await pool.query(
        `INSERT INTO canales
         (lote_id, consecutivo, tipo, peso_caliente, peso_frio, diferencia_pct,
          medio_1, medio_2, cuarto_1, cuarto_2, cuarto_3, cuarto_4, fecha, observaciones)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [item.lote_id, item.consecutivo, calc.tipo, calc.peso_caliente, calc.peso_frio, calc.diferencia_pct,
         calc.medio_1, calc.medio_2, calc.cuarto_1, calc.cuarto_2, calc.cuarto_3, calc.cuarto_4,
         item.fecha, item.observaciones || '']
      );
      const [rows] = await pool.query('SELECT * FROM canales WHERE id = ?', [result.insertId]);
      saved.push(rows[0]);
    }
    return res.json(saved);
  }

  for (const item of items) {
    const calc = calcularPesoFrio(item);
    const rec = { id: canalSeq++, ...item, ...calc };
    memCanales.push(rec);
    saved.push(rec);
  }
  res.json(saved);
});

router.put('/:id', auth, async (req, res) => {
  const justificacion = (req.body?.justificacion || '').trim();
  if (!justificacion) {
    return res.status(400).json({ error: 'Se requiere una justificación para editar' });
  }
  const calc = calcularPesoFrio(req.body);
  const observaciones = req.body.observaciones || '';

  if (await dbOk()) {
    const [rows] = await pool.query('SELECT * FROM canales WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });

    await pool.query(
      `UPDATE canales SET tipo=?, peso_caliente=?, peso_frio=?, diferencia_pct=?,
       medio_1=?, medio_2=?, cuarto_1=?, cuarto_2=?, cuarto_3=?, cuarto_4=?, observaciones=?
       WHERE id=?`,
      [calc.tipo, calc.peso_caliente, calc.peso_frio, calc.diferencia_pct,
       calc.medio_1, calc.medio_2, calc.cuarto_1, calc.cuarto_2, calc.cuarto_3, calc.cuarto_4,
       observaciones, req.params.id]
    );
    const [rows2] = await pool.query('SELECT * FROM canales WHERE id = ?', [req.params.id]);
    await registrarBitacora(pool, {
      usuario_id: req.user?.id,
      usuario_nombre: req.user?.usuario,
      accion: 'editar',
      tabla: 'canales',
      registro_id: req.params.id,
      justificacion,
      datos_antes: rows[0],
      datos_despues: rows2[0],
    });
    return res.json(rows2[0]);
  }

  const idx = memCanales.findIndex(c => c.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  const antes = memCanales[idx];
  memCanales[idx] = { ...memCanales[idx], ...calc, observaciones };
  await registrarBitacora(pool, {
    usuario_id: req.user?.id,
    usuario_nombre: req.user?.usuario,
    accion: 'editar',
    tabla: 'canales',
    registro_id: req.params.id,
    justificacion,
    datos_antes: antes,
    datos_despues: memCanales[idx],
  });
  res.json(memCanales[idx]);
});

router.delete('/:id', auth, async (req, res) => {
  const justificacion = (req.body?.justificacion || '').trim();
  if (!justificacion) {
    return res.status(400).json({ error: 'Se requiere una justificación para eliminar' });
  }

  if (await dbOk()) {
    const [rows] = await pool.query('SELECT * FROM canales WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });

    await pool.query('DELETE FROM canales WHERE id = ?', [req.params.id]);
    await registrarBitacora(pool, {
      usuario_id: req.user?.id,
      usuario_nombre: req.user?.usuario,
      accion: 'eliminar',
      tabla: 'canales',
      registro_id: req.params.id,
      justificacion,
      datos_antes: rows[0],
    });
    return res.json({ ok: true });
  }

  const idx = memCanales.findIndex(c => c.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  const [eliminado] = memCanales.splice(idx, 1);
  await registrarBitacora(pool, {
    usuario_id: req.user?.id,
    usuario_nombre: req.user?.usuario,
    accion: 'eliminar',
    tabla: 'canales',
    registro_id: req.params.id,
    justificacion,
    datos_antes: eliminado,
  });
  res.json({ ok: true });
});

router.get('/tipos-ganado', auth, (_req, res) => res.json(TIPOS_GANADO));

router.getMemLotes = () => memLotes;
router.getMemCanales = () => memCanales;

module.exports = router;
