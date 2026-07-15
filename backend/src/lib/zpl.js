const { buildBarcode } = require('./barcode');

// Genera ZPL para impresora Zebra
// Tamaño típico etiqueta carne: 4" x 2" (812 x 406 dots a 203dpi)
function renderZplEtiqueta({ lote, codigo, caja, kilos, producto, fecha, romaneaje }) {
  const barcode = buildBarcode({ codigo, lote, caja, kilos });
  return [
    '^XA',
    '^MMT',
    '^PW812',          // ancho 4"
    '^LL0406',         // alto 2"
    '^LS0',
    // Nombre empresa
    '^FO30,20^A0N,28,28^FDEmpacadora Carnes Finas el Anden^FS',
    // TIF
    '^FO30,52^A0N,18,18^FDTIF No. 680 - SAGARPA Mexico^FS',
    // Línea separadora
    '^FO30,75^GB752,2,2^FS',
    // Producto
    `^FO30,85^A0N,24,24^FD${producto}^FS`,
    // Lote + fecha
    `^FO30,115^A0N,20,20^FDLote: ${lote}   Fecha: ${fecha}^FS`,
    // Romaneaje
    romaneaje ? `^FO30,140^A0N,18,18^FDRomaneaje: ${romaneaje}^FS` : '',
    // Kilos
    `^FO580,85^A0N,30,30^FD${kilos} kg^FS`,
    // Línea separadora
    '^FO30,168^GB752,2,2^FS',
    // Código de barras Code128
    `^FO30,180^BCN,100,N,N,N^FD${barcode}^FS`,
    // Texto del código bajo el barcode
    `^FO30,290^A0N,20,20^FD${barcode}^FS`,
    // Número de caja
    `^FO580,290^A0N,20,20^FDCaja: ${caja}^FS`,
    '^XZ',
  ].filter(Boolean).join('\n');
}

module.exports = { renderZplEtiqueta };
