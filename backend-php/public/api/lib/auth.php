<?php

function getAuthorizationHeader(): string {
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) return $_SERVER['HTTP_AUTHORIZATION'];
    if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strtolower($name) === 'authorization') return $value;
        }
    }
    return '';
}

// Equivalente a middleware/auth.js — regresa el payload del token ({id,
// usuario, rol}) o corta la ejecución con 401.
function requireAuth(): array {
    $header = getAuthorizationHeader();
    if (!$header) jsonError(401, 'Token requerido');

    $parts = explode(' ', $header);
    $token = $parts[1] ?? '';
    if (!$token) jsonError(401, 'Token requerido');

    $payload = jwtDecode($token, config()['jwt_secret']);
    if (!$payload) jsonError(401, 'Token inválido');

    return $payload;
}

// Equivalente a middleware/requireAdmin.js.
function requireAdmin(array $user): void {
    if (($user['rol'] ?? null) !== 'admin') {
        jsonError(403, 'Solo el administrador puede acceder a esto');
    }
}
