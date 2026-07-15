import { useEffect, useMemo, useState } from 'react';
import { canalesApi, entradasApi, movimientosApi } from '../api/services';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { todayISO, formatDateMX, formatNumber } from '../lib/date';
import {
  Banner,
  Button,
  Card,
  Field,
  Input,
  JustificacionModal,
  Modal,
  PageHeader,
  Pill,
  Select,
  Table,
  Textarea,
} from '../components/ui';

const emptyForm = {
  fecha: todayISO(),
  tipo_movimiento: 'salida',
  lote_num: '',
  tipo_ganado: '',
  codigo: '',
  producto: '',
  cajas: '',
  kilos: '',
  motivo: 'otro',
  observaciones: '',
};

const ESTADO_TONE = { pendiente: 'orange', autorizado: 'green', rechazado: 'gray' };
const TIPO_TONE = { entrada: 'blue', salida: 'purple' };

export default function MovimientosInventario() {
  const { user } = useAuth();
  const esAdmin = user?.rol === 'admin';
  const toast = useToast();

  const [tiposGanado, setTiposGanado] = useState([]);
  const [productos, setProductos] = useState([]);
  const [motivos, setMotivos] = useState([]);
  const [tiposMovimiento, setTiposMovimiento] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [pendientes, setPendientes] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [filtros, setFiltros] = useState({ fecha_inicio: '', fecha_fin: todayISO(), estado: '', tipo_movimiento: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [movAEliminar, setMovAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const [movAEditar, setMovAEditar] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editJustificacion, setEditJustificacion] = useState('');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  const [movARechazar, setMovARechazar] = useState(null);
  const [rechazando, setRechazando] = useState(false);

  const [movAAutorizar, setMovAAutorizar] = useState(null);
  const [comentarioAutorizar, setComentarioAutorizar] = useState('');
  const [autorizando, setAutorizando] = useState(false);

  useEffect(() => {
    canalesApi.tiposGanado().then(setTiposGanado).catch(() => setTiposGanado([]));
    entradasApi.productos().then(setProductos).catch(() => setProductos([]));
    movimientosApi.motivos().then(setMotivos).catch(() => setMotivos(['otro']));
    movimientosApi.tiposMovimiento().then(setTiposMovimiento).catch(() => setTiposMovimiento(['entrada', 'salida']));
  }, []);

  function buscar() {
    setLoading(true);
    movimientosApi.list(filtros).then(setMovimientos).finally(() => setLoading(false));
  }

  useEffect(buscar, []);

  const puedeAgregar = form.lote_num && form.codigo && form.cajas !== '' && form.kilos !== '';

  function onProductoChange(codigo) {
    const p = productos.find((x) => x.codigo === codigo);
    setForm({ ...form, codigo, producto: p?.nombre || '' });
  }

  function agregar() {
    if (!puedeAgregar) return;
    setPendientes((prev) => [...prev, { ...form, cajas: Number(form.cajas), kilos: Number(form.kilos) }]);
    setForm({ ...emptyForm, fecha: form.fecha, tipo_movimiento: form.tipo_movimiento, motivo: form.motivo });
  }

  function quitarPendiente(i) {
    setPendientes((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function guardar() {
    if (!pendientes.length) return;
    setSaving(true);
    try {
      const saved = await movimientosApi.create(pendientes);
      toast(`${saved.length} movimiento(s) solicitado(s) — pendiente(s) de autorización`);
      setPendientes([]);
      buscar();
    } catch (err) {
      toast(err.response?.data?.error || 'No se pudieron solicitar los movimientos', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function confirmarEliminar(justificacion) {
    if (!movAEliminar) return;
    setEliminando(true);
    try {
      await movimientosApi.remove(movAEliminar, justificacion);
      setMovimientos((prev) => prev.filter((m) => m.id !== movAEliminar));
      toast('Movimiento eliminado');
      setMovAEliminar(null);
    } catch (err) {
      toast(err.response?.data?.error || 'No se pudo eliminar', 'error');
    } finally {
      setEliminando(false);
    }
  }

  function abrirEdicion(mov) {
    setMovAEditar(mov);
    setEditForm({
      fecha: mov.fecha?.slice(0, 10) || mov.fecha,
      tipo_movimiento: mov.tipo_movimiento,
      lote_num: mov.lote_num || '',
      tipo_ganado: mov.tipo_ganado || '',
      codigo: mov.codigo || '',
      producto: mov.producto || '',
      cajas: mov.cajas,
      kilos: mov.kilos,
      motivo: mov.motivo,
      observaciones: mov.observaciones || '',
    });
    setEditJustificacion('');
  }

  async function guardarEdicion() {
    if (!movAEditar || !editJustificacion.trim()) return;
    setGuardandoEdicion(true);
    try {
      const actualizado = await movimientosApi.update(movAEditar.id, { ...editForm, justificacion: editJustificacion.trim() });
      setMovimientos((prev) => prev.map((m) => (m.id === actualizado.id ? actualizado : m)));
      toast('Movimiento actualizado');
      setMovAEditar(null);
    } catch (err) {
      toast(err.response?.data?.error || 'No se pudo actualizar', 'error');
    } finally {
      setGuardandoEdicion(false);
    }
  }

  async function confirmarRechazo(comentario) {
    if (!movARechazar) return;
    setRechazando(true);
    try {
      const actualizado = await movimientosApi.rechazar(movARechazar, comentario);
      setMovimientos((prev) => prev.map((m) => (m.id === actualizado.id ? actualizado : m)));
      toast('Movimiento rechazado');
      setMovARechazar(null);
    } catch (err) {
      toast(err.response?.data?.error || 'No se pudo rechazar', 'error');
    } finally {
      setRechazando(false);
    }
  }

  async function confirmarAutorizacion() {
    if (!movAAutorizar) return;
    setAutorizando(true);
    try {
      const actualizado = await movimientosApi.autorizar(movAAutorizar, comentarioAutorizar.trim());
      setMovimientos((prev) => prev.map((m) => (m.id === actualizado.id ? actualizado : m)));
      toast('Movimiento autorizado');
      setMovAAutorizar(null);
      setComentarioAutorizar('');
    } catch (err) {
      toast(err.response?.data?.error || 'No se pudo autorizar', 'error');
    } finally {
      setAutorizando(false);
    }
  }

  const totalCajas = useMemo(() => movimientos.reduce((s, m) => s + Number(m.cajas || 0), 0), [movimientos]);
  const totalKilos = useMemo(() => movimientos.reduce((s, m) => s + Number(m.kilos || 0), 0), [movimientos]);
  const pendientesCount = useMemo(() => movimientos.filter((m) => m.estado === 'pendiente').length, [movimientos]);

  return (
    <div>
      <PageHeader
        title="Movimientos de inventario"
        subtitle="Entradas o salidas de ajuste (merma, decomiso, corrección) — requieren autorización de oficina"
      />

      <Card className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Fecha">
            <Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </Field>
          <Field label="Tipo de movimiento">
            <Select value={form.tipo_movimiento} onChange={(e) => setForm({ ...form, tipo_movimiento: e.target.value })}>
              {tiposMovimiento.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
            </Select>
          </Field>
          <Field label="Lote">
            <Input value={form.lote_num} onChange={(e) => setForm({ ...form, lote_num: e.target.value })} placeholder="717" />
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
          <Field label="Motivo">
            <Select value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })}>
              {motivos.map((m) => <option key={m} value={m} className="capitalize">{m}</option>)}
            </Select>
          </Field>
          <Field label="Observaciones">
            <Textarea rows={1} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Opcional…" />
          </Field>
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant={puedeAgregar ? 'primary' : 'soft'} disabled={!puedeAgregar} onClick={agregar}>
            + Agregar
          </Button>
          <Button variant={pendientes.length ? 'blue' : 'soft'} disabled={!pendientes.length || saving} onClick={guardar}>
            {saving ? 'Solicitando…' : '📨 Solicitar autorización'}
          </Button>
        </div>

        {pendientes.length > 0 && (
          <div className="mt-4">
            <Banner tone="yellow" title={`Pendientes de solicitar (${pendientes.length})`}>
              <Pill tone="blue">Cajas: {pendientes.reduce((s, p) => s + p.cajas, 0)}</Pill>
              <Pill tone="purple">Kilos: {formatNumber(pendientes.reduce((s, p) => s + p.kilos, 0), 2)}</Pill>
            </Banner>
            <div className="mt-2 flex flex-wrap gap-2">
              {pendientes.map((p, i) => (
                <span key={i} className="inline-flex items-center gap-2 rounded-full bg-cream-200 px-3 py-1 text-xs">
                  {p.tipo_movimiento === 'entrada' ? '⬆️' : '⬇️'} {p.lote_num} · {p.producto} · {p.motivo}
                  <button onClick={() => quitarPendiente(i)} className="text-red-500">&times;</button>
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <Field label="Desde">
          <Input type="date" value={filtros.fecha_inicio} onChange={(e) => setFiltros({ ...filtros, fecha_inicio: e.target.value })} />
        </Field>
        <Field label="Hasta">
          <Input type="date" value={filtros.fecha_fin} onChange={(e) => setFiltros({ ...filtros, fecha_fin: e.target.value })} />
        </Field>
        <Field label="Estado">
          <Select value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="autorizado">Autorizado</option>
            <option value="rechazado">Rechazado</option>
          </Select>
        </Field>
        <Field label="Tipo">
          <Select value={filtros.tipo_movimiento} onChange={(e) => setFiltros({ ...filtros, tipo_movimiento: e.target.value })}>
            <option value="">Todos</option>
            {tiposMovimiento.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
          </Select>
        </Field>
        <Button variant="outline" onClick={buscar}>Filtrar</Button>
      </div>

      <Card className="mt-2 p-4">
        <div className="mb-3 flex gap-2">
          <Pill tone="gray">Registros: {movimientos.length}</Pill>
          <Pill tone="blue">Cajas: {totalCajas}</Pill>
          <Pill tone="purple">Kilos: {formatNumber(totalKilos, 2)}</Pill>
          {pendientesCount > 0 && <Pill tone="orange">Pendientes de autorizar: {pendientesCount}</Pill>}
        </div>
        <Table
          columns={['Fecha', 'Tipo', 'Lote', 'Producto', 'Cajas', 'Kilos', 'Motivo', 'Obs.', 'Estado', '']}
          empty={!loading && movimientos.length === 0 ? 'Sin movimientos para estos filtros' : null}
        >
          {movimientos.map((m) => (
            <tr key={m.id}>
              <td className="px-3 py-2 whitespace-nowrap">{formatDateMX(m.fecha)}</td>
              <td className="px-3 py-2"><Pill tone={TIPO_TONE[m.tipo_movimiento]}>{m.tipo_movimiento}</Pill></td>
              <td className="px-3 py-2">{m.lote_num}</td>
              <td className="px-3 py-2">{m.producto}</td>
              <td className="px-3 py-2">{m.cajas}</td>
              <td className="px-3 py-2">{formatNumber(m.kilos, 2)}</td>
              <td className="px-3 py-2 capitalize">{m.motivo}</td>
              <td className="px-3 py-2 max-w-[160px] truncate" title={m.observaciones}>{m.observaciones || '—'}</td>
              <td className="px-3 py-2">
                <Pill tone={ESTADO_TONE[m.estado]}>{m.estado}</Pill>
                {m.estado !== 'pendiente' && m.comentario_autorizacion && (
                  <p className="mt-1 max-w-[160px] truncate text-xs text-ink-400" title={m.comentario_autorizacion}>
                    {m.comentario_autorizacion}
                  </p>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-2">
                  {esAdmin && m.estado === 'pendiente' && (
                    <>
                      <button onClick={() => setMovAAutorizar(m.id)} className="text-emerald-600 hover:text-emerald-800">Autorizar</button>
                      <button onClick={() => setMovARechazar(m.id)} className="text-red-500 hover:text-red-700">Rechazar</button>
                    </>
                  )}
                  {m.estado === 'pendiente' && (
                    <button onClick={() => abrirEdicion(m)} className="text-blue-600 hover:text-blue-800">Editar</button>
                  )}
                  <button onClick={() => setMovAEliminar(m.id)} className="text-red-500 hover:text-red-700">Eliminar</button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <JustificacionModal
        open={!!movAEliminar}
        title="Justifica la eliminación de este movimiento"
        confirmando={eliminando}
        onCancel={() => setMovAEliminar(null)}
        onConfirm={confirmarEliminar}
      />

      <JustificacionModal
        open={!!movARechazar}
        title="Motivo del rechazo"
        confirmando={rechazando}
        onCancel={() => setMovARechazar(null)}
        onConfirm={confirmarRechazo}
      />

      <Modal open={!!movAAutorizar} onClose={() => setMovAAutorizar(null)} title="Autorizar movimiento">
        <p className="mb-2 text-sm text-ink-500">Puedes agregar un comentario opcional (quedará en la bitácora).</p>
        <Textarea rows={2} value={comentarioAutorizar} onChange={(e) => setComentarioAutorizar(e.target.value)} placeholder="Comentario opcional…" />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setMovAAutorizar(null)}>Cancelar</Button>
          <Button variant="blue" disabled={autorizando} onClick={confirmarAutorizacion}>
            {autorizando ? 'Autorizando…' : 'Confirmar autorización'}
          </Button>
        </div>
      </Modal>

      <Modal open={!!movAEditar} onClose={() => setMovAEditar(null)} title="Editar movimiento" width="max-w-lg">
        {editForm && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de movimiento">
                <Select value={editForm.tipo_movimiento} onChange={(e) => setEditForm({ ...editForm, tipo_movimiento: e.target.value })}>
                  {tiposMovimiento.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
                </Select>
              </Field>
              <Field label="Motivo">
                <Select value={editForm.motivo} onChange={(e) => setEditForm({ ...editForm, motivo: e.target.value })}>
                  {motivos.map((m) => <option key={m} value={m} className="capitalize">{m}</option>)}
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
            <Field label="Observaciones">
              <Textarea rows={2} value={editForm.observaciones} onChange={(e) => setEditForm({ ...editForm, observaciones: e.target.value })} />
            </Field>
            <Field label="Justificación del cambio (obligatoria)">
              <Textarea rows={2} value={editJustificacion} onChange={(e) => setEditJustificacion(e.target.value)} placeholder="Motivo de la corrección…" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMovAEditar(null)}>Cancelar</Button>
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
