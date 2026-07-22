<?php
// Espejo de backend/src/routes/entradas.js

function isDuplicateEntryError(Throwable $e): bool {
    if (!($e instanceof PDOException)) return false;
    return (($e->errorInfo[1] ?? null) === 1062);
}

/* ─── Productos (catálogo rápido para el formulario de entradas) ─── */
$router->get('/productos', function () {
    requireAuth();
    jsonResponse(db()->query('SELECT * FROM productos ORDER BY codigo')->fetchAll());
});

/* ─── Entradas ─── */

$router->get('/resumen-por-lote', function () {
    requireAuth();
    $rows = db()->query('
        SELECT lote_id, COALESCE(SUM(cajas),0) AS num_cajas, COALESCE(SUM(kilos),0) AS kilos_total
        FROM entradas
        GROUP BY lote_id
    ')->fetchAll();
    jsonResponse($rows);
});

$router->get('/', function () {
    requireAuth();
    $loteId = queryParam('lote_id');
    $fecha = queryParam('fecha');
    $sql = 'SELECT en.*, et.barcode
            FROM entradas en
            LEFT JOIN etiquetas et ON et.id = en.etiqueta_id
            WHERE 1=1';
    $p = [];
    if ($loteId !== null) { $sql .= ' AND en.lote_id=?'; $p[] = $loteId; }
    if ($fecha !== null)  { $sql .= ' AND en.fecha=?';   $p[] = $fecha; }
    $sql .= ' ORDER BY en.id';
    $stmt = db()->prepare($sql);
    $stmt->execute($p);
    jsonResponse($stmt->fetchAll());
});

$router->post('/', function () {
    requireAuth();
    $items = asItemsArray(requestBody());
    $pdo = db();
    $saved = [];
    foreach ($items as $item) {
        $stmt = $pdo->prepare(
            'INSERT INTO entradas (lote_id, lote_num, fecha, tipo_ganado, codigo, producto, cajas, kilos, caja)
             VALUES (?,?,?,?,?,?,?,?,?)'
        );
        $stmt->execute([
            $item['lote_id'] ?? null, $item['lote_num'] ?? null, $item['fecha'] ?? null, $item['tipo_ganado'] ?? null,
            $item['codigo'] ?? null, $item['producto'] ?? null, $item['cajas'] ?? null, $item['kilos'] ?? null, $item['caja'] ?? null,
        ]);
        $row = $pdo->prepare('SELECT * FROM entradas WHERE id = ?');
        $row->execute([$pdo->lastInsertId()]);
        $saved[] = $row->fetch();
    }
    jsonResponse($saved);
});

/* ─── Inventario inicial: cajas físicas que ya existen (con etiqueta ya
   impresa, de antes de usar el sistema o de un conteo físico). A diferencia
   de /caja, aquí el código de barras ya lo trae la caja escaneada — no se
   genera uno nuevo, y no hay lote_id real (queda NULL). ─── */
$router->post('/inventario-inicial', function () {
    $user = requireAuth();
    $items = asItemsArray(requestBody());
    $pdo = db();
    $saved = [];

    try {
        $pdo->beginTransaction();
        foreach ($items as $item) {
            $barcode = $item['barcode'] ?? null;
            $stmtEt = $pdo->prepare(
                'INSERT INTO etiquetas (lote_id, lote_num, codigo, producto, caja, kilos, barcode, fecha, romaneaje, usuario_id)
                 VALUES (NULL,?,?,?,?,?,?,?,NULL,?)'
            );
            $stmtEt->execute([
                $item['lote_num'] ?? null, $item['codigo'] ?? null, $item['producto'] ?? null,
                $item['caja'] ?? null, $item['kilos'] ?? null, $barcode, $item['fecha'] ?? null,
                $user['id'] ?? null,
            ]);
            $etiquetaId = $pdo->lastInsertId();

            $stmtEn = $pdo->prepare(
                'INSERT INTO entradas (lote_id, lote_num, fecha, tipo_ganado, codigo, producto, cajas, kilos, caja, etiqueta_id)
                 VALUES (NULL,?,?,?,?,?,1,?,?,?)'
            );
            $stmtEn->execute([
                $item['lote_num'] ?? null, $item['fecha'] ?? null, $item['tipo_ganado'] ?? null,
                $item['codigo'] ?? null, $item['producto'] ?? null, $item['kilos'] ?? null,
                $item['caja'] ?? null, $etiquetaId,
            ]);
            $row = $pdo->prepare('SELECT * FROM entradas WHERE id=?');
            $row->execute([$pdo->lastInsertId()]);
            $saved[] = $row->fetch();
        }
        $pdo->commit();
        jsonResponse($saved);
    } catch (Throwable $e) {
        $pdo->rollBack();
        if (isDuplicateEntryError($e)) {
            jsonError(409, 'Una de estas cajas ya fue agregada antes (código de barras duplicado)');
        }
        error_log($e->getMessage());
        jsonError(500, 'No se pudo agregar al inventario');
    }
});

$router->delete('/:id', function ($params) {
    $user = requireAuth();
    $body = requestBody();
    $justificacion = trim($body['justificacion'] ?? '');
    if (!$justificacion) jsonError(400, 'Se requiere una justificación para eliminar');

    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM entradas WHERE id=?');
    $stmt->execute([$params['id']]);
    $row = $stmt->fetch();
    if (!$row) jsonError(404, 'No encontrado');

    $pdo->prepare('DELETE FROM entradas WHERE id=?')->execute([$params['id']]);
    registrarBitacora($pdo, [
        'usuario_id' => $user['id'] ?? null,
        'usuario_nombre' => $user['usuario'] ?? null,
        'accion' => 'eliminar',
        'tabla' => 'entradas',
        'registro_id' => $params['id'],
        'justificacion' => $justificacion,
        'datos_antes' => $row,
    ]);
    jsonResponse(['ok' => true]);
});

/* ─── Captura por caja individual (Fase 1) ─── */

$router->get('/siguiente-caja', function () {
    requireAuth();
    $loteId = queryParam('lote_id');
    $codigo = queryParam('codigo');
    if (!$loteId || !$codigo) jsonError(400, 'lote_id y codigo son requeridos');

    $stmt = db()->prepare('SELECT COALESCE(MAX(caja),0)+1 AS siguiente FROM etiquetas WHERE lote_id=? AND codigo=?');
    $stmt->execute([$loteId, $codigo]);
    jsonResponse(['siguiente' => (int) $stmt->fetch()['siguiente']]);
});

$router->post('/caja', function () {
    $user = requireAuth();
    $body = requestBody();
    $lote_id = $body['lote_id'] ?? null;
    $lote_num = $body['lote_num'] ?? null;
    $tipo_ganado = $body['tipo_ganado'] ?? null;
    $codigo = $body['codigo'] ?? null;
    $producto = $body['producto'] ?? null;
    $kilos = $body['kilos'] ?? null;
    $fecha = $body['fecha'] ?? null;
    $romaneaje = $body['romaneaje'] ?? null;

    if (!$lote_id || !$lote_num || !$codigo || $kilos === null || $kilos === '') {
        jsonError(400, 'Faltan datos para registrar la caja');
    }

    $pdo = db();
    try {
        $pdo->beginTransaction();
        // INSERT IGNORE + UPDATE (nunca INSERT..ON DUPLICATE KEY) para que
        // LAST_INSERT_ID(actual+1) SIEMPRE se fije, incluso la primera caja
        // de un producto nuevo en el lote.
        $stmt = $pdo->prepare('INSERT IGNORE INTO contador_cajas (lote_id, codigo, actual) VALUES (?,?,0)');
        $stmt->execute([$lote_id, $codigo]);
        $stmt = $pdo->prepare('UPDATE contador_cajas SET actual = LAST_INSERT_ID(actual + 1) WHERE lote_id=? AND codigo=?');
        $stmt->execute([$lote_id, $codigo]);
        $caja = (int) $pdo->query('SELECT LAST_INSERT_ID() AS caja')->fetch()['caja'];

        $barcode = buildBarcode(['codigo' => $codigo, 'lote' => $lote_num, 'caja' => $caja, 'kilos' => $kilos]);

        $stmtEt = $pdo->prepare(
            'INSERT INTO etiquetas (lote_id, lote_num, codigo, producto, caja, kilos, barcode, fecha, romaneaje, usuario_id)
             VALUES (?,?,?,?,?,?,?,?,?,?)'
        );
        $stmtEt->execute([$lote_id, $lote_num, $codigo, $producto, $caja, $kilos, $barcode, $fecha, $romaneaje ?: null, $user['id'] ?? null]);
        $etiquetaId = $pdo->lastInsertId();

        $stmtEn = $pdo->prepare(
            'INSERT INTO entradas (lote_id, lote_num, fecha, tipo_ganado, codigo, producto, cajas, kilos, caja, etiqueta_id)
             VALUES (?,?,?,?,?,?,1,?,?,?)'
        );
        $stmtEn->execute([$lote_id, $lote_num, $fecha, $tipo_ganado, $codigo, $producto, $kilos, $caja, $etiquetaId]);
        $entradaId = $pdo->lastInsertId();
        $pdo->commit();

        $entrada = $pdo->prepare('SELECT * FROM entradas WHERE id=?');
        $entrada->execute([$entradaId]);
        $etiqueta = $pdo->prepare('SELECT * FROM etiquetas WHERE id=?');
        $etiqueta->execute([$etiquetaId]);

        $zpl = renderZplEtiqueta(['lote' => $lote_num, 'codigo' => $codigo, 'caja' => $caja, 'kilos' => $kilos, 'producto' => $producto, 'fecha' => $fecha, 'romaneaje' => $romaneaje]);

        jsonResponse(['entrada' => $entrada->fetch(), 'etiqueta' => $etiqueta->fetch(), 'zpl' => $zpl]);
    } catch (Throwable $e) {
        $pdo->rollBack();
        if (isDuplicateEntryError($e)) {
            jsonError(409, 'Esta caja ya tiene una etiqueta registrada (posible duplicado)');
        }
        error_log($e->getMessage());
        jsonError(500, 'No se pudo registrar la caja');
    }
});

/* ─── Escaneo de caja para Salidas ─── */
$router->get('/buscar-etiqueta', function () {
    requireAuth();
    $barcode = queryParam('barcode');
    if (!$barcode) jsonError(400, 'Falta el código de barras');

    $stmt = db()->prepare(
        'SELECT et.*, en.tipo_ganado
         FROM etiquetas et
         LEFT JOIN entradas en ON en.etiqueta_id = et.id
         WHERE et.barcode = ?'
    );
    $stmt->execute([$barcode]);
    $row = $stmt->fetch();
    if (!$row) jsonError(404, 'Caja no encontrada');
    if (!$row['activa']) jsonError(400, 'Esta etiqueta fue anulada');
    jsonResponse($row);
});
