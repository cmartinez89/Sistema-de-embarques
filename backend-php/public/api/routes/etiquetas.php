<?php
// Espejo de backend/src/routes/etiquetas.js

$router->post('/zpl', function () {
    requireAuth();
    $body = requestBody();
    $lote = $body['lote'] ?? null;
    $codigo = $body['codigo'] ?? null;
    $kilos = $body['kilos'] ?? null;
    if (!$lote || !$codigo || !$kilos) jsonError(400, 'Faltan datos para generar la etiqueta');

    $caja = $body['caja'] ?? 1;
    $data = ['lote' => $lote, 'codigo' => $codigo, 'caja' => $caja, 'kilos' => $kilos,
              'producto' => $body['producto'] ?? null, 'fecha' => $body['fecha'] ?? null, 'romaneaje' => $body['romaneaje'] ?? null];
    try {
        $zpl = renderZplEtiqueta($data);
        $barcode = buildBarcode($data);
        jsonResponse(['zpl' => $zpl, 'barcode' => $barcode]);
    } catch (Throwable $e) {
        jsonError(400, $e->getMessage());
    }
});

$router->post('/zpl-batch', function () {
    requireAuth();
    $body = requestBody();
    $etiquetas = $body['etiquetas'] ?? [];
    if (!is_array($etiquetas) || count($etiquetas) === 0) {
        jsonError(400, 'Se requiere un arreglo de etiquetas');
    }
    try {
        $partes = [];
        foreach ($etiquetas as $e) {
            $e['caja'] = $e['caja'] ?? 1;
            $partes[] = renderZplEtiqueta($e);
        }
        jsonResponse(['zpl' => implode("\n", $partes)]);
    } catch (Throwable $e) {
        jsonError(400, $e->getMessage());
    }
});

$router->get('/', function () {
    requireAuth();
    $codigo = queryParam('codigo');
    $lote = queryParam('lote');
    $caja = queryParam('caja');
    $estado = queryParam('estado');

    $sql = 'SELECT et.*, EXISTS(SELECT 1 FROM salidas s WHERE s.barcode=et.barcode) AS embarcada
            FROM etiquetas et WHERE 1=1';
    $p = [];
    if ($codigo !== null) { $sql .= ' AND et.codigo=?'; $p[] = $codigo; }
    if ($lote !== null)   { $sql .= ' AND et.lote_num=?'; $p[] = $lote; }
    if ($caja !== null)   { $sql .= ' AND et.caja=?'; $p[] = $caja; }
    if ($estado === 'activa')    $sql .= ' AND et.activa=1';
    if ($estado === 'eliminada') $sql .= ' AND et.activa=0';
    $sql .= ' ORDER BY et.created_at DESC LIMIT 300';

    try {
        $stmt = db()->prepare($sql);
        $stmt->execute($p);
        jsonResponse($stmt->fetchAll());
    } catch (Throwable $e) {
        error_log($e->getMessage());
        jsonError(500, 'No se pudo buscar etiquetas');
    }
});

$router->delete('/:id', function ($params) {
    $user = requireAuth();
    $body = requestBody();
    $justificacion = trim($body['justificacion'] ?? '');
    if (!$justificacion) jsonError(400, 'Se requiere una justificación para eliminar');

    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM etiquetas WHERE id = ?');
    $stmt->execute([$params['id']]);
    $row = $stmt->fetch();
    if (!$row) jsonError(404, 'No encontrada');

    $pdo->prepare('UPDATE etiquetas SET activa=0 WHERE id=?')->execute([$params['id']]);
    registrarBitacora($pdo, [
        'usuario_id' => $user['id'] ?? null,
        'usuario_nombre' => $user['usuario'] ?? null,
        'accion' => 'eliminar',
        'tabla' => 'etiquetas',
        'registro_id' => $params['id'],
        'justificacion' => $justificacion,
        'datos_antes' => $row,
    ]);
    jsonResponse(['ok' => true]);
});

$router->put('/:id/reimprimir', function ($params) {
    requireAuth();
    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM etiquetas WHERE id = ?');
    $stmt->execute([$params['id']]);
    $etiqueta = $stmt->fetch();
    if (!$etiqueta) jsonError(404, 'No encontrada');
    if (!$etiqueta['activa']) jsonError(400, 'Esta etiqueta fue eliminada, no se puede reimprimir');

    $pdo->prepare('UPDATE etiquetas SET veces_impresa = veces_impresa + 1 WHERE id=?')->execute([$params['id']]);

    $zpl = renderZplEtiqueta([
        'lote' => $etiqueta['lote_num'], 'codigo' => $etiqueta['codigo'], 'caja' => $etiqueta['caja'],
        'kilos' => $etiqueta['kilos'], 'producto' => $etiqueta['producto'], 'fecha' => $etiqueta['fecha'], 'romaneaje' => $etiqueta['romaneaje'],
    ]);
    $etiqueta['veces_impresa'] = (int) $etiqueta['veces_impresa'] + 1;
    jsonResponse(['etiqueta' => $etiqueta, 'zpl' => $zpl]);
});
