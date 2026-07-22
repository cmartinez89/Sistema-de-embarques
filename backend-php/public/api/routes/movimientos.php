<?php
// Espejo de backend/src/routes/movimientos.js

const MOVIMIENTOS_MOTIVOS = ['merma', 'decomiso', 'pérdida', 'corrección', 'otro'];
const MOVIMIENTOS_TIPOS = ['entrada', 'salida'];

$router->get('/motivos', function () {
    requireAuth();
    jsonResponse(MOVIMIENTOS_MOTIVOS);
});

$router->get('/tipos-movimiento', function () {
    requireAuth();
    jsonResponse(MOVIMIENTOS_TIPOS);
});

$router->get('/', function () {
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
    $sql .= ' ORDER BY id DESC';

    $stmt = db()->prepare($sql);
    $stmt->execute($p);
    jsonResponse($stmt->fetchAll());
});

$router->post('/', function () {
    $user = requireAuth();
    $items = asItemsArray(requestBody());
    $pdo = db();
    $saved = [];

    foreach ($items as $item) {
        $tipoMov = ($item['tipo_movimiento'] ?? null) === 'entrada' ? 'entrada' : 'salida';
        $motivo = $item['motivo'] ?? null ?: 'otro';
        $observaciones = $item['observaciones'] ?? '';

        $stmt = $pdo->prepare(
            'INSERT INTO movimientos_inventario (fecha, tipo_movimiento, lote_num, codigo, producto, tipo_ganado, cajas, kilos, motivo, observaciones, estado, solicitado_por)
             VALUES (?,?,?,?,?,?,?,?,?,?,\'pendiente\',?)'
        );
        $stmt->execute([
            $item['fecha'] ?? null, $tipoMov, $item['lote_num'] ?? null, $item['codigo'] ?? null,
            $item['producto'] ?? null, $item['tipo_ganado'] ?? null, $item['cajas'] ?? null, $item['kilos'] ?? null,
            $motivo, $observaciones, $user['id'] ?? null,
        ]);
        $row = $pdo->prepare('SELECT * FROM movimientos_inventario WHERE id = ?');
        $row->execute([$pdo->lastInsertId()]);
        $saved[] = $row->fetch();
    }
    jsonResponse($saved);
});

$router->put('/:id/autorizar', function ($params) {
    $user = requireAuth();
    requireAdmin($user);
    $body = requestBody();
    $comentario = trim($body['comentario'] ?? '');
    $pdo = db();

    $stmt = $pdo->prepare('SELECT * FROM movimientos_inventario WHERE id = ?');
    $stmt->execute([$params['id']]);
    $antes = $stmt->fetch();
    if (!$antes) jsonError(404, 'No encontrado');
    if ($antes['estado'] !== 'pendiente') jsonError(400, 'Este movimiento ya fue procesado');

    $pdo->prepare(
        'UPDATE movimientos_inventario SET estado=\'autorizado\', autorizado_por=?, fecha_autorizacion=NOW(), comentario_autorizacion=? WHERE id=?'
    )->execute([$user['id'] ?? null, $comentario ?: null, $params['id']]);

    $after = $pdo->prepare('SELECT * FROM movimientos_inventario WHERE id = ?');
    $after->execute([$params['id']]);
    $despues = $after->fetch();

    registrarBitacora($pdo, [
        'usuario_id' => $user['id'] ?? null,
        'usuario_nombre' => $user['usuario'] ?? null,
        'accion' => 'autorizar',
        'tabla' => 'movimientos_inventario',
        'registro_id' => $params['id'],
        'justificacion' => $comentario ?: 'Autorizado sin comentarios',
        'datos_antes' => $antes,
        'datos_despues' => $despues,
    ]);
    jsonResponse($despues);
});

$router->put('/:id/rechazar', function ($params) {
    $user = requireAuth();
    requireAdmin($user);
    $body = requestBody();
    $comentario = trim($body['comentario'] ?? '');
    if (!$comentario) jsonError(400, 'Se requiere un comentario para rechazar el movimiento');

    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM movimientos_inventario WHERE id = ?');
    $stmt->execute([$params['id']]);
    $antes = $stmt->fetch();
    if (!$antes) jsonError(404, 'No encontrado');
    if ($antes['estado'] !== 'pendiente') jsonError(400, 'Este movimiento ya fue procesado');

    $pdo->prepare(
        'UPDATE movimientos_inventario SET estado=\'rechazado\', autorizado_por=?, fecha_autorizacion=NOW(), comentario_autorizacion=? WHERE id=?'
    )->execute([$user['id'] ?? null, $comentario, $params['id']]);

    $after = $pdo->prepare('SELECT * FROM movimientos_inventario WHERE id = ?');
    $after->execute([$params['id']]);
    $despues = $after->fetch();

    registrarBitacora($pdo, [
        'usuario_id' => $user['id'] ?? null,
        'usuario_nombre' => $user['usuario'] ?? null,
        'accion' => 'rechazar',
        'tabla' => 'movimientos_inventario',
        'registro_id' => $params['id'],
        'justificacion' => $comentario,
        'datos_antes' => $antes,
        'datos_despues' => $despues,
    ]);
    jsonResponse($despues);
});

$router->put('/:id', function ($params) {
    $user = requireAuth();
    $body = requestBody();
    $justificacion = trim($body['justificacion'] ?? '');
    if (!$justificacion) jsonError(400, 'Se requiere una justificación para editar');

    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM movimientos_inventario WHERE id = ?');
    $stmt->execute([$params['id']]);
    $antes = $stmt->fetch();
    if (!$antes) jsonError(404, 'No encontrado');
    if ($antes['estado'] !== 'pendiente') jsonError(400, 'Solo se pueden editar movimientos pendientes de autorización');

    $tipoMov = ($body['tipo_movimiento'] ?? null) === 'entrada' ? 'entrada' : 'salida';
    $motivo = $body['motivo'] ?? null ?: 'otro';
    $observaciones = $body['observaciones'] ?? '';

    $pdo->prepare(
        'UPDATE movimientos_inventario SET fecha=?, tipo_movimiento=?, lote_num=?, codigo=?, producto=?, tipo_ganado=?, cajas=?, kilos=?, motivo=?, observaciones=?
         WHERE id=?'
    )->execute([
        $body['fecha'] ?? null, $tipoMov, $body['lote_num'] ?? null, $body['codigo'] ?? null,
        $body['producto'] ?? null, $body['tipo_ganado'] ?? null, $body['cajas'] ?? null, $body['kilos'] ?? null,
        $motivo, $observaciones, $params['id'],
    ]);

    $after = $pdo->prepare('SELECT * FROM movimientos_inventario WHERE id = ?');
    $after->execute([$params['id']]);
    $despues = $after->fetch();

    registrarBitacora($pdo, [
        'usuario_id' => $user['id'] ?? null,
        'usuario_nombre' => $user['usuario'] ?? null,
        'accion' => 'editar',
        'tabla' => 'movimientos_inventario',
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
    $stmt = $pdo->prepare('SELECT * FROM movimientos_inventario WHERE id = ?');
    $stmt->execute([$params['id']]);
    $row = $stmt->fetch();
    if (!$row) jsonError(404, 'No encontrado');

    $pdo->prepare('DELETE FROM movimientos_inventario WHERE id=?')->execute([$params['id']]);
    registrarBitacora($pdo, [
        'usuario_id' => $user['id'] ?? null,
        'usuario_nombre' => $user['usuario'] ?? null,
        'accion' => 'eliminar',
        'tabla' => 'movimientos_inventario',
        'registro_id' => $params['id'],
        'justificacion' => $justificacion,
        'datos_antes' => $row,
    ]);
    jsonResponse(['ok' => true]);
});
