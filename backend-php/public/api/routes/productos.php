<?php
// Espejo de backend/src/routes/productos.js

const PRODUCTOS_TIPOS = ['Ambos', 'De Procarne', 'San Carlos', 'Engorda', 'Corriente'];

$router->get('/', function () {
    requireAuth();
    $rows = db()->query('SELECT * FROM productos ORDER BY codigo')->fetchAll();
    jsonResponse($rows);
});

$router->get('/tipos-ganado', function () {
    requireAuth();
    jsonResponse(PRODUCTOS_TIPOS);
});

$router->post('/', function () {
    requireAuth();
    $body = requestBody();
    $codigo = $body['codigo'] ?? null;
    $nombre = $body['nombre'] ?? null;
    if (!$codigo || !$nombre) jsonError(400, 'codigo y nombre son requeridos');

    $stmt = db()->prepare('INSERT INTO productos (codigo, nombre, tipo_ganado, activo) VALUES (?,?,?,1)');
    $stmt->execute([$codigo, $nombre, $body['tipo_ganado'] ?? 'Ambos']);
    $id = db()->lastInsertId();
    $row = db()->prepare('SELECT * FROM productos WHERE id = ?');
    $row->execute([$id]);
    jsonResponse($row->fetch());
});

$router->put('/:id', function ($params) {
    requireAuth();
    $body = requestBody();
    $activo = array_key_exists('activo', $body) ? (($body['activo']) ? 1 : 0) : 1;
    $stmt = db()->prepare('UPDATE productos SET codigo=?, nombre=?, tipo_ganado=?, activo=? WHERE id=?');
    $stmt->execute([$body['codigo'] ?? null, $body['nombre'] ?? null, $body['tipo_ganado'] ?? null, $activo, $params['id']]);

    $row = db()->prepare('SELECT * FROM productos WHERE id = ?');
    $row->execute([$params['id']]);
    $result = $row->fetch();
    if (!$result) jsonError(404, 'No encontrado');
    jsonResponse($result);
});

$router->delete('/:id', function ($params) {
    requireAuth();
    $stmt = db()->prepare('UPDATE productos SET activo=0 WHERE id=?');
    $stmt->execute([$params['id']]);
    jsonResponse(['ok' => true]);
});
