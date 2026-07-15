import { useEffect, useMemo, useState } from 'react';
import { canalesApi, clientesApi, entradasApi, salidasApi } from '../api/services';
import { useToast } from '../context/ToastContext';
import { todayISO, formatDateMX, formatNumber } from '../lib/date';
import { Banner, Button, Card, Field, Input, Modal, PageHeader, Pill, Select, Table, Textarea } from '../components/ui';

const emptyForm = {
  fecha: todayISO(),
  cliente_id: '',
  lote_canal: '',
  tipo_ganado: '',
  codigo: '',
  producto: '',
  cajas: '',
  kilos: '',
  entregado_por: '',
  observaciones: '',
};

export default function Salidas() {
  const toast = useToast();
  const [clientes, setClientes] = useState([]);
  const [tiposGanado, setTiposGanado] = useState([]);
  const [productos, setProductos] = useState([]);
  const [folio, setFolio] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [pendientes, setPendientes] = useState([]);
  const [salidas, setSalidas] = useState([]);
  const [fechaFiltro, setFechaFiltro] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [salidaAEditar, setSalidaAEditar] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editJustificacion, setEditJustificacion] = useState('');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  useEffect(() => {
    clientesApi.list().then((cs) => setClientes(cs.filter((c) => c.activo))).catch(() => setClientes([]));
    canalesApi.tiposGanado().then(setTiposGanado).catch(() => setTiposGanado([]));
    entradasApi.productos().then(setProductos).catch(() => setProductos([]));
    salidasApi.siguienteFolio().then((r) => setFolio(r.siguiente)).catch(() => setFolio(1));
  }, []);

  useEffect(() => {
    setLoading(true);
    salidasApi.list({ fecha: fechaFiltro }).then(setSalidas).finally(() => setLoading(false));
  }, [fechaFiltro]);

  const puedeAgregar = form.cliente_id && form.lote_canal && form.codigo && form.cajas !== '' && form.kilos !== '';

  function onProductoChange(codigo) {
    const p = productos.find((x) => x.codigo === codigo);
    setForm({ ...form, codigo, producto: p?.nombre || '' });
  }

  function agregar() {
    if (!puedeAgregar) return;
    const cliente = clientes.find((c) => String(c.id) === String(form.cliente_id));
    setPendientes((prev) => [
      ...prev,
      {
        ...form,
        folio,
        cliente_nombre: cliente?.nombre || '',
        cajas: Number(form.cajas),
        kilos: Number(form.kilos),
      },
    ]);
    setForm({ ...emptyForm, fecha: form.fecha, cliente_id: form.cliente_id, entregado_por: form.entregado_por });
  }

  function quitarPendiente(i) {
    setPendientes((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function guardar() {
    if (!pendientes.length) return;
    setSaving(true);
    try {
      const saved = await salidasApi.create(pendientes);
      toast(`${saved.length} salida(s) guardada(s)`);
      setPendientes([]);
      const nextFolio = await salidasApi.siguienteFolio();
      setFolio(nextFolio.siguiente);
      if (form.fecha === fechaFiltro) {
        setSalidas((prev) => [...saved, ...prev]);
      }
    } catch (err) {
      toast(err.response?.data?.error || 'No se pudieron guardar las salidas', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(id) {
    try {
      await salidasApi.remove(id);
      setSalidas((prev) => prev.filter((s) => s.id !== id));
      toast('Salida eliminada');
    } catch {
      toast('No se pudo eliminar', 'error');
    }
  }

  function abrirEdicion(s) {
    setSalidaAEditar(s);
    setEditForm({
      cliente_id: s.cliente_id,
      cliente_nombre: s.cliente_nombre,
      lote_canal: s.lote_canal || '',
      tipo_ganado: s.tipo_ganado || '',
      codigo: s.codigo || '',
      producto: s.producto || '',
      cajas: s.cajas,
      kilos: s.kilos,
      entregado_por: s.entregado_por || '',
      observaciones: s.observaciones || '',
    });
    setEditJustificacion('');
  }

  function onEditClienteChange(clienteId) {
    const cliente = clientes.find((c) => String(c.id) === String(clienteId));
    setEditForm({ ...editForm, cliente_id: clienteId, cliente_nombre: cliente?.nombre || '' });
  }

  function onEditProductoChange(codigo) {
    const p = productos.find((x) => x.codigo === codigo);
    setEditForm({ ...editForm, codigo, producto: p?.nombre || '' });
  }

  async function guardarEdicion() {
    if (!salidaAEditar || !editJustificacion.trim()) return;
    setGuardandoEdicion(true);
    try {
      const actualizada = await salidasApi.update(salidaAEditar.id, { ...editForm, justificacion: editJustificacion.trim() });
      setSalidas((prev) => prev.map((s) => (s.id === actualizada.id ? actualizada : s)));
      toast('Salida actualizada');
      setSalidaAEditar(null);
    } catch (err) {
      toast(err.response?.data?.error || 'No se pudo actualizar', 'error');
    } finally {
      setGuardandoEdicion(false);
    }
  }

  const totalCajas = useMemo(() => salidas.reduce((s, x) => s + Number(x.cajas || 0), 0), [salidas]);
  const totalKilos = useMemo(() => salidas.reduce((s, x) => s + Number(x.kilos || 0), 0), [salidas]);

  return (
    <div>
      <PageHeader title="Salidas" subtitle={`Registro de salidas de producto — Folio siguiente: ${folio ?? '—'}`} />

      <Card className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Fecha">
            <Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </Field>
          <Field label="Cliente">
            <Select value={form.cliente_id} onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}>
              <option value="">Selecciona…</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Select>
          </Field>
          <Field label="Lote / Canal">
            <Input value={form.lote_canal} onChange={(e) => setForm({ ...form, lote_canal: e.target.value })} placeholder="717" />
          </Field>
          <Field label="Tipo de ganado">
            <Select value={form.tipo_ganado} onChange={(e) => setForm({ ...form, tipo_ganado: e.target.value })}>
              <option value="">Selecciona…</option>
              {tiposGanado.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Producto">
            <Select value={form.codigo} onChange={(e) => onProductoChange(e.target.value)}>
              <option value="">Selecciona…</option>
              {productos.map((p) => <option key={p.codigo} value={p.codigo}>{p.codigo} — {p.nombre}</option>)}
            </Select>
          </Field>
          <Field label="Cajas">
            <Input type="number" value={form.cajas} onChange={(e) => setForm({ ...form, cajas: e.target.value })} placeholder="0" />
          </Field>
          <Field label="Kilos">
            <Input type="number" step="0.01" value={form.kilos} onChange={(e) => setForm({ ...form, kilos: e.target.value })} placeholder="0.00" />
          </Field>
          <Field label="Entregado por">
            <Input value={form.entregado_por} onChange={(e) => setForm({ ...form, entregado_por: e.target.value })} placeholder="Nombre" />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Observaciones">
            <Textarea rows={2} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Opcional…" />
          </Field>
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant={puedeAgregar ? 'primary' : 'soft'} disabled={!puedeAgregar} onClick={agregar}>
            + Agregar
          </Button>
          <Button variant={pendientes.length ? 'blue' : 'soft'} disabled={!pendientes.length || saving} onClick={guardar}>
            {saving ? 'Guardando…' : '💾 Guardar'}
          </Button>
        </div>

        {pendientes.length > 0 && (
          <div className="mt-4">
            <Banner tone="yellow" title={`Pendientes de guardar (${pendientes.length})`}>
              <Pill tone="blue">Cajas: {pendientes.reduce((s, p) => s + p.cajas, 0)}</Pill>
              <Pill tone="purple">Kilos: {formatNumber(pendientes.reduce((s, p) => s + p.kilos, 0), 2)}</Pill>
            </Banner>
            <div className="mt-2 flex flex-wrap gap-2">
              {pendientes.map((p, i) => (
                <span key={i} className="inline-flex items-center gap-2 rounded-full bg-cream-200 px-3 py-1 text-xs">
                  {p.cliente_nombre} · {p.producto} · {p.cajas}c / {p.kilos}kg
                  <button onClick={() => quitarPendiente(i)} className="text-red-500">&times;</button>
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-700">Salidas registradas</p>
        <Field label="">
          <Input type="date" value={fechaFiltro} onChange={(e) => setFechaFiltro(e.target.value)} />
        </Field>
      </div>

      <Card className="mt-2 p-4">
        <div className="mb-3 flex gap-2">
          <Pill tone="gray">Registros: {salidas.length}</Pill>
          <Pill tone="blue">Cajas: {totalCajas}</Pill>
          <Pill tone="purple">Kilos: {formatNumber(totalKilos, 2)}</Pill>
        </div>
        <Table
          columns={['Folio', 'Fecha', 'Cliente', 'Lote/Canal', 'Producto', 'Cajas', 'Kilos', 'Entregó', 'Obs.', '']}
          empty={!loading && salidas.length === 0 ? 'Sin salidas para esta fecha' : null}
        >
          {salidas.map((s) => (
            <tr key={s.id}>
              <td className="px-3 py-2">{s.folio}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatDateMX(s.fecha)}</td>
              <td className="px-3 py-2">{s.cliente_nombre}</td>
              <td className="px-3 py-2">{s.lote_canal}</td>
              <td className="px-3 py-2">{s.producto}</td>
              <td className="px-3 py-2">{s.cajas}</td>
              <td className="px-3 py-2">{formatNumber(s.kilos, 2)}</td>
              <td className="px-3 py-2">{s.entregado_por}</td>
              <td className="px-3 py-2 max-w-[160px] truncate" title={s.observaciones}>{s.observaciones || '—'}</td>
              <td className="px-3 py-2">
                <div className="flex gap-3">
                  <button onClick={() => abrirEdicion(s)} className="text-blue-600 hover:text-blue-800">Editar</button>
                  <button onClick={() => eliminar(s.id)} className="text-red-500 hover:text-red-700">Eliminar</button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal open={!!salidaAEditar} onClose={() => setSalidaAEditar(null)} title={`Editar salida — Folio ${salidaAEditar?.folio ?? ''}`} width="max-w-lg">
        {editForm && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cliente">
                <Select value={editForm.cliente_id} onChange={(e) => onEditClienteChange(e.target.value)}>
                  <option value="">Selecciona…</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </Select>
              </Field>
              <Field label="Lote / Canal">
                <Input value={editForm.lote_canal} onChange={(e) => setEditForm({ ...editForm, lote_canal: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de ganado">
                <Select value={editForm.tipo_ganado} onChange={(e) => setEditForm({ ...editForm, tipo_ganado: e.target.value })}>
                  <option value="">Selecciona…</option>
                  {tiposGanado.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="Producto">
                <Select value={editForm.codigo} onChange={(e) => onEditProductoChange(e.target.value)}>
                  <option value="">Selecciona…</option>
                  {productos.map((p) => <option key={p.codigo} value={p.codigo}>{p.codigo} — {p.nombre}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cajas">
                <Input type="number" value={editForm.cajas} onChange={(e) => setEditForm({ ...editForm, cajas: e.target.value })} />
              </Field>
              <Field label="Kilos">
                <Input type="number" step="0.01" value={editForm.kilos} onChange={(e) => setEditForm({ ...editForm, kilos: e.target.value })} />
              </Field>
            </div>
            <Field label="Entregado por">
              <Input value={editForm.entregado_por} onChange={(e) => setEditForm({ ...editForm, entregado_por: e.target.value })} />
            </Field>
            <Field label="Observaciones">
              <Textarea rows={2} value={editForm.observaciones} onChange={(e) => setEditForm({ ...editForm, observaciones: e.target.value })} />
            </Field>
            <Field label="Justificación del cambio (obligatoria)">
              <Textarea rows={2} value={editJustificacion} onChange={(e) => setEditJustificacion(e.target.value)} placeholder="Motivo de la corrección…" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSalidaAEditar(null)}>Cancelar</Button>
              <Button variant="blue" disabled={!editJustificacion.trim() || guardandoEdicion} onClick={guardarEdicion}>
                {guardandoEdicion ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
