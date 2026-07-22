<?php
// Espejo de backend/src/routes/existencias.js
// Los movimientos de inventario solo cuentan una vez autorizados; el neto
// suma si tipo_movimiento='entrada' y resta si tipo_movimiento='salida'.
// `fecha` opcional -> existencia histórica a esa fecha; sin ella, actual.

$router->get('/', function () {
    requireAuth();
    $limite = queryParam('fecha') ?: '9999-12-31';

    $sql = "
        SELECT
          e.codigo,
          e.producto,
          e.tipo_ganado,
          SUM(e.cajas) AS cajas_entradas,
          SUM(e.kilos) AS kilos_entradas,
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
    ";

    $stmt = db()->prepare($sql);
    $stmt->execute(array_fill(0, 11, $limite));
    jsonResponse($stmt->fetchAll());
});
