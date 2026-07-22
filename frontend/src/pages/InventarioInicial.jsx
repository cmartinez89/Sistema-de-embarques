import { useEffect, useRef, useState } from 'react';
import { canalesApi, entradasApi } from '../api/services';
import { useToast } from '../context/ToastContext';
import { parseBarcode } from '../lib/barcode';
import { todayISO, formatNumber } from '../lib/date';
import { Banner, Button, Card, Field, Input, PageHeader, Pill, Select, Table } from '../components/ui';

export default function InventarioInicial() {
  const toast = useToast();
  const inputRef = useRef(null);
  const [tiposGanado, setTiposGanado] = useState([]);
  const [productos, setProductos] = useState([]);
  const [fecha, setFecha] = useState(todayISO());
  const [tipoGanado, setTipoGanado] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [renglones, setRenglones] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    canalesApi.tiposGanado().then(setTiposGanado).catch(() => setTiposGanado([]));
    entradasApi.productos().then(setProductos).catch(() => setProductos([]));
    inputRef.current?.focus();
  }, []);

  function procesarEscaneo() {
    const codigoBarras = scanInput.trim();
    if (!codigoBarras) return;

    const parsed = parseBarcode(codigoBarras);
    if (!parsed) {
      toast(`Código no reconocido: "${codigoBarras}" (formato esperado CODIGO-LOTE-CAJA-KILOS)`, 'error');
      setScanInput('');
      return;
    }

    const yaEscaneado = renglones.some((r) => r.barcode === codigoBarras);
    if (yaEscaneado) {
      toast('Esta etiqueta ya fue escaneada en esta sesión', 'error');
      setScanInput('');
      return;
    }

    const producto = productos.find((p) => p.codigo === parsed.codigo);
    setRenglones((prev) => [
      ...prev,
      {
        barcode: codigoBarras,
        codigo: parsed.codigo,
        producto: producto?.nombre || '(producto desconocido)',
        lote: parsed.lote,
        caja: parsed.caja,
        kilos: parsed.kilos,
      },
    ]);
    setScanInput('');
  }

  function onScanKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      procesarEscaneo();
    }
  }

  function quitarRenglon(i) {
    setRenglones((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function meterAlInventario() {
    if (!renglones.length) return;
    setGuardando(true);
    try {
      const payload = renglones.map((r) => ({
        barcode: r.barcode,
        lote_num: r.lote,
        fecha,
        tipo_ganado: tipoGanado || null,
        codigo: r.codigo,
        producto: r.producto,
        kilos: r.kilos,
        caja: r.caja,
      }));
      const saved = await entradasApi.inventarioInicial(payload);
      toast(`${saved.length} caja(s) agregada(s) al inventario`);
      setRenglones([]);
    } catch (err) {
      toast(err.response?.data?.error || 'No se pudo agregar al inventario', 'error');
    } finally {
      setGuardando(false);
      inputRef.current?.focus();
    }
  }

  const totalKilos = renglones.reduce((s, r) => s + r.kilos, 0);
  const puedeMeter = renglones.length > 0 && !guardando;

  return (
    <div>
      <PageHeader
        title="Inventario inicial"
        subtitle="Escanea las etiquetas de cajas ya existentes (físicas) para darlas de alta en el sistema"
      />

      <Card className="p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Fecha">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Field label="Tipo de ganado (opcional — aplica a todo el escaneo)">
            <Select value={tipoGanado} onChange={(e) => setTipoGanado(e.target.value)}>
              <option value="">Sin dato</option>
              {tiposGanado.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Escanea o escribe el código de barras (CODIGO-LOTE-CAJA-KILOS) y presiona Enter">
            <Input
              ref={inputRef}
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={onScanKeyDown}
              placeholder="600-26-1-15.70"
              autoFocus
            />
          </Field>
        </div>

        {renglones.length > 0 && (
          <div className="mt-4">
            <Banner tone="yellow" title={`Cajas escaneadas (${renglones.length})`}>
              <Pill tone="blue">Cajas: {renglones.length}</Pill>
              <Pill tone="purple">Kilos: {formatNumber(totalKilos, 2)}</Pill>
            </Banner>
          </div>
        )}

        <div className="mt-4">
          <Button variant={puedeMeter ? 'primary' : 'soft'} disabled={!puedeMeter} onClick={meterAlInventario}>
            {guardando ? 'Guardando…' : `📥 Meter al inventario (${renglones.length})`}
          </Button>
        </div>
      </Card>

      <Card className="mt-4 p-4">
        <Table
          columns={['Código de barras', 'Código', 'Producto', 'Lote', 'Caja', 'Kilos', '']}
          empty={renglones.length === 0 ? 'Aún no se ha escaneado ninguna caja' : null}
        >
          {renglones.map((r, i) => (
            <tr key={r.barcode}>
              <td className="px-3 py-2 font-mono text-xs">{r.barcode}</td>
              <td className="px-3 py-2">{r.codigo}</td>
              <td className="px-3 py-2">{r.producto}</td>
              <td className="px-3 py-2">{r.lote}</td>
              <td className="px-3 py-2">{r.caja}</td>
              <td className="px-3 py-2">{formatNumber(r.kilos, 2)}</td>
              <td className="px-3 py-2">
                <button onClick={() => quitarRenglon(i)} className="text-red-500 hover:text-red-700">Quitar</button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
