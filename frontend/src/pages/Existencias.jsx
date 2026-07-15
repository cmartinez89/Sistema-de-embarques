import { useEffect, useMemo, useState } from 'react';
import { existenciasApi } from '../api/services';
import { formatNumber, todayISO } from '../lib/date';
import { Button, Card, Field, Input, PageHeader, Pill, Table } from '../components/ui';

export default function Existencias() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buscar, setBuscar] = useState('');
  const [fecha, setFecha] = useState('');

  function cargar(params) {
    setLoading(true);
    existenciasApi.list(params).then(setData).finally(() => setLoading(false));
  }

  useEffect(() => { cargar(); }, []);

  function verAFecha() {
    cargar(fecha ? { fecha } : undefined);
  }

  function verActual() {
    setFecha('');
    cargar();
  }

  const filtrado = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (d) => d.codigo?.toLowerCase().includes(q) || d.producto?.toLowerCase().includes(q) || d.tipo_ganado?.toLowerCase().includes(q)
    );
  }, [data, buscar]);

  const totalCajas = filtrado.reduce((s, d) => s + Number(d.cajas_existentes || 0), 0);
  const totalKilos = filtrado.reduce((s, d) => s + Number(d.kilos_existentes || 0), 0);

  return (
    <div>
      <PageHeader
        title="Existencias"
        subtitle={fecha ? `Existencia histórica al ${fecha} (entradas − salidas ± movimientos autorizados)` : 'Existencia actual (entradas − salidas ± movimientos autorizados)'}
        actions={
          <Input placeholder="Buscar código o producto…" value={buscar} onChange={(e) => setBuscar(e.target.value)} className="w-64" />
        }
      />

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Ver existencia a una fecha">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} max={todayISO()} />
          </Field>
          <Button variant="primary" onClick={verAFecha}>Ver a esa fecha</Button>
          {fecha && <Button variant="outline" onClick={verActual}>Ver existencia actual</Button>}
        </div>
      </Card>

      <div className="mb-3 flex gap-2">
        <Pill tone="gray">Productos con stock: {filtrado.length}</Pill>
        <Pill tone="blue">Cajas: {formatNumber(totalCajas)}</Pill>
        <Pill tone="purple">Kilos: {formatNumber(totalKilos, 2)}</Pill>
      </div>

      <Card className="p-4">
        <Table
          columns={['Código', 'Producto', 'Tipo', 'Entradas (c/kg)', 'Salidas (c/kg)', 'Movimientos (c/kg)', 'Existencia (cajas)', 'Existencia (kilos)']}
          empty={!loading && filtrado.length === 0 ? 'Sin existencias registradas' : null}
        >
          {filtrado.map((d) => (
            <tr key={`${d.codigo}-${d.tipo_ganado}`}>
              <td className="px-3 py-2 font-medium">{d.codigo}</td>
              <td className="px-3 py-2">{d.producto}</td>
              <td className="px-3 py-2">{d.tipo_ganado}</td>
              <td className="px-3 py-2 text-ink-400">{d.cajas_entradas} / {formatNumber(d.kilos_entradas, 2)}</td>
              <td className="px-3 py-2 text-ink-400">{d.cajas_salidas} / {formatNumber(d.kilos_salidas, 2)}</td>
              <td className="px-3 py-2 text-ink-400">{d.cajas_movimientos} / {formatNumber(d.kilos_movimientos, 2)}</td>
              <td className="px-3 py-2 font-bold text-brand-600">{d.cajas_existentes}</td>
              <td className="px-3 py-2 font-bold text-brand-600">{formatNumber(d.kilos_existentes, 2)}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
