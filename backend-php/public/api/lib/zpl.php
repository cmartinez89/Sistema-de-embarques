<?php
// Espejo exacto de backend/src/lib/zpl.js
// Genera ZPL para impresora Zebra. Tamaño etiqueta carne: 4" x 2" (812 x 406 dots a 203dpi)

function renderZplEtiqueta(array $data): string {
    $lote      = $data['lote'] ?? null;
    $codigo    = $data['codigo'] ?? null;
    $caja      = $data['caja'] ?? null;
    $kilos     = $data['kilos'] ?? null;
    $producto  = $data['producto'] ?? null;
    $fecha     = $data['fecha'] ?? null;
    $romaneaje = $data['romaneaje'] ?? null;

    $barcode = buildBarcode(['codigo' => $codigo, 'lote' => $lote, 'caja' => $caja, 'kilos' => $kilos]);

    $lines = [
        '^XA',
        '^MMT',
        '^PW812',
        '^LL0406',
        '^LS0',
        '^FO30,20^A0N,28,28^FDEmpacadora Carnes Finas el Anden^FS',
        '^FO30,52^A0N,18,18^FDTIF No. 680 - SAGARPA Mexico^FS',
        '^FO30,75^GB752,2,2^FS',
        "^FO30,85^A0N,24,24^FD{$producto}^FS",
        "^FO30,115^A0N,20,20^FDLote: {$lote}   Fecha: {$fecha}^FS",
        $romaneaje ? "^FO30,140^A0N,18,18^FDRomaneaje: {$romaneaje}^FS" : '',
        "^FO580,85^A0N,30,30^FD{$kilos} kg^FS",
        '^FO30,168^GB752,2,2^FS',
        "^FO30,180^BCN,100,N,N,N^FD{$barcode}^FS",
        "^FO30,290^A0N,20,20^FD{$barcode}^FS",
        "^FO580,290^A0N,20,20^FDCaja: {$caja}^FS",
        '^XZ',
    ];

    return implode("\n", array_filter($lines, fn($l) => $l !== ''));
}
