// Espejo de backend/src/lib/barcode.js — nomenclatura canónica de etiqueta:
// CODIGO-LOTE-CAJA-KILOS (ej. 600-26-1-15.70). Sin zero-padding.

export function buildBarcode({ codigo, lote, caja, kilos }) {
  if (!codigo || !lote || !caja || kilos === undefined || kilos === null || kilos === '') {
    throw new Error('Faltan datos para construir el código de barras');
  }
  const kilosStr = Number(kilos).toFixed(2);
  return [codigo, lote, caja, kilosStr].join('-');
}

export function parseBarcode(barcode) {
  if (typeof barcode !== 'string') return null;
  const parts = barcode.trim().split('-');
  if (parts.length !== 4) return null;
  const [codigo, lote, caja, kilos] = parts;
  if (!/^\d+$/.test(codigo) || !/^\d+$/.test(lote) || !/^\d+$/.test(caja) || !/^\d+(\.\d{1,2})?$/.test(kilos)) {
    return null;
  }
  return { codigo, lote, caja: Number(caja), kilos: Number(kilos) };
}
