<?php
// Front controller único — todo /api/* (ver .htaccess) llega aquí.
// Replica backend/src/index.js: monta cada módulo bajo /api/<modulo>,
// responde /api/health, y 404 JSON para cualquier ruta de API no encontrada.

require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/response.php';
require __DIR__ . '/lib/jwt.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/router.php';
require __DIR__ . '/lib/barcode.php';
require __DIR__ . '/lib/zpl.php';
require __DIR__ . '/lib/bitacora.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'OPTIONS') { http_response_code(204); exit; }

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$prefix = '/api';
$rest = strpos($uri, $prefix) === 0 ? substr($uri, strlen($prefix)) : $uri;
$rest = '/' . trim($rest, '/');

if ($rest === '/health') {
    jsonResponse(['status' => 'ok', 'ts' => date('c')]);
}

$segments = explode('/', trim($rest, '/'));
$module = $segments[0] ?? '';
$subPath = '/' . implode('/', array_slice($segments, 1));

$moduleFile = __DIR__ . "/routes/{$module}.php";
if ($module === '' || !file_exists($moduleFile)) {
    jsonError(404, 'Ruta no encontrada');
}

$router = new Router();
require $moduleFile;

if (!$router->dispatch($method, $subPath)) {
    jsonError(404, 'Ruta no encontrada');
}
