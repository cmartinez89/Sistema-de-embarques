import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { salidasApi } from '../api/services';
import { formatDateMX, formatNumber } from '../lib/date';
import { Button, Card, PageHeader, Pill, Table } from '../components/ui';

export default function Salidas() {
  const navigate = useNavigate();
  const [salidas, setSalidas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    salidasApi.list().then(setSalidas).finally(() => setLoading(false));
  }, []);

  const folios = useMemo(() => {
    const grupos = new Map();
    for (const s of salidas) {
      if (!grupos.has(s.folio)) {
        grupos.set(s.folio, { folio: s.folio, fecha: s.fecha, cliente_nombre: s.cliente_nombre, cajas: 0, kilos: 0 });
      }
      const g = grupos.get(s.folio);
      g.cajas += Number(s.cajas || 0);
      g.kilos += Number(s.kilos || 0);
    }
    return [...grupos.values()].sort((a, b) => b.folio - a.folio);
  }, [salidas]);

  return (
    <div>
      <PageHeader
        title="Salidas"
        subtitle="Embarques registrados — cada folio agrupa varias cajas"
        actions={
          <Button variant="primary" onClick={() => navigate('/salidas/nuevo')}>
            + Nueva salida
          </Button>
        }
      />

      <Card className="p-4">
        <Table
          columns={['Folio', 'Fecha', 'Cliente', 'Cajas', 'Kilos', '']}
          empty={!loading && folios.length === 0 ? 'Sin salidas registradas — usa "Nueva salida" para empezar' : null}
        >
          {folios.map((f) => (
            <tr key={f.folio}>
              <td className="px-3 py-2 font-bold text-brand-600">{f.folio}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatDateMX(f.fecha)}</td>
              <td className="px-3 py-2">{f.cliente_nombre}</td>
              <td className="px-3 py-2"><Pill tone="blue">{f.cajas}</Pill></td>
              <td className="px-3 py-2">{formatNumber(f.kilos, 2)}</td>
              <td className="px-3 py-2">
                <button onClick={() => navigate(`/salidas/${f.folio}`)} className="text-brand-600 hover:underline">
                  Ver / continuar
                </button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
