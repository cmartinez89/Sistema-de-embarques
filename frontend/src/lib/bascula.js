// Integración con básculas conectadas por puerto serial, vía Web Serial API
// (Chrome/Edge — requiere contexto seguro: HTTPS o localhost). No hay un
// protocolo único entre básculas, así que el peso se extrae con un patrón
// (regex) configurable desde la pantalla de Báscula, con algunos presets de
// formatos comunes como punto de partida.

const STORAGE_KEY = 'bascula_config_v1';

export const CONFIG_BASCULA_DEFAULT = {
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  patron: String.raw`(-?\d+\.\d+)`,
};

export const PRESETS_BASCULA = [
  { id: 'numero_simple', nombre: 'Número simple (12.50)', patron: String.raw`(-?\d+\.\d+)` },
  { id: 'con_signo_unidad', nombre: 'Con signo y unidad (+0012.50 kg)', patron: String.raw`([+-]?\d+\.\d+)\s*(?:kg|Kg|KG)?` },
  { id: 'cas_toledo', nombre: 'Trama tipo CAS/Toledo (ST,GS,+0000.00,kg)', patron: String.raw`[A-Za-z]{2},[A-Za-z]{2},([+-]?\d+\.?\d*)` },
];

export function basculaDisponible() {
  return typeof navigator !== 'undefined' && !!navigator.serial;
}

export function cargarConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...CONFIG_BASCULA_DEFAULT, ...JSON.parse(raw) } : { ...CONFIG_BASCULA_DEFAULT };
  } catch {
    return { ...CONFIG_BASCULA_DEFAULT };
  }
}

export function guardarConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch { /* almacenamiento no disponible */ }
}

// Aplica el patrón a una línea cruda y regresa el número de peso (o null si
// no matchea o el patrón es inválido).
export function extraerPeso(linea, patron) {
  try {
    const re = new RegExp(patron);
    const match = linea.match(re);
    if (!match || match[1] === undefined) return null;
    const valor = Number(match[1]);
    return Number.isNaN(valor) ? null : valor;
  } catch {
    return null;
  }
}
