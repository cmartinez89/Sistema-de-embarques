// Integración opcional con Zebra Browser Print (utilidad de Zebra que corre
// localmente en la máquina del operador, junto a una impresora conectada por
// USB) para imprimir el ZPL de una etiqueta con un clic, sin pasos manuales.
//
// Si la utilidad no está instalada/corriendo en esa máquina, todo esto falla
// silenciosamente y el llamador debe caer a copiar/descargar el ZPL (mismo
// mecanismo que ya existe hoy en la pantalla de Etiquetas).

const SDK_URL = 'http://127.0.0.1:9100/BrowserPrint-3.0.216.min.js';
const LOAD_TIMEOUT_MS = 1500;

let sdkLoadPromise = null;

function cargarSDK() {
  if (window.BrowserPrint) return Promise.resolve(true);
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), LOAD_TIMEOUT_MS);
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.onload = () => {
      clearTimeout(timeout);
      resolve(!!window.BrowserPrint);
    };
    script.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return sdkLoadPromise;
}

export async function browserPrintDisponible() {
  try {
    return await cargarSDK();
  } catch {
    return false;
  }
}

// Intenta imprimir el ZPL directo en la impresora Zebra por defecto.
// Regresa true si se envió correctamente, false si no se pudo (sin lanzar error).
export async function imprimirZPL(zpl) {
  const disponible = await browserPrintDisponible();
  if (!disponible) return false;

  return new Promise((resolve) => {
    try {
      window.BrowserPrint.getDefaultDevice(
        'printer',
        (device) => {
          if (!device) return resolve(false);
          device.send(
            zpl,
            () => resolve(true),
            () => resolve(false)
          );
        },
        () => resolve(false)
      );
    } catch {
      resolve(false);
    }
  });
}
