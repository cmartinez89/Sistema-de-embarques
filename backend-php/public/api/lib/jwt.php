<?php
// JWT mínimo (HS256) sin dependencias externas — equivalente a
// jsonwebtoken.sign()/verify() usado en el backend Node.

function base64UrlEncode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode(string $data): string {
    $padded = str_pad($data, strlen($data) % 4 === 0 ? strlen($data) : strlen($data) + (4 - strlen($data) % 4), '=');
    return base64_decode(strtr($padded, '-_', '+/'));
}

function jwtEncode(array $payload, string $secret, int $expiresInSeconds): string {
    $header = ['alg' => 'HS256', 'typ' => 'JWT'];
    $payload['iat'] = time();
    $payload['exp'] = time() + $expiresInSeconds;

    $headerPart  = base64UrlEncode(json_encode($header));
    $payloadPart = base64UrlEncode(json_encode($payload));
    $signature   = base64UrlEncode(hash_hmac('sha256', "$headerPart.$payloadPart", $secret, true));

    return "$headerPart.$payloadPart.$signature";
}

// Regresa el payload decodificado (array) o null si el token es inválido,
// está mal firmado, o ya expiró.
function jwtDecode(string $token, string $secret): ?array {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$headerPart, $payloadPart, $signature] = $parts;

    $expected = base64UrlEncode(hash_hmac('sha256', "$headerPart.$payloadPart", $secret, true));
    if (!hash_equals($expected, $signature)) return null;

    $payload = json_decode(base64UrlDecode($payloadPart), true);
    if (!is_array($payload)) return null;
    if (isset($payload['exp']) && time() > $payload['exp']) return null;

    return $payload;
}
