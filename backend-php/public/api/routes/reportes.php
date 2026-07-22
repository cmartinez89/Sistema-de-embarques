<?php
// Espejo de backend/src/routes/reportes.js

$router->get('/entradas', function () {
    requireAuth();
    $fi = queryParam('fecha_inicio');
    $ff = queryParam('fecha_fin');
    $loteNum = queryParam('lote_num');
    $agrupado = queryParam('agrupado');

    if ($agrupado) {
        $sql = "SELECT codigo, producto, tipo_ganado,
                   SUM(cajas) AS total_cajas,
                   SUM(kilos) AS total_kilos,
                   GROUP_CONCAT(caja ORDER BY caja SEPARATOR ', ') AS cajas_lista
                 FROM entradas WHERE 1=1";
    } else {
        $sql = 'SELECT * FROM entradas WHERE 1=1';
    }
    $p = [];
    if ($fi !== null) { $sql .= ' AND fecha>=?'; $p[] = $fi; }
    if ($ff !== null) { $sql .= ' AND fecha<=?'; $p[] = $ff; }
    if ($loteNum !== null) { $sql .= ' AND lote_num=?'; $p[] = $loteNum; }
    $sql .= $agrupado ? ' GROUP BY codigo, producto, tipo_ganado ORDER BY producto' : ' ORDER BY fecha, lote_num, codigo';

    $stmt = db()->prepare($sql);
    $stmt->execute($p);
    jsonResponse($stmt->fetchAll());
});

$router->get('/salidas', function () {
    requireAuth();
    $fi = queryParam('fecha_inicio');
    $ff = queryParam('fecha_fin');
    $clienteId = queryParam('cliente_id');
    $agrupado = queryParam('agrupado');

    if ($agrupado) {
        $sql = "SELECT codigo, producto, tipo_ganado,
                   SUM(cajas) AS total_cajas,
                   SUM(kilos) AS total_kilos,
                   COUNT(*) AS num_registros
                 FROM salidas WHERE 1=1";
    } else {
        $sql = 'SELECT * FROM salidas WHERE 1=1';
    }
    $p = [];
    if ($fi !== null) { $sql .= ' AND fecha>=?'; $p[] = $fi; }
    if ($ff !== null) { $sql .= ' AND fecha<=?'; $p[] = $ff; }
    if ($clienteId !== null) { $sql .= ' AND cliente_id=?'; $p[] = $clienteId; }
    $sql .= $agrupado ? ' GROUP BY codigo, producto, tipo_ganado ORDER BY producto' : ' ORDER BY folio, fecha';

    $stmt = db()->prepare($sql);
    $stmt->execute($p);
    jsonResponse($stmt->fetchAll());
});

$router->get('/movimientos', function () {
    requireAuth();
    $sql = 'SELECT * FROM movimientos_inventario WHERE 1=1';
    $p = [];
    $fi = queryParam('fecha_inicio');
    $ff = queryParam('fecha_fin');
    $estado = queryParam('estado');
    $tipo = queryParam('tipo_movimiento');
    if ($fi !== null) { $sql .= ' AND fecha>=?'; $p[] = $fi; }
    if ($ff !== null) { $sql .= ' AND fecha<=?'; $p[] = $ff; }
    if ($estado !== null) { $sql .= ' AND estado=?'; $p[] = $estado; }
    if ($tipo !== null) { $sql .= ' AND tipo_movimiento=?'; $p[] = $tipo; }
    $sql .= ' ORDER BY fecha DESC, id DESC';

    $stmt = db()->prepare($sql);
    $stmt->execute($p);
    jsonResponse($stmt->fetchAll());
});

// Los movimientos de inventario solo cuentan una vez autorizados; el neto
// suma si tipo_movimiento='entrada' y resta si tipo_movimiento='salida'.
// `fecha` opcional -> existencia histórica a esa fecha; sin ella, actual.
$router->get('/existencias', function () {
    requireAuth();
    $limite = queryParam('fecha') ?: '9999-12-31';

    $sql = "
        SELECT
          e.codigo,
          e.producto,
          e.tipo_ganado,
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
    ";

    $stmt = db()->prepare($sql);
    $stmt->execute(array_fill(0, 7, $limite));
    jsonResponse($stmt->fetchAll());
});

$router->get('/canales', function () {
    requireAuth();
    $loteNum = queryParam('lote_num');
    $sql = "
        SELECT c.*, l.numero AS lote_numero, l.tipo_ganado, l.romaneaje, l.observaciones AS lote_observaciones
        FROM canales c
        JOIN lotes l ON l.id = c.lote_id
        WHERE 1=1
    ";
    $p = [];
    if ($loteNum !== null) { $sql .= ' AND l.numero=?'; $p[] = $loteNum; }
    $sql .= ' ORDER BY l.numero, c.consecutivo';

    $stmt = db()->prepare($sql);
    $stmt->execute($p);
    jsonResponse($stmt->fetchAll());
});
