export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDateMX(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

export function formatNumber(value, decimals = 0) {
  const n = Number(value || 0);
  return n.toLocaleString('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// El tipo de ganado puede faltar en cajas de inventario inicial cuyo origen
// no se conoce — se identifica siempre como "SIN DATO" en vez de un espacio
// en blanco.
export function formatTipoGanado(value) {
  return value || 'SIN DATO';
}
