const router = require('express').Router();
const auth   = require('../middleware/auth');
const pool   = require('../db');
const entradasRouter = require('./entradas');
const salidasRouter = require('./salidas');
const movimientosRouter = require('./movimientos');

async function dbOk() {
  try { await pool.query('SELECT 1'); return true; } catch { return false; }
}

// Normaliza tipo_ganado para agrupar/comparar de forma consistente sin
// importar si viene como null, undefined o '' (todo lo desconocido cae en
// el mismo grupo "SIN DATO", igual que <=> en SQL trata NULL <=> NULL como
// verdadero).
function tg(valor) {
  return valor || null;
}

// Réplica en JS de la consulta SQL de abajo, para cuando no hay MySQL
// disponible (desarrollo sin base de datos) — usa los mismos arreglos en
// memoria que ya llenan los módulos de entradas/salidas/movimientos.
function calcularExistenciasMemoria(limite) {
  const entradas = entradasRouter.getMemEntradas();
  const salidas = salidasRouter.getMemSalidas();
  const movimientos = movimientosRouter.getMemMovimientos();

  const grupos = new Map();
  for (const e of entradas) {
    if (e.fecha > limite) continue;
    const key = `${e.codigo}|${tg(e.tipo_ganado)}`;
    if (!grupos.has(key)) {
      grupos.set(key, { codigo: e.codigo, producto: e.producto, tipo_ganado: tg(e.tipo_ganado), cajas_entradas: 0, kilos_entradas: 0 });
    }
    const g = grupos.get(key);
    g.cajas_entradas += Number(e.cajas || 0);
    g.kilos_entradas += Number(e.kilos || 0);
  }

  const rows = [];
  for (const g of grupos.values()) {
    const salidasMatch = salidas.filter((s) => s.codigo === g.codigo && tg(s.tipo_ganado) === g.tipo_ganado && s.fecha <= limite);
    const cajas_salidas = salidasMatch.reduce((s, x) => s + Number(x.cajas || 0), 0);
    const kilos_salidas = salidasMatch.reduce((s, x) => s + Number(x.kilos || 0), 0);

    const movsMatch = movimientos.filter((m) => m.codigo === g.codigo && tg(m.tipo_ganado) === g.tipo_ganado && m.estado === 'autorizado' && m.fecha <= limite);
    const cajas_movimientos = movsMatch.reduce((s, m) => s + (m.tipo_movimiento === 'entrada' ? Number(m.cajas || 0) : -Number(m.cajas || 0)), 0);
    const kilos_movimientos = movsMatch.reduce((s, m) => s + (m.tipo_movimiento === 'entrada' ? Number(m.kilos || 0) : -Number(m.kilos || 0)), 0);

    const cajas_existentes = g.cajas_entradas - cajas_salidas + cajas_movimientos;
    const kilos_existentes = g.kilos_entradas - kilos_salidas + kilos_movimientos;

    if (cajas_existentes > 0) {
      rows.push({
        codigo: g.codigo,
        producto: g.producto,
        tipo_ganado: g.tipo_ganado,
        cajas_entradas: g.cajas_entradas,
        kilos_entradas: g.kilos_entradas,
        cajas_salidas,
        kilos_salidas,
        cajas_movimientos,
        kilos_movimientos,
        cajas_existentes,
        kilos_existentes,
      });
    }
  }

  rows.sort((a, b) => (a.tipo_ganado || '').localeCompare(b.tipo_ganado || '') || a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
  return rows;
}

// Los movimientos de inventario solo cuentan una vez autorizados; el neto
// suma si tipo_movimiento='entrada' y resta si tipo_movimiento='salida'.
// Si se manda `fecha`, calcula la existencia histórica a esa fecha (solo
// contando entradas/salidas/movimientos con fecha <= la indicada). Sin
// `fecha`, es la existencia actual (sin límite de fecha).
router.get('/', auth, async (req, res) => {
  const { fecha } = req.query;
  const limite = fecha || '9999-12-31';

  if (await dbOk()) {
    try {
      const [rows] = await pool.query(`
        SELECT
          e.codigo,
          e.producto,
          e.tipo_ganado,
          SUM(e.cajas)                                                                                   AS cajas_entradas,
          SUM(e.kilos)                                                                                   AS kilos_entradas,
          COALESCE((SELECT SUM(s.cajas) FROM salidas s WHERE s.codigo=e.codigo AND s.tipo_ganado<=>e.tipo_ganado AND s.fecha<=?),0) AS cajas_salidas,
          COALESCE((SELECT SUM(s.kilos) FROM salidas s WHERE s.codigo=e.codigo AND s.tipo_ganado<=>e.tipo_ganado AND s.fecha<=?),0) AS kilos_salidas,
          COALESCE((SELECT SUM(CASE WHEN m.tipo_movimiento='entrada' THEN m.cajas ELSE -m.cajas END)
                    FROM movimientos_inventario m
                    WHERE m.codigo=e.codigo AND m.tipo_ganado<=>e.tipo_ganado AND m.estado='autorizado' AND m.fecha<=?),0) AS cajas_movimientos,
          COALESCE((SELECT SUM(CASE WHEN m.tipo_movimiento='entrada' THEN m.kilos ELSE -m.kilos END)
                    FROM movimientos_inventario m
                    WHERE m.codigo=e.codigo AND m.tipo_ganado<=>e.tipo_ganado AND m.estado='autorizado' AND m.fecha<=?),0) AS kilos_movimientos,
          SUM(e.cajas)
            - COALESCE((SELECT SUM(s.cajas) FROM salidas s WHERE s.codigo=e.codigo AND s.tipo_ganado<=>e.tipo_ganado AND s.fecha<=?),0)
            + COALESCE((SELECT SUM(CASE WHEN m.tipo_movimiento='entrada' THEN m.cajas ELSE -m.cajas END)
                        FROM movimientos_inventario m
                        WHERE m.codigo=e.codigo AND m.tipo_ganado<=>e.tipo_ganado AND m.estado='autorizado' AND m.fecha<=?),0) AS cajas_existentes,
          SUM(e.kilos)
            - COALESCE((SELECT SUM(s.kilos) FROM salidas s WHERE s.codigo=e.codigo AND s.tipo_ganado<=>e.tipo_ganado AND s.fecha<=?),0)
            + COALESCE((SELECT SUM(CASE WHEN m.tipo_movimiento='entrada' THEN m.kilos ELSE -m.kilos END)
                        FROM movimientos_inventario m
                        WHERE m.codigo=e.codigo AND m.tipo_ganado<=>e.tipo_ganado AND m.estado='autorizado' AND m.fecha<=?),0) AS kilos_existentes
        FROM entradas e
        WHERE e.fecha <= ?
        GROUP BY e.codigo, e.producto, e.tipo_ganado
        HAVING
          SUM(e.cajas)
            - COALESCE((SELECT SUM(s.cajas) FROM salidas s WHERE s.codigo=e.codigo AND s.tipo_ganado<=>e.tipo_ganado AND s.fecha<=?),0)
            + COALESCE((SELECT SUM(CASE WHEN m.tipo_movimiento='entrada' THEN m.cajas ELSE -m.cajas END)
                        FROM movimientos_inventario m
                        WHERE m.codigo=e.codigo AND m.tipo_ganado<=>e.tipo_ganado AND m.estado='autorizado' AND m.fecha<=?),0) > 0
        ORDER BY e.tipo_ganado, e.codigo
      `, Array(11).fill(limite));
      return res.json(rows);
    } catch (err) { console.error(err); /* fallback */ }
  }
  res.json(calcularExistenciasMemoria(limite));
});

router.calcularExistenciasMemoria = calcularExistenciasMemoria;

module.exports = router;
