import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { canalesApi, entradasApi, etiquetasApi } from '../api/services';
import { useToast } from '../context/ToastContext';
import { useBascula } from '../context/BasculaContext';
import { imprimirZPL } from '../lib/browserPrint';
import { todayISO, formatNumber, formatTipoGanado } from '../lib/date';
import { Banner, Button, Card, Field, Input, JustificacionModal, PageHeader, Pill, Table } from '../components/ui';

const emptyForm = {
  fecha: todayISO(),
  codigo: '',
  producto: '',
  kilos: '',
};

export default function EntradaCaptura() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { conectada: basculaConectada, peso: pesoBascula } = useBascula();

  const [lote, setLote] = useState(null);
  const [loadingLote, setLoadingLote] = useState(true);
  const [productos, setProductos] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [codigoTexto, setCodigoTexto] = useState('');
  const [capturadas, setCapturadas] = useState([]); // ya persistidas en esta sesión
  const [entradas, setEntradas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [reprinting, setReprinting] = useState(false);
  const [entradaAEliminar, setEntradaAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const codigoRef = useRef(null);
  const kilosRef = useRef(null);

  function volver() {
    navigate('/entradas');
  }

  // Con báscula conectada, el peso se toma en vivo del puerto serial —
  // el campo "Kilos" refleja lo que marca la báscula, no se captura a mano.
  useEffect(() => {
    if (!basculaConectada || pesoBascula === null || !form.codigo) return;
    setForm((f) => ({ ...f, kilos: String(pesoBascula) }));
  }, [basculaConectada, pesoBascula, form.codigo]);

  useEffect(() => {
    setLoadingLote(true);
    canalesApi.getLote(id)
      .then(setLote)
      .catch(() => { toast('No se encontró el lote', 'error'); navigate('/entradas'); })
      .finally(() => setLoadingLote(false));
    entradasApi.productos().then(setProductos).catch(() => setProductos([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    setLoading(true);
    entradasApi.list({ lote_id: id }).then(setEntradas).finally(() => setLoading(false));
  }, [id]);

  const puedeAgregar = form.codigo && form.kilos !== '' && !adding;

  function resolverProducto(valor) {
    const codigo = valor.trim();
    if (!codigo) return;
    const producto = productos.find((p) => String(p.codigo) === codigo);
    if (!producto) {
      toast('Producto no encontrado', 'error');
      return;
    }
    setForm((f) => ({ ...f, codigo: producto.codigo, producto: producto.nombre }));
    setCodigoTexto(producto.codigo);
    kilosRef.current?.focus();
  }

  async function agregar() {
    if (!puedeAgregar) return;
    setAdding(true);
    try {
      const payload = {
        lote_id: id,
        lote_num: lote?.numero,
        tipo_ganado: lote?.tipo_ganado,
        codigo: form.codigo,
        producto: form.producto,
        kilos: Number(form.kilos),
        fecha: form.fecha,
        romaneaje: lote?.romaneaje,
      };
      const result = await entradasApi.registrarCaja(payload);
      setCapturadas((prev) => [...prev, result]);
      setEntradas((prev) => [...prev, { ...result.entrada, barcode: result.etiqueta.barcode }]);
      const impreso = await imprimirZPL(result.zpl);
      toast(
        impreso
          ? `Caja ${result.entrada.caja} registrada e impresa`
          : `Caja ${result.entrada.caja} registrada — no se detectó impresora, usa "Reimprimir todas"`,
        impreso ? undefined : 'error'
      );
      setForm((f) => ({ ...f, codigo: '', producto: '', kilos: '' }));
      setCodigoTexto('');
      codigoRef.current?.focus();
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

  const porProducto = useMemo(() => {
    const grupos = new Map();
    for (const e of entradas) {
      if (!grupos.has(e.codigo)) {
        grupos.set(e.codigo, { codigo: e.codigo, producto: e.producto, cajas: 0, kilos: 0 });
      }
      const g = grupos.get(e.codigo);
      g.cajas += Number(e.cajas || 0);
      g.kilos += Number(e.kilos || 0);
    }
    return [...grupos.values()].sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
  }, [entradas]);

  if (loadingLote) {
    return <PageHeader title="Entradas" subtitle="Cargando lote…" />;
  }

  return (
    <div>
      <PageHeader
        title={`Entradas — Lote ${lote?.numero ?? ''}`}
        subtitle="Captura de cajas de producto terminado — una etiqueta por caja"
        actions={<Button variant="outline" onClick={volver}>← Volver a lotes</Button>}
      />

      <Card className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Fecha">
            <Input type="date" value={form.fecha} disabled />
          </Field>
          <Field label="Tipo de ganado">
            <Input value={lote ? formatTipoGanado(lote.tipo_ganado) : ''} disabled />
          </Field>
          <Field label="Producto">
            <Input
              ref={codigoRef}
              autoFocus
              value={codigoTexto}
              onChange={(e) => setCodigoTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  resolverProducto(codigoTexto);
                }
              }}
              placeholder="Código y Enter"
            />
            {form.producto && <p className="mt-1 text-xs font-medium text-emerald-600">{form.producto}</p>}
          </Field>
          <Field label="Kilos (de esta caja)">
            <div className="flex gap-2">
              <Input
                ref={kilosRef}
                type="number"
                step="0.01"
                disabled={!form.codigo}
                readOnly={basculaConectada}
                value={form.kilos}
                onChange={(e) => !basculaConectada && setForm({ ...form, kilos: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (puedeAgregar) agregar();
                  }
                }}
                placeholder={basculaConectada ? 'Esperando peso de báscula…' : '0.00'}
                className={basculaConectada ? 'font-mono font-semibold text-brand-700' : ''}
              />
              {basculaConectada && (
                <Pill tone={pesoBascula !== null ? 'green' : 'gray'}>
                  ⚖️ {pesoBascula !== null ? `${pesoBascula} kg en vivo` : 'sin lectura'}
                </Pill>
              )}
            </div>
            {basculaConectada && (
              <p className="mt-1 text-xs text-ink-400">
                El peso se toma en vivo de la báscula — da Enter para registrar e imprimir con el peso actual.
              </p>
            )}
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
                  <span className="font-mono">{c.etiqueta.barcode}</span> · {c.etiqueta.producto} · Caja {c.etiqueta.caja} · {c.etiqueta.kilos}kg
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink-700">Entradas registradas de este lote</p>
      </div>

      <Card className="mt-2 p-4">
        <div className="mb-3 flex gap-2">
          <Pill tone="gray">Registros: {entradas.length}</Pill>
          <Pill tone="blue">Cajas: {totalCajas}</Pill>
          <Pill tone="purple">Kilos: {formatNumber(totalKilos, 2)}</Pill>
        </div>
        <Table
          columns={['Código', 'Producto', 'Cajas', 'Kilos']}
          empty={!loading && entradas.length === 0 ? 'Sin entradas para este lote' : null}
        >
          {porProducto.map((g) => (
            <tr key={g.codigo}>
              <td className="px-3 py-2">{g.codigo}</td>
              <td className="px-3 py-2">{g.producto}</td>
              <td className="px-3 py-2">{g.cajas}</td>
              <td className="px-3 py-2">{formatNumber(g.kilos, 2)}</td>
            </tr>
          ))}
        </Table>
      </Card>

      {entradas.length > 0 && (
        <Card className="mt-4 p-4">
          <p className="mb-3 text-sm font-semibold text-ink-700">Detalle por caja</p>
          <Table columns={['Caja', 'Código de barras', 'Código', 'Producto', 'Kilos', '']}>
            {entradas.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-2">{e.caja ?? '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">{e.barcode || '—'}</td>
                <td className="px-3 py-2">{e.codigo}</td>
                <td className="px-3 py-2">{e.producto}</td>
                <td className="px-3 py-2">{formatNumber(e.kilos, 2)}</td>
                <td className="px-3 py-2">
                  <button onClick={() => setEntradaAEliminar(e.id)} className="text-red-500 hover:text-red-700">Eliminar</button>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

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
