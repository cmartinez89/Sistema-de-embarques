// Nomenclatura canónica de etiqueta: CODIGO-LOTE-CAJA-KILOS (ej. 600-26-1-15.70)
// codigo/lote/caja pueden tener cualquier longitud (sin zero-padding); kilos siempre con 2 decimales.

const SEP = '-';

function toKilosStr(kilos) {
  const n = Number(kilos);
  if (Number.isNaN(n)) throw new Error('kilos inválido');
  return n.toFixed(2);
}

function buildBarcode({ codigo, lote, caja, kilos }) {
  if (!codigo || !lote || !caja || kilos === undefined || kilos === null || kilos === '') {
    throw new Error('Faltan datos para construir el código de barras');
  }
  return [String(codigo), String(lote), String(caja), toKilosStr(kilos)].join(SEP);
}

function parseBarcode(barcode) {
  if (typeof barcode !== 'string') return null;
  const parts = barcode.trim().split(SEP);
  if (parts.length !== 4) return null;
  const [codigo, lote, caja, kilos] = parts;
  if (!/^\d+$/.test(codigo) || !/^\d+$/.test(lote) || !/^\d+$/.test(caja) || !/^\d+(\.\d{1,2})?$/.test(kilos)) {
    return null;
  }
  return { codigo, lote, caja: Number(caja), kilos: Number(kilos) };
}

module.exports = { buildBarcode, parseBarcode };
