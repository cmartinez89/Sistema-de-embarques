<?php
// Espejo de backend/src/routes/canales.js

const CANALES_TIPOS_GANADO = ['De Procarne', 'San Carlos', 'Engorda', 'Corriente'];

function numOrZero($v): float {
    return is_numeric($v) ? (float) $v : 0.0;
}

function calcularPesoFrio(array $item): array {
    $tipo = ($item['tipo'] ?? null) === 'medios' ? 'medios' : 'cuartos';
    $medio_1 = numOrZero($item['medio_1'] ?? null);
    $medio_2 = numOrZero($item['medio_2'] ?? null);
    $cuarto_1 = numOrZero($item['cuarto_1'] ?? null);
    $cuarto_2 = numOrZero($item['cuarto_2'] ?? null);
    $cuarto_3 = numOrZero($item['cuarto_3'] ?? null);
    $cuarto_4 = numOrZero($item['cuarto_4'] ?? null);
    $peso_frio = $tipo === 'medios' ? ($medio_1 + $medio_2) : ($cuarto_1 + $cuarto_2 + $cuarto_3 + $cuarto_4);
    $peso_caliente = numOrZero($item['peso_caliente'] ?? null);
    $diferencia_pct = $peso_caliente ? round((($peso_caliente - $peso_frio) / $peso_caliente) * 10000) / 100 : 0;

    return compact('tipo', 'medio_1', 'medio_2', 'cuarto_1', 'cuarto_2', 'cuarto_3', 'cuarto_4', 'peso_caliente', 'peso_frio', 'diferencia_pct');
}

/* ─── LOTES ─── */

$router->get('/lotes', function () {
    requireAuth();
    $rows = db()->query('
        SELECT l.*,
            COUNT(c.id) AS num_canales,
            COALESCE(SUM(c.peso_caliente),0) AS peso_caliente_total,
            COALESCE(SUM(c.peso_frio),0) AS peso_frio_total
        FROM lotes l
        LEFT JOIN canales c ON c.lote_id = l.id
        GROUP BY l.id
        ORDER BY l.fecha DESC, l.id DESC
    ')->fetchAll();
    jsonResponse($rows);
});

$router->get('/lotes/siguiente-numero', function () {
    requireAuth();
    $row = db()->query('SELECT actual FROM contador_lotes WHERE id = 1')->fetch();
    jsonResponse(['siguiente' => (int) ($row['actual'] ?? 0) + 1]);
});

$router->post('/lotes/:id/romaneaje-pdf', function ($params) {
    requireAuth();
    $id = $params['id'];
    if (!preg_match('/^\d+$/', $id)) jsonError(400, 'Id de lote inválido');

    if (empty($_FILES['pdf']) || $_FILES['pdf']['error'] !== UPLOAD_ERR_OK) {
        jsonError(400, 'No se recibió ningún archivo');
    }
    $file = $_FILES['pdf'];
    if ($file['size'] > 10 * 1024 * 1024) jsonError(400, 'El archivo excede 10MB');

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $realMime = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    if ($realMime !== 'application/pdf') jsonError(400, 'Solo se permiten archivos PDF');

    $uploadsDir = config()['uploads_dir'];
    if (!is_dir($uploadsDir)) mkdir($uploadsDir, 0777, true);

    $filename = 'lote-' . $id . '-' . (int) round(microtime(true) * 1000) . '.pdf';
    $destPath = $uploadsDir . '/' . $filename;

    $stmt = db()->prepare('SELECT romaneaje_pdf FROM lotes WHERE id = ?');
    $stmt->execute([$id]);
    $lote = $stmt->fetch();
    if (!$lote) jsonError(404, 'Lote no encontrado');

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        jsonError(500, 'No se pudo guardar el archivo');
    }

    if (!empty($lote['romaneaje_pdf'])) {
        @unlink($uploadsDir . '/' . $lote['romaneaje_pdf']);
    }

    db()->prepare('UPDATE lotes SET romaneaje_pdf = ? WHERE id = ?')->execute([$filename, $id]);
    jsonResponse(['ok' => true, 'romaneaje_pdf' => $filename]);
});

$router->get('/lotes/:id/romaneaje-pdf', function ($params) {
    requireAuth();
    $stmt = db()->prepare('SELECT romaneaje_pdf FROM lotes WHERE id = ?');
    $stmt->execute([$params['id']]);
    $lote = $stmt->fetch();
    $filename = $lote['romaneaje_pdf'] ?? null;
    if (!$filename) jsonError(404, 'Este lote no tiene PDF de romaneaje');

    $filePath = config()['uploads_dir'] . '/' . $filename;
    if (!file_exists($filePath)) jsonError(404, 'Archivo no encontrado en el servidor');

    header('Content-Type: application/pdf');
    header('Content-Length: ' . filesize($filePath));
    readfile($filePath);
    exit;
});

$router->get('/lotes/:id', function ($params) {
    requireAuth();
    $stmt = db()->prepare('SELECT * FROM lotes WHERE id = ?');
    $stmt->execute([$params['id']]);
    $row = $stmt->fetch();
    if (!$row) jsonError(404, 'Lote no encontrado');
    jsonResponse($row);
});

$router->post('/lotes', function () {
    requireAuth();
    $body = requestBody();
    $pdo = db();
    try {
        $pdo->beginTransaction();
        // INSERT IGNORE + UPDATE (nunca INSERT..ON DUPLICATE KEY) para que
        // LAST_INSERT_ID(actual+1) SIEMPRE se fije, incluso la primera vez
        // que se usa el contador.
        $pdo->exec('INSERT IGNORE INTO contador_lotes (id, actual) VALUES (1, 0)');
        $pdo->exec('UPDATE contador_lotes SET actual = LAST_INSERT_ID(actual + 1) WHERE id = 1');
        $numero = $pdo->query('SELECT LAST_INSERT_ID() AS numero')->fetch()['numero'];

        $stmt = $pdo->prepare('INSERT INTO lotes (numero, fecha, fecha_sacrificio, tipo_ganado, romaneaje, observaciones) VALUES (?,?,?,?,?,?)');
        $stmt->execute([
            (string) $numero,
            $body['fecha'] ?? null,
            $body['fecha_sacrificio'] ?? null,
            $body['tipo_ganado'] ?? null,
            $body['romaneaje'] ?? null,
            $body['observaciones'] ?? null,
        ]);
        $id = $pdo->lastInsertId();
        $pdo->commit();

        $row = $pdo->prepare('SELECT * FROM lotes WHERE id = ?');
        $row->execute([$id]);
        jsonResponse($row->fetch());
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log($e->getMessage());
        jsonError(500, 'No se pudo registrar el lote');
    }
});

/* ─── CANALES ─── */

$router->get('/', function () {
    requireAuth();
    $loteId = queryParam('lote_id');
    $stmt = db()->prepare('SELECT * FROM canales WHERE lote_id = ? ORDER BY consecutivo');
    $stmt->execute([$loteId]);
    jsonResponse($stmt->fetchAll());
});

$router->post('/', function () {
    requireAuth();
    $items = asItemsArray(requestBody());
    $pdo = db();
    $saved = [];

    foreach ($items as $item) {
        $calc = calcularPesoFrio($item);
        $stmt = $pdo->prepare(
            'INSERT INTO canales
             (lote_id, consecutivo, tipo, peso_caliente, peso_frio, diferencia_pct,
              medio_1, medio_2, cuarto_1, cuarto_2, cuarto_3, cuarto_4, fecha, observaciones)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        );
        $stmt->execute([
            $item['lote_id'] ?? null, $item['consecutivo'] ?? null, $calc['tipo'], $calc['peso_caliente'], $calc['peso_frio'], $calc['diferencia_pct'],
            $calc['medio_1'], $calc['medio_2'], $calc['cuarto_1'], $calc['cuarto_2'], $calc['cuarto_3'], $calc['cuarto_4'],
            $item['fecha'] ?? null, $item['observaciones'] ?? '',
        ]);
        $row = $pdo->prepare('SELECT * FROM canales WHERE id = ?');
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

    $calc = calcularPesoFrio($body);
    $observaciones = $body['observaciones'] ?? '';
    $pdo = db();

    $before = $pdo->prepare('SELECT * FROM canales WHERE id = ?');
    $before->execute([$params['id']]);
    $antes = $before->fetch();
    if (!$antes) jsonError(404, 'No encontrado');

    $stmt = $pdo->prepare(
        'UPDATE canales SET tipo=?, peso_caliente=?, peso_frio=?, diferencia_pct=?,
         medio_1=?, medio_2=?, cuarto_1=?, cuarto_2=?, cuarto_3=?, cuarto_4=?, observaciones=?
         WHERE id=?'
    );
    $stmt->execute([
        $calc['tipo'], $calc['peso_caliente'], $calc['peso_frio'], $calc['diferencia_pct'],
        $calc['medio_1'], $calc['medio_2'], $calc['cuarto_1'], $calc['cuarto_2'], $calc['cuarto_3'], $calc['cuarto_4'],
        $observaciones, $params['id'],
    ]);

    $after = $pdo->prepare('SELECT * FROM canales WHERE id = ?');
    $after->execute([$params['id']]);
    $despues = $after->fetch();

    registrarBitacora($pdo, [
        'usuario_id' => $user['id'] ?? null,
        'usuario_nombre' => $user['usuario'] ?? null,
        'accion' => 'editar',
        'tabla' => 'canales',
        'registro_id' => $params['id'],
        'justificacion' => $justificacion,
        'datos_antes' => $antes,
        'datos_despues' => $despues,
    ]);
    jsonResponse($despues);
});

$router->delete('/:id', function ($params) {
    $user = requireAuth();
    $body = requestBody();
    $justificacion = trim($body['justificacion'] ?? '');
    if (!$justificacion) jsonError(400, 'Se requiere una justificación para eliminar');

    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM canales WHERE id = ?');
    $stmt->execute([$params['id']]);
    $row = $stmt->fetch();
    if (!$row) jsonError(404, 'No encontrado');

    $pdo->prepare('DELETE FROM canales WHERE id = ?')->execute([$params['id']]);
    registrarBitacora($pdo, [
        'usuario_id' => $user['id'] ?? null,
        'usuario_nombre' => $user['usuario'] ?? null,
        'accion' => 'eliminar',
        'tabla' => 'canales',
        'registro_id' => $params['id'],
        'justificacion' => $justificacion,
        'datos_antes' => $row,
    ]);
    jsonResponse(['ok' => true]);
});

$router->get('/tipos-ganado', function () {
    requireAuth();
    jsonResponse(CANALES_TIPOS_GANADO);
});
