<?php
// Espejo exacto de backend/src/lib/barcode.js
// Nomenclatura canónica de etiqueta: CODIGO-LOTE-CAJA-KILOS (ej. 600-26-1-15.70)
// codigo/lote/caja pueden tener cualquier longitud (sin zero-padding); kilos siempre con 2 decimales.

const BARCODE_SEP = '-';

function toKilosStr($kilos): string {
    if (!is_numeric($kilos)) throw new Exception('kilos inválido');
    return number_format((float) $kilos, 2, '.', '');
}

function buildBarcode(array $data): string {
    $codigo = $data['codigo'] ?? null;
    $lote   = $data['lote'] ?? null;
    $caja   = $data['caja'] ?? null;
    $kilos  = $data['kilos'] ?? null;

    if (!$codigo || !$lote || !$caja || $kilos === null || $kilos === '') {
        throw new Exception('Faltan datos para construir el código de barras');
    }
    return implode(BARCODE_SEP, [(string) $codigo, (string) $lote, (string) $caja, toKilosStr($kilos)]);
}

function parseBarcode($barcode): ?array {
    if (!is_string($barcode)) return null;
    $parts = explode(BARCODE_SEP, trim($barcode));
    if (count($parts) !== 4) return null;
    [$codigo, $lote, $caja, $kilos] = $parts;

    if (!preg_match('/^\d+$/', $codigo) || !preg_match('/^\d+$/', $lote)
        || !preg_match('/^\d+$/', $caja) || !preg_match('/^\d+(\.\d{1,2})?$/', $kilos)) {
        return null;
    }
    return ['codigo' => $codigo, 'lote' => $lote, 'caja' => (int) $caja, 'kilos' => (float) $kilos];
}
