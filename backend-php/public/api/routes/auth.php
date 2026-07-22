<?php
// Espejo de backend/src/routes/auth.js — sin el fallback de usuarios demo
// en memoria (la base de datos siempre está disponible en cPanel/XAMPP).

$router->post('/login', function () {
    $body = requestBody();
    $usuario = $body['usuario'] ?? null;
    $password = $body['password'] ?? null;
    if (!$usuario || !$password) {
        jsonError(400, 'Usuario y contraseña requeridos');
    }

    $stmt = db()->prepare('SELECT * FROM usuarios WHERE usuario = ? AND activo = 1');
    $stmt->execute([$usuario]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        jsonError(401, 'Credenciales inválidas');
    }

    $token = jwtEncode(
        ['id' => (int) $user['id'], 'usuario' => $user['usuario'], 'rol' => $user['rol']],
        config()['jwt_secret'],
        10 * 3600 // 10h, igual que Node
    );

    jsonResponse([
        'token' => $token,
        'user' => [
            'id' => (int) $user['id'],
            'usuario' => $user['usuario'],
            'nombre' => $user['nombre'],
            'rol' => $user['rol'],
        ],
    ]);
});

$router->get('/me', function () {
    $user = requireAuth();
    $stmt = db()->prepare('SELECT id, usuario, nombre, rol FROM usuarios WHERE id = ?');
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();
    if (!$row) jsonError(404, 'Usuario no encontrado');
    $row['id'] = (int) $row['id'];
    jsonResponse($row);
});
