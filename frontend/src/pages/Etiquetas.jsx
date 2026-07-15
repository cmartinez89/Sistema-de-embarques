import { useEffect, useState } from 'react';
import { entradasApi, etiquetasApi } from '../api/services';
import { useToast } from '../context/ToastContext';
import { imprimirZPL } from '../lib/browserPrint';
import { todayISO, formatDateMX, formatNumber } from '../lib/date';
import { Button, Card, Field, Input, JustificacionModal, PageHeader, Pill, Select, Table, Textarea } from '../components/ui';

const TABS = [
  { key: 'buscar', label: 'Buscar etiquetas' },
  { key: 'manual', label: 'Generar manual' },
];

export default function Etiquetas() {
  const [tab, setTab] = useState('buscar');

  return (
    <div>
      <PageHeader
        title="Etiquetas"
        subtitle="Busca etiquetas ya emitidas por artículo, reimprímelas o elimínalas. La generación automática ocurre en Entradas al capturar cada caja."
      />

      <div className="mb-4 flex gap-2 border-b border-cream-300">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === t.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-ink-400 hover:text-ink-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'buscar' ? <BuscarEtiquetas /> : <GenerarManual />}
    </div>
  );
}

function BuscarEtiquetas() {
  const toast = useToast();
  const [productos, setProductos] = useState([]);
  const [filtros, setFiltros] = useState({ codigo: '', lote: '', caja: '', estado: '' });
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const [reimprimiendoId, setReimprimiendoId] = useState(null);
  const [etiquetaAEliminar, setEtiquetaAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    entradasApi.productos().then(setProductos).catch(() => setProductos([]));
  }, []);

  function buscar() {
    setLoading(true);
    setBuscado(true);
    etiquetasApi.buscar(filtros).then(setResultados).finally(() => setLoading(false));
  }

  async function reimprimir(etiqueta) {
    setReimprimiendoId(etiqueta.id);
    try {
      const { etiqueta: actualizada, zpl } = await etiquetasApi.reimprimir(etiqueta.id);
      setResultados((prev) => prev.map((e) => (e.id === actualizada.id ? actualizada : e)));
      const impreso = await imprimirZPL(zpl);
      if (!impreso) {
        const blob = new Blob([zpl], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `etiqueta-${actualizada.barcode}.zpl`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast(impreso ? 'Etiqueta reenviada a la impresora' : 'No se detectó impresora — se descargó el .zpl');
    } catch (err) {
      toast(err.response?.data?.error || 'No se pudo reimprimir', 'error');
    } finally {
      setReimprimiendoId(null);
    }
  }

  async function confirmarEliminar(justificacion) {
    if (!etiquetaAEliminar) return;
    setEliminando(true);
    try {
      await etiquetasApi.remove(etiquetaAEliminar, justificacion);
      setResultados((prev) => prev.map((e) => (e.id === etiquetaAEliminar ? { ...e, activa: 0 } : e)));
      toast('Etiqueta eliminada');
      setEtiquetaAEliminar(null);
    } catch (err) {
      toast(err.response?.data?.error || 'No se pudo eliminar', 'error');
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div>
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Artículo">
            <Select value={filtros.codigo} onChange={(e) => setFiltros({ ...filtros, codigo: e.target.value })} className="w-56">
              <option value="">Todos</option>
              {productos.map((p) => <option key={p.codigo} value={p.codigo}>{p.codigo} — {p.nombre}</option>)}
            </Select>
          </Field>
          <Field label="Lote">
            <Input value={filtros.lote} onChange={(e) => setFiltros({ ...filtros, lote: e.target.value })} placeholder="717" />
          </Field>
          <Field label="Caja">
            <Input type="number" value={filtros.caja} onChange={(e) => setFiltros({ ...filtros, caja: e.target.value })} placeholder="#" />
          </Field>
          <Field label="Estado">
            <Select value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}>
              <option value="">Todas</option>
              <option value="activa">Activas</option>
              <option value="eliminada">Eliminadas</option>
            </Select>
          </Field>
          <Button onClick={buscar} disabled={loading}>{loading ? 'Buscando…' : 'Buscar'}</Button>
        </div>
      </Card>

      <Card className="p-4">
        {resultados.length > 0 && <Pill tone="gray">Resultados: {resultados.length}</Pill>}
        <div className="mt-3">
          <Table
            columns={['Fecha', 'Lote', 'Código', 'Producto', 'Caja', 'Kilos', 'Código de barras', 'Impresa', 'Estado', '']}
            empty={buscado && !loading && resultados.length === 0 ? 'Sin etiquetas para estos filtros' : (!buscado ? 'Define los filtros y presiona Buscar' : null)}
          >
            {resultados.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-2 whitespace-nowrap">{formatDateMX(e.fecha)}</td>
                <td className="px-3 py-2">{e.lote_num}</td>
                <td className="px-3 py-2">{e.codigo}</td>
                <td className="px-3 py-2">{e.producto}</td>
                <td className="px-3 py-2">{e.caja}</td>
                <td className="px-3 py-2">{formatNumber(e.kilos, 2)}</td>
                <td className="px-3 py-2 font-mono text-xs">{e.barcode}</td>
                <td className="px-3 py-2">{e.veces_impresa}x</td>
                <td className="px-3 py-2">
                  <Pill tone={e.activa ? 'green' : 'gray'}>{e.activa ? 'Activa' : 'Eliminada'}</Pill>
                </td>
                <td className="px-3 py-2">
                  {e.activa ? (
                    <div className="flex gap-3">
                      <button
                        onClick={() => reimprimir(e)}
                        disabled={reimprimiendoId === e.id}
                        className="text-brand-600 hover:underline disabled:opacity-50"
                      >
                        {reimprimiendoId === e.id ? 'Enviando…' : 'Reimprimir'}
                      </button>
                      <button onClick={() => setEtiquetaAEliminar(e.id)} className="text-red-500 hover:text-red-700">
                        Eliminar
                      </button>
                    </div>
                  ) : (
                    <span className="text-ink-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </div>
      </Card>

      <JustificacionModal
        open={!!etiquetaAEliminar}
        title="Justifica la eliminación de esta etiqueta"
        confirmando={eliminando}
        onCancel={() => setEtiquetaAEliminar(null)}
        onConfirm={confirmarEliminar}
      />
    </div>
  );
}

const emptyForm = {
  lote: '',
  codigo: '',
  producto: '',
  caja: 1,
  kilos: '',
  fecha: todayISO(),
  romaneaje: '',
};

function GenerarManual() {
  const toast = useToast();
  const [productos, setProductos] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [result, setResult] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    entradasApi.productos().then(setProductos).catch(() => setProductos([]));
  }, []);

  function onProductoChange(codigo) {
    const p = productos.find((x) => x.codigo === codigo);
    setForm({ ...form, codigo, producto: p?.nombre || '' });
  }

  async function generar(e) {
    e.preventDefault();
    setGenerating(true);
    try {
      const data = await etiquetasApi.zpl(form);
      setResult(data);
      toast('Etiqueta generada');
    } catch (err) {
      toast(err.response?.data?.error || 'No se pudo generar la etiqueta', 'error');
    } finally {
      setGenerating(false);
    }
  }

  function descargar() {
    if (!result) return;
    const blob = new Blob([result.zpl], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etiqueta-${result.barcode}.zpl`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copiar() {
    if (!result) return;
    await navigator.clipboard.writeText(result.zpl);
    toast('ZPL copiado al portapapeles');
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="p-6">
        <p className="mb-4 text-xs text-ink-400">
          Herramienta manual para regenerar un ZPL (pruebas de impresora / casos fuera del flujo normal). No queda guardada en el sistema.
        </p>
        <form onSubmit={generar} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Lote">
              <Input value={form.lote} onChange={(e) => setForm({ ...form, lote: e.target.value })} placeholder="717" required />
            </Field>
            <Field label="Caja">
              <Input type="number" min="1" value={form.caja} onChange={(e) => setForm({ ...form, caja: e.target.value })} />
            </Field>
          </div>
          <Field label="Producto">
            <Select value={form.codigo} onChange={(e) => onProductoChange(e.target.value)} required>
              <option value="">Selecciona…</option>
              {productos.map((p) => <option key={p.codigo} value={p.codigo}>{p.codigo} — {p.nombre}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Kilos">
              <Input type="number" step="0.01" value={form.kilos} onChange={(e) => setForm({ ...form, kilos: e.target.value })} placeholder="0.00" required />
            </Field>
            <Field label="Fecha">
              <Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </Field>
          </div>
          <Field label="Romaneaje (opcional)">
            <Input value={form.romaneaje} onChange={(e) => setForm({ ...form, romaneaje: e.target.value })} placeholder="PROCARNE" />
          </Field>
          <Button type="submit" disabled={generating} className="w-full">
            {generating ? 'Generando…' : 'Generar etiqueta'}
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-400">Vista previa (ZPL)</p>
        {result ? (
          <>
            <div className="mb-4 rounded-lg border-2 border-dashed border-cream-300 bg-cream-50 p-4">
              <p className="text-sm font-bold">Empacadora Carnes Finas el Andén</p>
              <p className="text-xs text-ink-400">TIF No. 680 - SAGARPA México</p>
              <div className="my-2 border-t border-ink-200" />
              <div className="flex items-center justify-between">
                <p className="font-semibold">{form.producto}</p>
                <p className="font-bold">{form.kilos} kg</p>
              </div>
              <p className="text-xs text-ink-500">Lote: {form.lote} &nbsp; Fecha: {form.fecha}</p>
              {form.romaneaje && <p className="text-xs text-ink-500">Romaneaje: {form.romaneaje}</p>}
              <div className="my-2 border-t border-ink-200" />
              <p className="font-mono text-xs tracking-widest">|| {result.barcode} ||</p>
              <p className="text-xs text-ink-400">Caja: {form.caja}</p>
            </div>
            <Textarea readOnly rows={10} value={result.zpl} className="font-mono text-xs" />
            <div className="mt-3 flex gap-2">
              <Button variant="outline" onClick={copiar}>Copiar ZPL</Button>
              <Button variant="blue" onClick={descargar}>Descargar .zpl</Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-300">Completa el formulario y genera una etiqueta para ver la vista previa.</p>
        )}
      </Card>
    </div>
  );
}
