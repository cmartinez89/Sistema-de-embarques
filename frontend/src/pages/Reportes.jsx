import { useState } from 'react';
import { reportesApi } from '../api/services';
import { downloadCsv } from '../lib/csv';
import { formatDateMX, formatNumber, formatTipoGanado, todayISO } from '../lib/date';
import { Button, Card, Field, Input, PageHeader, Pill, Table } from '../components/ui';

const TABS = [
  { key: 'entradas', label: 'Entradas' },
  { key: 'salidas', label: 'Salidas' },
  { key: 'movimientos', label: 'Movimientos de inventario' },
  { key: 'existencias', label: 'Existencias' },
  { key: 'canales', label: 'Canales' },
];

export default function Reportes() {
  const [tab, setTab] = useState('entradas');
  const [filtros, setFiltros] = useState({ fecha_inicio: '', fecha_fin: todayISO(), lote_num: '' });
  const [agrupado, setAgrupado] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [buscado, setBuscado] = useState(false);

  const puedeAgrupar = tab === 'entradas' || tab === 'salidas';

  async function buscar() {
    setLoading(true);
    setBuscado(true);
    try {
      let data = [];
      if (tab === 'entradas') data = await reportesApi.entradas({ ...filtros, agrupado: puedeAgrupar && agrupado });
      if (tab === 'salidas') data = await reportesApi.salidas({ ...filtros, agrupado: puedeAgrupar && agrupado });
      if (tab === 'movimientos') data = await reportesApi.movimientos(filtros);
      if (tab === 'existencias') data = await reportesApi.existencias({ fecha: filtros.fecha_fin });
      if (tab === 'canales') data = await reportesApi.canales({ lote_num: filtros.lote_num });
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  function cambiarTab(key) {
    setTab(key);
    setRows([]);
    setBuscado(false);
  }

  const columnsByTab = {
    entradas: agrupado
      ? ['Código', 'Producto', 'Tipo', 'Total cajas', 'Total kilos', 'Cajas']
      : ['Fecha', 'Lote', 'Tipo', 'Código', 'Producto', 'Cajas', 'Kilos'],
    salidas: agrupado
      ? ['Código', 'Producto', 'Tipo', 'Total cajas', 'Total kilos', '# Registros']
      : ['Folio', 'Fecha', 'Cliente', 'Lote/Canal', 'Producto', 'Cajas', 'Kilos', 'Entregó', 'Obs.'],
    movimientos: ['Fecha', 'Tipo', 'Lote', 'Producto', 'Cajas', 'Kilos', 'Motivo', 'Estado', 'Obs.'],
    existencias: ['Código', 'Producto', 'Tipo', 'Cajas existentes', 'Kilos existentes'],
    canales: ['Lote', 'Cons.', 'Romaneaje', 'P. Caliente', 'P. Frío', 'Dif %', 'Obs. lote'],
  };

  function renderRow(r, i) {
    if (tab === 'entradas' && agrupado) return (
      <tr key={`${r.codigo}-${i}`}>
        <td className="px-3 py-2">{r.codigo}</td>
        <td className="px-3 py-2">{r.producto}</td>
        <td className="px-3 py-2">{formatTipoGanado(r.tipo_ganado)}</td>
        <td className="px-3 py-2 font-bold text-brand-600">{r.total_cajas}</td>
        <td className="px-3 py-2 font-bold text-brand-600">{formatNumber(r.total_kilos, 2)}</td>
        <td className="px-3 py-2 max-w-[240px] truncate" title={r.cajas_lista}>{r.cajas_lista || '—'}</td>
      </tr>
    );
    if (tab === 'entradas') return (
      <tr key={r.id ?? i}>
        <td className="px-3 py-2 whitespace-nowrap">{formatDateMX(r.fecha)}</td>
        <td className="px-3 py-2">{r.lote_num}</td>
        <td className="px-3 py-2">{formatTipoGanado(r.tipo_ganado)}</td>
        <td className="px-3 py-2">{r.codigo}</td>
        <td className="px-3 py-2">{r.producto}</td>
        <td className="px-3 py-2">{r.cajas}</td>
        <td className="px-3 py-2">{formatNumber(r.kilos, 2)}</td>
      </tr>
    );
    if (tab === 'salidas' && agrupado) return (
      <tr key={`${r.codigo}-${i}`}>
        <td className="px-3 py-2">{r.codigo}</td>
        <td className="px-3 py-2">{r.producto}</td>
        <td className="px-3 py-2">{formatTipoGanado(r.tipo_ganado)}</td>
        <td className="px-3 py-2 font-bold text-brand-600">{r.total_cajas}</td>
        <td className="px-3 py-2 font-bold text-brand-600">{formatNumber(r.total_kilos, 2)}</td>
        <td className="px-3 py-2">{r.num_registros}</td>
      </tr>
    );
    if (tab === 'salidas') return (
      <tr key={r.id ?? i}>
        <td className="px-3 py-2">{r.folio}</td>
        <td className="px-3 py-2 whitespace-nowrap">{formatDateMX(r.fecha)}</td>
        <td className="px-3 py-2">{r.cliente_nombre}</td>
        <td className="px-3 py-2">{r.lote_canal}</td>
        <td className="px-3 py-2">{r.producto}</td>
        <td className="px-3 py-2">{r.cajas}</td>
        <td className="px-3 py-2">{formatNumber(r.kilos, 2)}</td>
        <td className="px-3 py-2">{r.entregado_por}</td>
        <td className="px-3 py-2 max-w-[200px] truncate" title={r.observaciones}>{r.observaciones || '—'}</td>
      </tr>
    );
    if (tab === 'movimientos') return (
      <tr key={r.id ?? i}>
        <td className="px-3 py-2 whitespace-nowrap">{formatDateMX(r.fecha)}</td>
        <td className="px-3 py-2 capitalize">{r.tipo_movimiento}</td>
        <td className="px-3 py-2">{r.lote_num}</td>
        <td className="px-3 py-2">{r.producto}</td>
        <td className="px-3 py-2">{r.cajas}</td>
        <td className="px-3 py-2">{formatNumber(r.kilos, 2)}</td>
        <td className="px-3 py-2 capitalize">{r.motivo}</td>
        <td className="px-3 py-2"><Pill tone={r.estado === 'autorizado' ? 'green' : r.estado === 'rechazado' ? 'gray' : 'orange'}>{r.estado}</Pill></td>
        <td className="px-3 py-2 max-w-[200px] truncate" title={r.observaciones}>{r.observaciones || '—'}</td>
      </tr>
    );
    if (tab === 'existencias') return (
      <tr key={`${r.codigo}-${i}`}>
        <td className="px-3 py-2">{r.codigo}</td>
        <td className="px-3 py-2">{r.producto}</td>
        <td className="px-3 py-2">{formatTipoGanado(r.tipo_ganado)}</td>
        <td className="px-3 py-2 font-bold text-brand-600">{r.cajas_existentes}</td>
        <td className="px-3 py-2 font-bold text-brand-600">{formatNumber(r.kilos_existentes, 2)}</td>
      </tr>
    );
    return (
      <tr key={r.id ?? i}>
        <td className="px-3 py-2">{r.lote_numero}</td>
        <td className="px-3 py-2">{r.consecutivo}</td>
        <td className="px-3 py-2">{r.romaneaje}</td>
        <td className="px-3 py-2">{formatNumber(r.peso_caliente, 2)}</td>
        <td className="px-3 py-2">{formatNumber(r.peso_frio, 2)}</td>
        <td className="px-3 py-2">{formatNumber(r.diferencia_pct, 2)}</td>
        <td className="px-3 py-2 max-w-[200px] truncate" title={r.lote_observaciones}>{r.lote_observaciones || '—'}</td>
      </tr>
    );
  }

  return (
    <div>
      <PageHeader title="Reportes" subtitle="Consulta y exporta la información del sistema" />

      <div className="mb-4 flex gap-2 border-b border-cream-300">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => cambiarTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition ${
              tab === t.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-ink-400 hover:text-ink-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          {tab !== 'existencias' && tab !== 'canales' && (
            <>
              <Field label="Desde">
                <Input type="date" value={filtros.fecha_inicio} onChange={(e) => setFiltros({ ...filtros, fecha_inicio: e.target.value })} />
              </Field>
              <Field label="Hasta">
                <Input type="date" value={filtros.fecha_fin} onChange={(e) => setFiltros({ ...filtros, fecha_fin: e.target.value })} />
              </Field>
            </>
          )}
          {tab === 'existencias' && (
            <Field label="Existencia al (fecha)">
              <Input type="date" value={filtros.fecha_fin} onChange={(e) => setFiltros({ ...filtros, fecha_fin: e.target.value })} />
            </Field>
          )}
          {tab === 'canales' && (
            <Field label="Lote (opcional)">
              <Input value={filtros.lote_num} onChange={(e) => setFiltros({ ...filtros, lote_num: e.target.value })} placeholder="717" />
            </Field>
          )}
          {puedeAgrupar && (
            <label className="mb-2 flex items-center gap-1.5 text-sm text-ink-600">
              <input type="checkbox" checked={agrupado} onChange={(e) => setAgrupado(e.target.checked)} />
              Agrupar por producto
            </label>
          )}
          <Button onClick={buscar} disabled={loading}>{loading ? 'Buscando…' : 'Buscar'}</Button>
          <Button variant="outline" disabled={!rows.length} onClick={() => downloadCsv(`reporte-${tab}.csv`, rows)}>
            Exportar CSV
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        {rows.length > 0 && <Pill tone="gray">Resultados: {rows.length}</Pill>}
        <div className="mt-3">
          <Table
            columns={columnsByTab[tab]}
            empty={buscado && !loading && rows.length === 0 ? 'Sin resultados para los filtros indicados' : (!buscado ? 'Define los filtros y presiona Buscar' : null)}
          >
            {rows.map(renderRow)}
          </Table>
        </div>
      </Card>
    </div>
  );
}
