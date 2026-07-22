import { useState } from 'react';
import { useBascula } from '../context/BasculaContext';
import { PRESETS_BASCULA } from '../lib/bascula';
import { Button, Card, Field, Input, PageHeader, Pill, Select } from '../components/ui';

export default function ConfiguracionBascula() {
  const { config, actualizarConfig, conectada, conectando, peso, log, error, conectar, desconectar, disponible } = useBascula();
  const [form, setForm] = useState(config);

  function guardarYConectar() {
    actualizarConfig(form);
    conectar(form);
  }

  return (
    <div>
      <PageHeader
        title="Báscula"
        subtitle="Configura y prueba la conexión con la báscula conectada por puerto serial en esta máquina"
      />

      {!disponible && (
        <Card className="mb-4 border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">
            Este navegador no soporta acceso a puertos seriales. Usa Google Chrome o Microsoft Edge en la máquina donde está conectada la báscula.
          </p>
        </Card>
      )}

      <Card className="mb-4 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Velocidad (baud rate)">
            <Select value={form.baudRate} disabled={conectada} onChange={(e) => setForm({ ...form, baudRate: Number(e.target.value) })}>
              {[1200, 2400, 4800, 9600, 19200, 38400].map((b) => <option key={b} value={b}>{b}</option>)}
            </Select>
          </Field>
          <Field label="Bits de datos">
            <Select value={form.dataBits} disabled={conectada} onChange={(e) => setForm({ ...form, dataBits: Number(e.target.value) })}>
              <option value={7}>7</option>
              <option value={8}>8</option>
            </Select>
          </Field>
          <Field label="Paridad">
            <Select value={form.parity} disabled={conectada} onChange={(e) => setForm({ ...form, parity: e.target.value })}>
              <option value="none">Ninguna</option>
              <option value="even">Par</option>
              <option value="odd">Non</option>
            </Select>
          </Field>
          <Field label="Bits de parada">
            <Select value={form.stopBits} disabled={conectada} onChange={(e) => setForm({ ...form, stopBits: Number(e.target.value) })}>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </Select>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Patrón para extraer el peso (expresión regular con un grupo de captura)">
            <Input
              value={form.patron}
              disabled={conectada}
              onChange={(e) => setForm({ ...form, patron: e.target.value })}
              placeholder={String.raw`(-?\d+\.\d+)`}
              className="font-mono text-sm"
            />
          </Field>
          <div className="mt-2 flex flex-wrap gap-2">
            {PRESETS_BASCULA.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={conectada}
                onClick={() => setForm((f) => ({ ...f, patron: p.patron }))}
                className="rounded-full bg-cream-200 px-3 py-1 text-xs text-ink-600 hover:bg-cream-300 disabled:opacity-50"
              >
                {p.nombre}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-400">
            Escribe algo aquí y da clic en "Guardar y conectar" — el navegador te pedirá elegir el puerto COM. Revisa
            "Datos crudos" abajo para ver qué manda realmente la báscula y ajustar el patrón si no detecta el peso.
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          {!conectada ? (
            <Button variant="primary" disabled={!disponible || conectando} onClick={guardarYConectar}>
              {conectando ? 'Conectando…' : '🔌 Guardar y conectar'}
            </Button>
          ) : (
            <Button variant="danger" onClick={desconectar}>Desconectar</Button>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </Card>

      <Card className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink-700">Prueba en vivo</p>
          <Pill tone={conectada ? 'green' : 'gray'}>{conectada ? 'Conectada' : 'Desconectada'}</Pill>
        </div>
        <div className="mb-4 rounded-lg border-2 border-dashed border-cream-300 bg-cream-50 p-6 text-center">
          <p className="text-xs uppercase tracking-wide text-ink-400">Peso detectado</p>
          <p className="text-3xl font-bold text-brand-600">{peso !== null ? `${peso} kg` : '—'}</p>
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-400">Datos crudos recibidos (últimas líneas)</p>
        <div className="max-h-48 overflow-auto rounded-lg bg-ink-950 p-3 font-mono text-xs text-emerald-400">
          {log.length === 0 ? <p className="text-ink-500">Sin datos aún…</p> : log.map((l, i) => <p key={i}>{l}</p>)}
        </div>
      </Card>
    </div>
  );
}
