import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { canalesApi, clientesApi, entradasApi, salidasApi } from '../api/services';
import { useToast } from '../context/ToastContext';
import { todayISO, formatDateMX, formatNumber } from '../lib/date';
import { Button, Card, Field, Input, Modal, PageHeader, Pill, Select, Table, Textarea } from '../components/ui';

const emptyForm = {
  fecha: todayISO(),
  entregado_por: '',
  observaciones: '',
};

export default function SalidaCaptura() {
  const { id } = useParams();
  const esNuevo = id === 'nuevo';
  const navigate = useNavigate();
  const toast = useToast();

  const [clientes, setClientes] = useState([]);
  const [tiposGanado, setTiposGanado] = useState([]);
  const [productos, setProductos] = useState([]);
  const [folio, setFolio] = useState(null);
  const [clienteId, setClienteId] = useState('');
  const [loadingInicial, setLoadingInicial] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [cajaTexto, setCajaTexto] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [salidas, setSalidas] = useState([]);
  const [salidaAEditar, setSalidaAEditar] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editJustificacion, setEditJustificacion] = useState('');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  const cajaRef = useRef(null);

  function volver() {
    navigate('/salidas');
  }

  useEffect(() => {
    clientesApi.list().then((cs) => setClientes(cs.filter((c) => c.activo))).catch(() => setClientes([]));
    canalesApi.tiposGanado().then(setTiposGanado).catch(() => setTiposGanado([]));
    entradasApi.productos().then(setProductos).catch(() => setProductos([]));
  }, []);

  useEffect(() => {
    setLoadingInicial(true);
    if (esNuevo) {
      salidasApi.siguienteFolio().then((r) => setFolio(r.siguiente)).catch(() => setFolio(1));
      setClienteId('');
      setForm(emptyForm);
      setSalidas([]);
      setLoadingInicial(false);
      return;
    }
    const folioNum = Number(id);
    setFolio(folioNum);
    salidasApi.list({ folio: folioNum })
      .then((rows) => {
        if (!rows.length) {
          toast('Folio no encontrado', 'error');
          navigate('/salidas');
          return;
        }
        setSalidas(rows);
        setClienteId(String(rows[0].cliente_id));
        setForm((f) => ({ ...f, entregado_por: rows[0].entregado_por || '', observaciones: rows[0].observaciones || '' }));
      })
      .finally(() => setLoadingInicial(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const cliente = useMemo(() => clientes.find((c) => String(c.id) === String(clienteId)), [clientes, clienteId]);

  async function escanearCaja(valor) {
    const barcode = valor.trim();
    if (!barcode) return;
    setBuscando(true);
    try {
      const etiqueta = await entradasApi.buscarEtiqueta(barcode);
      const payload = [{
        folio,
        cliente_id: clienteId,
        cliente_nombre: cliente?.nombre || '',
        fecha: form.fecha,
        lote_canal: etiqueta.lote_num,
        tipo_ganado: etiqueta.tipo_ganado,
        codigo: etiqueta.codigo,
        producto: etiqueta.producto,
        cajas: 1,
        kilos: Number(etiqueta.kilos),
        barcode,
        entregado_por: form.entregado_por,
        observaciones: form.observaciones,
      }];
      const [guardada] = await salidasApi.create(payload);
      setSalidas((prev) => [guardada, ...prev]);
      setCajaTexto('');
      toast(`Caja ${barcode} agregada`);
      if (esNuevo) {
        navigate(`/salidas/${folio}`, { replace: true });
      }
    } catch (err) {
      toast(err.response?.data?.error || 'Caja no encontrada', 'error');
    } finally {
      setBuscando(false);
      cajaRef.current?.focus();
    }
  }

  function finalizar() {
    navigate('/salidas');
  }

  async function eliminar(salidaId) {
    try {
      await salidasApi.remove(salidaId);
      setSalidas((prev) => prev.filter((s) => s.id !== salidaId));
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

  function onEditClienteChange(clienteIdNuevo) {
    const c = clientes.find((x) => String(x.id) === String(clienteIdNuevo));
    setEditForm({ ...editForm, cliente_id: clienteIdNuevo, cliente_nombre: c?.nombre || '' });
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
  const puedeEscanear = Boolean(clienteId);

  if (loadingInicial) {
    return <PageHeader title="Salidas" subtitle="Cargando…" />;
  }

  return (
    <div>
      <PageHeader
        title={`Salida — Folio ${folio ?? ''}`}
        subtitle="Escanea el código de barras de cada caja"
        actions={<Button variant="outline" onClick={volver}>← Volver a salidas</Button>}
      />

      <Card className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Fecha">
            <Input type="date" value={form.fecha} disabled />
          </Field>
          <Field label="Cliente">
            {esNuevo ? (
              <Select value={clienteId} disabled={salidas.length > 0} onChange={(e) => setClienteId(e.target.value)}>
                <option value="">Selecciona…</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Select>
            ) : (
              <Input value={cliente?.nombre || ''} disabled />
            )}
          </Field>
          <Field label="Entregado por">
            <Input value={form.entregado_por} onChange={(e) => setForm({ ...form, entregado_por: e.target.value })} placeholder="Nombre" />
          </Field>
          <Field label="Caja (escanear)">
            <Input
              ref={cajaRef}
              autoFocus
              disabled={!puedeEscanear || buscando}
              value={cajaTexto}
              onChange={(e) => setCajaTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  escanearCaja(cajaTexto);
                }
              }}
              placeholder={puedeEscanear ? 'Escanea el código y Enter' : 'Selecciona un cliente primero'}
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Observaciones">
            <Textarea rows={2} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} placeholder="Opcional…" />
          </Field>
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="blue" onClick={finalizar}>
            💾 Guardar y volver a salidas
          </Button>
        </div>
      </Card>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-700">Cajas de este folio</p>
      </div>

      <Card className="mt-2 p-4">
        <div className="mb-3 flex gap-2">
          <Pill tone="gray">Registros: {salidas.length}</Pill>
          <Pill tone="blue">Cajas: {totalCajas}</Pill>
          <Pill tone="purple">Kilos: {formatNumber(totalKilos, 2)}</Pill>
        </div>
        <Table
          columns={['Fecha', 'Código', 'Lote/Canal', 'Producto', 'Cajas', 'Kilos', 'Entregó', 'Obs.', '']}
          empty={salidas.length === 0 ? 'Sin cajas guardadas para este folio' : null}
        >
          {salidas.map((s) => (
            <tr key={s.id}>
              <td className="px-3 py-2 whitespace-nowrap">{formatDateMX(s.fecha)}</td>
              <td className="px-3 py-2 font-mono text-xs">{s.barcode || '—'}</td>
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
