import { useEffect, useMemo, useState } from 'react';
import { canalesApi, entradasApi, etiquetasApi } from '../api/services';
import { useToast } from '../context/ToastContext';
import { imprimirZPL } from '../lib/browserPrint';
import { todayISO, formatDateMX, formatNumber } from '../lib/date';
import { Banner, Button, Card, Field, Input, JustificacionModal, PageHeader, Pill, Select, Table } from '../components/ui';

const emptyForm = {
  fecha: todayISO(),
  lote_id: '',
  tipo_ganado: '',
  codigo: '',
  producto: '',
  kilos: '',
};

export default function Entradas() {
  const toast = useToast();
  const [lotes, setLotes] = useState([]);
  const [tiposGanado, setTiposGanado] = useState([]);
  const [productos, setProductos] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [capturadas, setCapturadas] = useState([]); // ya persistidas en esta sesión
  const [ultimoResultado, setUltimoResultado] = useState(null);
  const [entradas, setEntradas] = useState([]);
  const [fechaFiltro, setFechaFiltro] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [reprinting, setReprinting] = useState(false);
  const [ultimoImpreso, setUltimoImpreso] = useState(null);
  const [entradaAEliminar, setEntradaAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    canalesApi.getLotes().then(setLotes).catch(() => setLotes([]));
    canalesApi.tiposGanado().then(setTiposGanado).catch(() => setTiposGanado([]));
    entradasApi.productos().then(setProductos).catch(() => setProductos([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    entradasApi.list({ fecha: fechaFiltro }).then(setEntradas).finally(() => setLoading(false));
  }, [fechaFiltro]);

  const loteSeleccionado = useMemo(
    () => lotes.find((l) => String(l.id) === String(form.lote_id)),
    [lotes, form.lote_id]
  );

  const puedeAgregar = form.lote_id && form.codigo && form.kilos !== '' && !adding;

  function onProductoChange(codigo) {
    const p = productos.find((x) => x.codigo === codigo);
    setForm({ ...form, codigo, producto: p?.nombre || '' });
  }

  function onLoteChange(lote_id) {
    const lote = lotes.find((l) => String(l.id) === String(lote_id));
    setForm({ ...form, lote_id, tipo_ganado: lote?.tipo_ganado || form.tipo_ganado });
  }

  async function agregar() {
    if (!puedeAgregar) return;
    setAdding(true);
    try {
      const payload = {
        lote_id: form.lote_id,
        lote_num: loteSeleccionado?.numero,
        tipo_ganado: form.tipo_ganado,
        codigo: form.codigo,
        producto: form.producto,
        kilos: Number(form.kilos),
        fecha: form.fecha,
        romaneaje: loteSeleccionado?.romaneaje,
      };
      const result = await entradasApi.registrarCaja(payload);
      setCapturadas((prev) => [...prev, result]);
      setUltimoResultado(result);
      if (form.fecha === fechaFiltro) {
        setEntradas((prev) => [...prev, result.entrada]);
      }
      const impreso = await imprimirZPL(result.zpl);
      setUltimoImpreso(impreso);
      toast(
        impreso
          ? `Caja ${result.entrada.caja} registrada e impresa`
          : `Caja ${result.entrada.caja} registrada — imprime la etiqueta manualmente abajo`,
        impreso ? undefined : 'error'
      );
      setForm((f) => ({ ...f, kilos: '' }));
    } catch (err) {
      toast(err.response?.data?.error || 'No se pudo registrar la caja', 'error');
    } finally {
      setAdding(false);
    }
  }

  async function reimprimirTodas() {
    if (!capturadas.length) return;
    setReprinting(true);
    try {
      const etiquetas = capturadas.map((c) => ({
        lote: c.etiqueta.lote_num,
        codigo: c.etiqueta.codigo,
        caja: c.etiqueta.caja,
        kilos: c.etiqueta.kilos,
        producto: c.etiqueta.producto,
        fecha: c.etiqueta.fecha,
        romaneaje: c.etiqueta.romaneaje,
      }));
      const { zpl } = await etiquetasApi.zplBatch(etiquetas);
      const impreso = await imprimirZPL(zpl);
      if (!impreso) {
        const blob = new Blob([zpl], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'etiquetas-sesion.zpl';
        a.click();
        URL.revokeObjectURL(url);
      }
      toast(impreso ? 'Etiquetas reimpresas' : 'No se detectó impresora — se descargó el .zpl');
    } catch {
      toast('No se pudieron reimprimir las etiquetas', 'error');
    } finally {
      setReprinting(false);
    }
  }

  async function copiarZPL() {
    if (!ultimoResultado) return;
    await navigator.clipboard.writeText(ultimoResultado.zpl);
    toast('ZPL copiado al portapapeles');
  }

  function descargarZPL() {
    if (!ultimoResultado) return;
    const blob = new Blob([ultimoResultado.zpl], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etiqueta-${ultimoResultado.etiqueta.barcode}.zpl`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function confirmarEliminar(justificacion) {
    if (!entradaAEliminar) return;
    setEliminando(true);
    try {
      await entradasApi.remove(entradaAEliminar, justificacion);
      setEntradas((prev) => prev.filter((e) => e.id !== entradaAEliminar));
      toast('Entrada eliminada');
      setEntradaAEliminar(null);
    } catch (err) {
      toast(err.response?.data?.error || 'No se pudo eliminar', 'error');
    } finally {
      setEliminando(false);
    }
  }

  const totalCajas = useMemo(() => entradas.reduce((s, e) => s + Number(e.cajas || 0), 0), [entradas]);
  const totalKilos = useMemo(() => entradas.reduce((s, e) => s + Number(e.kilos || 0), 0), [entradas]);

  return (
    <div>
      <PageHeader title="Entradas" subtitle="Captura de cajas de producto terminado — una etiqueta por caja" />

      <Card className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Fecha">
            <Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </Field>
          <Field label="Lote">
            <Select value={form.lote_id} onChange={(e) => onLoteChange(e.target.value)}>
              <option value="">Selecciona…</option>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>{l.numero} — {formatDateMX(l.fecha)}</option>
              ))}
            </Select>
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
          <Field label="Kilos (de esta caja)">
            <Input type="number" step="0.01" value={form.kilos} onChange={(e) => setForm({ ...form, kilos: e.target.value })} placeholder="0.00" />
          </Field>
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant={puedeAgregar ? 'primary' : 'soft'} disabled={!puedeAgregar} onClick={agregar}>
            {adding ? 'Registrando…' : '+ Agregar caja e imprimir etiqueta'}
          </Button>
          <Button variant={capturadas.length ? 'blue' : 'soft'} disabled={!capturadas.length || reprinting} onClick={reimprimirTodas}>
            {reprinting ? 'Enviando…' : '🖨️ Reimprimir todas (esta sesión)'}
          </Button>
        </div>

        {capturadas.length > 0 && (
          <div className="mt-4">
            <Banner tone="yellow" title={`Cajas registradas en esta sesión (${capturadas.length})`}>
              <Pill tone="blue">Cajas: {capturadas.length}</Pill>
              <Pill tone="purple">Kilos: {formatNumber(capturadas.reduce((s, c) => s + Number(c.entrada.kilos || 0), 0), 2)}</Pill>
            </Banner>
            <div className="mt-2 flex flex-wrap gap-2">
              {capturadas.map((c) => (
                <span key={c.entrada.id} className="inline-flex items-center gap-2 rounded-full bg-cream-200 px-3 py-1 text-xs">
                  {c.etiqueta.lote_num} · {c.etiqueta.producto} · Caja {c.etiqueta.caja} · {c.etiqueta.kilos}kg
                </span>
              ))}
            </div>
          </div>
        )}

        {ultimoResultado && (
          <div className="mt-4 rounded-lg border-2 border-dashed border-cream-300 bg-cream-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Última etiqueta generada</p>
              {ultimoImpreso === false && <Pill tone="orange">No se detectó impresora — imprime manualmente</Pill>}
              {ultimoImpreso === true && <Pill tone="green">Enviada a la impresora</Pill>}
            </div>
            <p className="text-sm font-bold">{ultimoResultado.etiqueta.producto}</p>
            <p className="text-xs text-ink-500">
              Lote: {ultimoResultado.etiqueta.lote_num} &nbsp; Caja: {ultimoResultado.etiqueta.caja} &nbsp; Kilos: {ultimoResultado.etiqueta.kilos}
            </p>
            <p className="font-mono text-xs tracking-widest">|| {ultimoResultado.etiqueta.barcode} ||</p>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" onClick={copiarZPL}>Copiar ZPL</Button>
              <Button variant="blue" onClick={descargarZPL}>Descargar .zpl</Button>
            </div>
          </div>
        )}
      </Card>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-700">Entradas registradas</p>
        <Field label="">
          <Input type="date" value={fechaFiltro} onChange={(e) => setFechaFiltro(e.target.value)} />
        </Field>
      </div>

      <Card className="mt-2 p-4">
        <div className="mb-3 flex gap-2">
          <Pill tone="gray">Registros: {entradas.length}</Pill>
          <Pill tone="blue">Cajas: {totalCajas}</Pill>
          <Pill tone="purple">Kilos: {formatNumber(totalKilos, 2)}</Pill>
        </div>
        <Table
          columns={['Fecha', 'Lote', 'Tipo', 'Código', 'Producto', 'Caja', 'Kilos', '']}
          empty={!loading && entradas.length === 0 ? 'Sin entradas para esta fecha' : null}
        >
          {entradas.map((e) => (
            <tr key={e.id}>
              <td className="px-3 py-2 whitespace-nowrap">{formatDateMX(e.fecha)}</td>
              <td className="px-3 py-2">{e.lote_num}</td>
              <td className="px-3 py-2">{e.tipo_ganado}</td>
              <td className="px-3 py-2">{e.codigo}</td>
              <td className="px-3 py-2">{e.producto}</td>
              <td className="px-3 py-2">{e.caja ?? '—'}</td>
              <td className="px-3 py-2">{formatNumber(e.kilos, 2)}</td>
              <td className="px-3 py-2">
                <button onClick={() => setEntradaAEliminar(e.id)} className="text-red-500 hover:text-red-700">Eliminar</button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <JustificacionModal
        open={!!entradaAEliminar}
        title="Justifica la eliminación de esta entrada"
        confirmando={eliminando}
        onCancel={() => setEntradaAEliminar(null)}
        onConfirm={confirmarEliminar}
      />
    </div>
  );
}
