<?php
// Espejo de backend/src/routes/clientes.js

$router->get('/', function () {
    requireAuth();
    $rows = db()->query('SELECT * FROM clientes ORDER BY activo DESC, nombre ASC')->fetchAll();
    jsonResponse($rows);
});

$router->post('/', function () {
    requireAuth();
    $body = requestBody();
    $stmt = db()->prepare('INSERT INTO clientes (nombre, rfc, contacto, telefono, activo) VALUES (?,?,?,?,1)');
    $stmt->execute([$body['nombre'] ?? null, $body['rfc'] ?? null, $body['contacto'] ?? null, $body['telefono'] ?? null]);
    $id = db()->lastInsertId();
    $row = db()->prepare('SELECT * FROM clientes WHERE id = ?');
    $row->execute([$id]);
    jsonResponse($row->fetch());
});

$router->put('/:id', function ($params) {
    requireAuth();
    $body = requestBody();
    $activo = ($body['activo'] ?? false) ? 1 : 0;
    $stmt = db()->prepare('UPDATE clientes SET nombre=?, rfc=?, contacto=?, telefono=?, activo=? WHERE id=?');
    $stmt->execute([$body['nombre'] ?? null, $body['rfc'] ?? null, $body['contacto'] ?? null, $body['telefono'] ?? null, $activo, $params['id']]);
    $row = db()->prepare('SELECT * FROM clientes WHERE id = ?');
    $row->execute([$params['id']]);
    jsonResponse($row->fetch() ?: null);
});

$router->delete('/:id', function ($params) {
    requireAuth();
    $stmt = db()->prepare('UPDATE clientes SET activo=0 WHERE id=?');
    $stmt->execute([$params['id']]);
    jsonResponse(['ok' => true]);
});
