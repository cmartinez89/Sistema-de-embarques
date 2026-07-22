<?php
// Espejo de backend/src/lib/bitacora.js, sin el fallback en memoria (en PHP
// siempre hay MySQL real disponible en cPanel).

function registrarBitacora(PDO $pdo, array $data): void {
    $stmt = $pdo->prepare(
        'INSERT INTO bitacora (usuario_id, usuario_nombre, accion, tabla, registro_id, justificacion, datos_antes, datos_despues)
         VALUES (?,?,?,?,?,?,?,?)'
    );
    $stmt->execute([
        $data['usuario_id'] ?? null,
        $data['usuario_nombre'] ?? null,
        $data['accion'],
        $data['tabla'],
        $data['registro_id'] ?? null,
        $data['justificacion'],
        isset($data['datos_antes']) ? json_encode($data['datos_antes'], JSON_UNESCAPED_UNICODE) : null,
        isset($data['datos_despues']) ? json_encode($data['datos_despues'], JSON_UNESCAPED_UNICODE) : null,
    ]);
}
