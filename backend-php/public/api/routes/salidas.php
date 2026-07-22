<?php
// Espejo de backend/src/routes/salidas.js

$router->get('/folio/siguiente', function () {
    requireAuth();
    $row = db()->query('SELECT COALESCE(MAX(folio),0)+1 AS siguiente FROM salidas')->fetch();
    jsonResponse(['siguiente' => (int) $row['siguiente']]);
});

$router->get('/', function () {
    requireAuth();
    $sql = 'SELECT * FROM salidas WHERE 1=1';
    $p = [];
    foreach ([
        'fecha' => 'fecha=?',
        'cliente_id' => 'cliente_id=?',
        'folio' => 'folio=?',
        'lote_canal' => 'lote_canal=?',
    ] as $param => $clause) {
        $v = queryParam($param);
        if ($v !== null) { $sql .= " AND $clause"; $p[] = $v; }
    }
    $fi = queryParam('fecha_inicio');
    $ff = queryParam('fecha_fin');
    if ($fi !== null) { $sql .= ' AND fecha>=?'; $p[] = $fi; }
    if ($ff !== null) { $sql .= ' AND fecha<=?'; $p[] = $ff; }
    $sql .= ' ORDER BY folio DESC, id DESC';

    $stmt = db()->prepare($sql);
    $stmt->execute($p);
    jsonResponse($stmt->fetchAll());
});

$router->post('/', function () {
    requireAuth();
    $items = asItemsArray(requestBody());
    $pdo = db();

    $barcodes = array_values(array_filter(array_map(fn($i) => $i['barcode'] ?? null, $items)));
    if (count($barcodes) > 0) {
        $placeholders = implode(',', array_fill(0, count($barcodes), '?'));
        $stmt = $pdo->prepare("SELECT barcode FROM salidas WHERE barcode IN ($placeholders)");
        $stmt->execute($barcodes);
        $dup = $stmt->fetch();
        if ($dup) jsonError(409, "La caja {$dup['barcode']} ya fue registrada en una salida");
    }

    $saved = [];
    foreach ($items as $item) {
        $stmt = $pdo->prepare(
            'INSERT INTO salidas (folio, fecha, cliente_id, cliente_nombre, lote_canal, codigo, producto, tipo_ganado, cajas, kilos, barcode, entregado_por, observaciones)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
        );
        $stmt->execute([
            $item['folio'] ?? null, $item['fecha'] ?? null, $item['cliente_id'] ?? null, $item['cliente_nombre'] ?? null,
            $item['lote_canal'] ?? null, $item['codigo'] ?? null, $item['producto'] ?? null, $item['tipo_ganado'] ?? null,
            $item['cajas'] ?? null, $item['kilos'] ?? null, $item['barcode'] ?? null, $item['entregado_por'] ?? null,
            $item['observaciones'] ?? '',
        ]);
        $row = $pdo->prepare('SELECT * FROM salidas WHERE id = ?');
        $row->execute([$pdo->lastInsertId()]);
        $saved[] = $row->fetch();
    }
    jsonResponse($saved);
});

$router->put('/:id', function ($params) {
    $user = requireAuth();
    $body = requestBody();
    $justificacion = trim($body['justificacion'] ?? '');
    if (!$justificacion) jsonError(400, 'Se requiere una justificación para editar');

    $pdo = db();
    try {
        $before = $pdo->prepare('SELECT * FROM salidas WHERE id = ?');
        $before->execute([$params['id']]);
        $antes = $before->fetch();
        if (!$antes) jsonError(404, 'No encontrado');

        $stmt = $pdo->prepare(
            'UPDATE salidas SET cliente_id=?, cliente_nombre=?, lote_canal=?, codigo=?, producto=?, tipo_ganado=?, cajas=?, kilos=?, entregado_por=?, observaciones=?
             WHERE id=?'
        );
        $stmt->execute([
            $body['cliente_id'] ?? null, $body['cliente_nombre'] ?? null, $body['lote_canal'] ?? null, $body['codigo'] ?? null,
            $body['producto'] ?? null, $body['tipo_ganado'] ?? null, $body['cajas'] ?? null, $body['kilos'] ?? null,
            $body['entregado_por'] ?? null, $body['observaciones'] ?? null, $params['id'],
        ]);

        $after = $pdo->prepare('SELECT * FROM salidas WHERE id = ?');
        $after->execute([$params['id']]);
        $despues = $after->fetch();

        registrarBitacora($pdo, [
            'usuario_id' => $user['id'] ?? null,
            'usuario_nombre' => $user['usuario'] ?? null,
            'accion' => 'editar',
            'tabla' => 'salidas',
            'registro_id' => $params['id'],
            'justificacion' => $justificacion,
            'datos_antes' => $antes,
            'datos_despues' => $despues,
        ]);
        jsonResponse($despues);
    } catch (Throwable $e) {
        error_log($e->getMessage());
        jsonError(500, 'No se pudo actualizar la salida');
    }
});

// Nota: a diferencia de canales/entradas/etiquetas/movimientos, eliminar una
// salida NO exige justificación y NO se registra en bitácora (decisión
// explícita del sistema original: los embarques a cliente se pueden borrar
// libremente si fue un error de captura).
$router->delete('/:id', function ($params) {
    requireAuth();
    db()->prepare('DELETE FROM salidas WHERE id=?')->execute([$params['id']]);
    jsonResponse(['ok' => true]);
});
