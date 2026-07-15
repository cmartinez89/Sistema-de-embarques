import client from './client';

export const authApi = {
  me: () => client.get('/auth/me').then((r) => r.data),
};

export const canalesApi = {
  getLotes: () => client.get('/canales/lotes').then((r) => r.data),
  getLote: (id) => client.get(`/canales/lotes/${id}`).then((r) => r.data),
  createLote: (lote) => client.post('/canales/lotes', lote).then((r) => r.data),
  siguienteNumeroLote: () => client.get('/canales/lotes/siguiente-numero').then((r) => r.data),
  getByLote: (lote_id) => client.get('/canales', { params: { lote_id } }).then((r) => r.data),
  create: (canales) => client.post('/canales', canales).then((r) => r.data),
  update: (id, payload) => client.put(`/canales/${id}`, payload).then((r) => r.data),
  remove: (id, justificacion) => client.delete(`/canales/${id}`, { data: { justificacion } }).then((r) => r.data),
  tiposGanado: () => client.get('/canales/tipos-ganado').then((r) => r.data),
  subirRomaneajePdf: (loteId, file) => {
    const formData = new FormData();
    formData.append('pdf', file);
    return client
      .post(`/canales/lotes/${loteId}/romaneaje-pdf`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data);
  },
  verRomaneajePdf: (loteId) => client.get(`/canales/lotes/${loteId}/romaneaje-pdf`, { responseType: 'blob' }).then((r) => r.data),
};

export const entradasApi = {
  productos: () => client.get('/entradas/productos').then((r) => r.data),
  list: (params) => client.get('/entradas', { params }).then((r) => r.data),
  create: (entradas) => client.post('/entradas', entradas).then((r) => r.data),
  remove: (id, justificacion) => client.delete(`/entradas/${id}`, { data: { justificacion } }).then((r) => r.data),
  siguienteCaja: (params) => client.get('/entradas/siguiente-caja', { params }).then((r) => r.data),
  registrarCaja: (payload) => client.post('/entradas/caja', payload).then((r) => r.data),
};

export const salidasApi = {
  siguienteFolio: () => client.get('/salidas/folio/siguiente').then((r) => r.data),
  list: (params) => client.get('/salidas', { params }).then((r) => r.data),
  create: (salidas) => client.post('/salidas', salidas).then((r) => r.data),
  update: (id, payload) => client.put(`/salidas/${id}`, payload).then((r) => r.data),
  remove: (id) => client.delete(`/salidas/${id}`).then((r) => r.data),
};

export const existenciasApi = {
  list: (params) => client.get('/existencias', { params }).then((r) => r.data),
};

export const etiquetasApi = {
  zpl: (payload) => client.post('/etiquetas/zpl', payload).then((r) => r.data),
  zplBatch: (etiquetas) => client.post('/etiquetas/zpl-batch', { etiquetas }).then((r) => r.data),
  buscar: (params) => client.get('/etiquetas', { params }).then((r) => r.data),
  reimprimir: (id) => client.put(`/etiquetas/${id}/reimprimir`).then((r) => r.data),
  remove: (id, justificacion) => client.delete(`/etiquetas/${id}`, { data: { justificacion } }).then((r) => r.data),
};

export const clientesApi = {
  list: () => client.get('/clientes').then((r) => r.data),
  create: (cliente) => client.post('/clientes', cliente).then((r) => r.data),
  update: (id, cliente) => client.put(`/clientes/${id}`, cliente).then((r) => r.data),
  remove: (id) => client.delete(`/clientes/${id}`).then((r) => r.data),
};

export const productosApi = {
  list: () => client.get('/productos').then((r) => r.data),
  tiposGanado: () => client.get('/productos/tipos-ganado').then((r) => r.data),
  create: (producto) => client.post('/productos', producto).then((r) => r.data),
  update: (id, producto) => client.put(`/productos/${id}`, producto).then((r) => r.data),
  remove: (id) => client.delete(`/productos/${id}`).then((r) => r.data),
};

export const movimientosApi = {
  motivos: () => client.get('/movimientos/motivos').then((r) => r.data),
  tiposMovimiento: () => client.get('/movimientos/tipos-movimiento').then((r) => r.data),
  list: (params) => client.get('/movimientos', { params }).then((r) => r.data),
  create: (movimientos) => client.post('/movimientos', movimientos).then((r) => r.data),
  update: (id, payload) => client.put(`/movimientos/${id}`, payload).then((r) => r.data),
  remove: (id, justificacion) => client.delete(`/movimientos/${id}`, { data: { justificacion } }).then((r) => r.data),
  autorizar: (id, comentario) => client.put(`/movimientos/${id}/autorizar`, { comentario }).then((r) => r.data),
  rechazar: (id, comentario) => client.put(`/movimientos/${id}/rechazar`, { comentario }).then((r) => r.data),
};

export const bitacoraApi = {
  list: (params) => client.get('/bitacora', { params }).then((r) => r.data),
  tablas: () => client.get('/bitacora/tablas').then((r) => r.data),
  acciones: () => client.get('/bitacora/acciones').then((r) => r.data),
};

export const reportesApi = {
  entradas: (params) => client.get('/reportes/entradas', { params }).then((r) => r.data),
  salidas: (params) => client.get('/reportes/salidas', { params }).then((r) => r.data),
  movimientos: (params) => client.get('/reportes/movimientos', { params }).then((r) => r.data),
  existencias: (params) => client.get('/reportes/existencias', { params }).then((r) => r.data),
  canales: (params) => client.get('/reportes/canales', { params }).then((r) => r.data),
};
