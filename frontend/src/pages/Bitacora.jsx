import { useEffect, useState } from 'react';
import { bitacoraApi } from '../api/services';
import { formatDateMX } from '../lib/date';
import { Button, Card, Field, Input, Modal, PageHeader, Pill, Select, Table } from '../components/ui';

const emptyFiltros = {
  fecha_inicio: '',
  fecha_fin: '',
  tabla: '',
  accion: '',
  usuario: '',
};

const ACCION_TONE = {
  crear: 'green',
  editar: 'blue',
  eliminar: 'orange',
};

export default function Bitacora() {
  const [tablas, setTablas] = useState([]);
  const [acciones, setAcciones] = useState([]);
  const [filtros, setFiltros] = useState(emptyFiltros);
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState(null);

  useEffect(() => {
    bitacoraApi.tablas().then(setTablas).catch(() => setTablas([]));
    bitacoraApi.acciones().then(setAcciones).catch(() => setAcciones([]));
  }, []);

  function buscar() {
    setLoading(true);
    bitacoraApi.list(filtros).then(setRegistros).finally(() => setLoading(false));
  }

  useEffect(buscar, []);

  function limpiarFiltros() {
    setFiltros(emptyFiltros);
    setLoading(true);
    bitacoraApi.list({}).then(setRegistros).finally(() => setLoading(false));
  }

  return (
    <div>
      <PageHeader title="Bitácora" subtitle="Registro de auditoría — solo visible para administradores" />

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Field label="Desde">
            <Input type="date" value={filtros.fecha_inicio} onChange={(e) => setFiltros({ ...filtros, fecha_inicio: e.target.value })} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={filtros.fecha_fin} onChange={(e) => setFiltros({ ...filtros, fecha_fin: e.target.value })} />
          </Field>
          <Field label="Tabla">
            <Select value={filtros.tabla} onChange={(e) => setFiltros({ ...filtros, tabla: e.target.value })}>
              <option value="">Todas</option>
              {tablas.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Acción">
            <Select value={filtros.accion} onChange={(e) => setFiltros({ ...filtros, accion: e.target.value })}>
              <option value="">Todas</option>
              {acciones.map((a) => <option key={a} value={a} className="capitalize">{a}</option>)}
            </Select>
          </Field>
          <Field label="Usuario">
            <Input value={filtros.usuario} onChange={(e) => setFiltros({ ...filtros, usuario: e.target.value })} placeholder="Nombre de usuario…" />
          </Field>
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="primary" onClick={buscar}>Filtrar</Button>
          <Button variant="outline" onClick={limpiarFiltros}>Limpiar filtros</Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex gap-2">
          <Pill tone="gray">Registros: {registros.length}</Pill>
        </div>
        <Table
          columns={['Fecha', 'Usuario', 'Acción', 'Tabla', 'Registro', 'Justificación', '']}
          empty={!loading && registros.length === 0 ? 'Sin movimientos para estos filtros' : null}
        >
          {registros.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2 whitespace-nowrap">{formatDateMX(r.fecha)} {new Date(r.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</td>
              <td className="px-3 py-2">{r.usuario_nombre || '—'}</td>
              <td className="px-3 py-2"><Pill tone={ACCION_TONE[r.accion] || 'gray'}>{r.accion}</Pill></td>
              <td className="px-3 py-2 capitalize">{r.tabla}</td>
              <td className="px-3 py-2">{r.registro_id}</td>
              <td className="px-3 py-2 max-w-[240px] truncate" title={r.justificacion}>{r.justificacion}</td>
              <td className="px-3 py-2">
                <button onClick={() => setDetalle(r)} className="text-brand-600 hover:underline">Ver detalle</button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal open={!!detalle} onClose={() => setDetalle(null)} title="Detalle del movimiento" width="max-w-2xl">
        {detalle && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs text-ink-500">
              <p><span className="font-semibold text-ink-700">Usuario:</span> {detalle.usuario_nombre}</p>
              <p><span className="font-semibold text-ink-700">Acción:</span> {detalle.accion}</p>
              <p><span className="font-semibold text-ink-700">Tabla:</span> {detalle.tabla}</p>
              <p><span className="font-semibold text-ink-700">Registro:</span> {detalle.registro_id}</p>
            </div>
            <p><span className="font-semibold text-ink-700">Justificación:</span> {detalle.justificacion}</p>
            {detalle.datos_antes && (
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-400">Antes</p>
                <pre className="max-h-48 overflow-auto rounded-lg bg-cream-100 p-3 text-xs">{JSON.stringify(detalle.datos_antes, null, 2)}</pre>
              </div>
            )}
            {detalle.datos_despues && (
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-400">Después</p>
                <pre className="max-h-48 overflow-auto rounded-lg bg-cream-100 p-3 text-xs">{JSON.stringify(detalle.datos_despues, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
