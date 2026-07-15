import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { canalesApi, entradasApi, existenciasApi, salidasApi } from '../api/services';
import { Card, PageHeader, StatCard } from '../components/ui';
import { todayISO } from '../lib/date';

export default function Dashboard() {
  const [stats, setStats] = useState({ entradas: 0, salidas: 0, existencias: 0, canales: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const today = todayISO();

    async function load() {
      const [entradas, salidas, existencias, lotes] = await Promise.all([
        entradasApi.list({ fecha: today }).catch(() => []),
        salidasApi.list({ fecha: today }).catch(() => []),
        existenciasApi.list().catch(() => []),
        canalesApi.getLotes().catch(() => []),
      ]);

      const lotesHoy = lotes.filter((l) => String(l.fecha).slice(0, 10) === today);
      const canalesHoy = await Promise.all(
        lotesHoy.map((l) => canalesApi.getByLote(l.id).catch(() => []))
      );

      if (!alive) return;
      setStats({
        entradas: entradas.length,
        salidas: salidas.length,
        existencias: existencias.length,
        canales: canalesHoy.reduce((sum, arr) => sum + arr.length, 0),
      });
      setLoading(false);
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const val = (n) => (loading ? '—' : n);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Empacadora Carnes Finas el Andén — TIF No. 680" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="↓" label="Entradas hoy" value={val(stats.entradas)} tone="green" />
        <StatCard icon="↑" label="Salidas hoy" value={val(stats.salidas)} tone="red" />
        <StatCard icon="≡" label="Existencias" value={val(stats.existencias)} tone="blue" />
        <StatCard icon="⚖" label="Canales hoy" value={val(stats.canales)} tone="orange" />
      </div>

      <Card className="mt-6 p-6">
        <p className="mb-4 text-sm font-semibold text-ink-700">Accesos rápidos</p>
        <div className="flex flex-wrap gap-2">
          <Link to="/canales" className="rounded-lg border border-cream-300 px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-cream-100">
            Registrar canales
          </Link>
          <Link to="/entradas" className="rounded-lg border border-cream-300 px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-cream-100">
            Registrar entrada
          </Link>
          <Link to="/salidas" className="rounded-lg border border-cream-300 px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-cream-100">
            Registrar salida
          </Link>
          <Link to="/existencias" className="rounded-lg border border-cream-300 px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-cream-100">
            Ver existencias
          </Link>
          <Link to="/reportes" className="rounded-lg border border-cream-300 px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-cream-100">
            Ver reportes
          </Link>
        </div>
      </Card>
    </div>
  );
}
