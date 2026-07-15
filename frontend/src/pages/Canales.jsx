import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { canalesApi } from '../api/services';
import { formatDateMX, formatNumber } from '../lib/date';
import { Button, Card, PageHeader, Pill, Table } from '../components/ui';

export default function Canales() {
  const navigate = useNavigate();
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    canalesApi.getLotes().then(setLotes).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Canales / Romaneaje"
        subtitle="Lotes registrados — cada lote agrupa varias canales"
        actions={
          <Button variant="primary" onClick={() => navigate('/canales/nuevo')}>
            + Nuevo lote
          </Button>
        }
      />

      <Card className="p-4">
        <Table
          columns={['Folio', 'Fecha', 'Fecha sacrificio', 'Tipo de ganado', 'Romaneaje', 'Canales', 'P. Caliente', 'P. Frío', '']}
          empty={!loading && lotes.length === 0 ? 'Sin lotes registrados — usa "Nuevo lote" para empezar' : null}
        >
          {lotes.map((l) => (
            <tr key={l.id}>
              <td className="px-3 py-2 font-bold text-brand-600">{l.numero}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatDateMX(l.fecha)}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatDateMX(l.fecha_sacrificio)}</td>
              <td className="px-3 py-2">{l.tipo_ganado}</td>
              <td className="px-3 py-2">{l.romaneaje || '—'}</td>
              <td className="px-3 py-2"><Pill tone="blue">{l.num_canales}</Pill></td>
              <td className="px-3 py-2">{formatNumber(l.peso_caliente_total, 2)}</td>
              <td className="px-3 py-2">{formatNumber(l.peso_frio_total, 2)}</td>
              <td className="px-3 py-2">
                <button onClick={() => navigate(`/canales/${l.id}`)} className="text-brand-600 hover:underline">
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
