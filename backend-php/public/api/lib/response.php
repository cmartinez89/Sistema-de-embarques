<?php

function jsonResponse($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError(int $status, string $message): void {
    jsonResponse(['error' => $message], $status);
}

// Cuerpo del request como array asociativo (equivalente a express.json()).
// Se cachea porque php://input solo se puede leer una vez.
function requestBody(): array {
    static $body = null;
    if ($body !== null) return $body;
    $raw = file_get_contents('php://input');
    $decoded = $raw !== '' ? json_decode($raw, true) : null;
    $body = is_array($decoded) ? $decoded : [];
    return $body;
}

// Igual que `Array.isArray(req.body) ? req.body : [req.body]` en Node.
// json_decode(..., true) da un array indexado 0..n-1 para un JSON array,
// y un array asociativo (claves string) para un JSON object.
function asItemsArray(array $body): array {
    if (empty($body)) return [$body];
    $isList = array_keys($body) === range(0, count($body) - 1);
    return $isList ? $body : [$body];
}

function queryParam(string $name, $default = null) {
    return isset($_GET[$name]) && $_GET[$name] !== '' ? $_GET[$name] : $default;
}
