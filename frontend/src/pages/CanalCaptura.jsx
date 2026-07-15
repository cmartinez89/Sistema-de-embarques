import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { canalesApi } from '../api/services';
import { useToast } from '../context/ToastContext';
import { todayISO, formatDateMX, formatNumber } from '../lib/date';
import {
  Banner,
  Button,
  Card,
  Field,
  Input,
  JustificacionModal,
  Modal,
  PageHeader,
  Pill,
  SectionLabel,
  Select,
  Table,
  Textarea,
} from '../components/ui';

const emptyLoteForm = {
  fecha: todayISO(),
  fecha_sacrificio: todayISO(),
  tipo_ganado: '',
  romaneaje: '',
  observaciones: '',
};

const emptyCanalForm = {
  peso_caliente: '',
  tipo: 'cuartos',
  medio_1: '',
  medio_2: '',
  cuarto_1: '',
  cuarto_2: '',
  cuarto_3: '',
  cuarto_4: '',
  observaciones: '',
};

export default function CanalCaptura() {
  const { id } = useParams();
  const esNuevo = id === 'nuevo';
  const navigate = useNavigate();
  const toast = useToast();

  const [tiposGanado, setTiposGanado] = useState([]);
  const [loteForm, setLoteForm] = useState(emptyLoteForm);
  const [siguienteNumero, setSiguienteNumero] = useState(null);
  const [loteActivo, setLoteActivo] = useState(null);
  const [loadingLote, setLoadingLote] = useState(!esNuevo);
  const [canalForm, setCanalForm] = useState(emptyCanalForm);
  const [pendientes, setPendientes] = useState([]);
  const [guardados, setGuardados] = useState([]);
  const [savingLote, setSavingLote] = useState(false);
  const [savingCanales, setSavingCanales] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [canalAEliminar, setCanalAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [canalAEditar, setCanalAEditar] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editJustificacion, setEditJustificacion] = useState('');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [subiendoPdf, setSubiendoPdf] = useState(false);
  const [viendoPdf, setViendoPdf] = useState(false);

  useEffect(() => {
    canalesApi.tiposGanado().then(setTiposGanado).catch(() => setTiposGanado([]));
  }, []);

  useEffect(() => {
    if (esNuevo) {
      canalesApi.siguienteNumeroLote().then((r) => setSiguienteNumero(r.siguiente)).catch(() => setSiguienteNumero(null));
      setLoteActivo(null);
      setLoteForm(emptyLoteForm);
      setGuardados([]);
      setPendientes([]);
      setLoadingLote(false);
      return;
    }
    setLoadingLote(true);
    Promise.all([canalesApi.getLote(id), canalesApi.getByLote(id)])
      .then(([lote, canales]) => {
        setLoteActivo(lote);
        setGuardados(canales);
      })
      .catch(() => {
        toast('No se pudo cargar el lote', 'error');
        navigate('/canales');
      })
      .finally(() => setLoadingLote(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, esNuevo]);

  const pesoFrio = useMemo(() => {
    return canalForm.tipo === 'medios'
      ? (Number(canalForm.medio_1) || 0) + (Number(canalForm.medio_2) || 0)
      : (Number(canalForm.cuarto_1) || 0) + (Number(canalForm.cuarto_2) || 0) + (Number(canalForm.cuarto_3) || 0) + (Number(canalForm.cuarto_4) || 0);
  }, [canalForm.tipo, canalForm.medio_1, canalForm.medio_2, canalForm.cuarto_1, canalForm.cuarto_2, canalForm.cuarto_3, canalForm.cuarto_4]);

  const diferenciaPct = useMemo(() => {
    const caliente = Number(canalForm.peso_caliente);
    if (!caliente) return 0;
    return Math.round(((caliente - pesoFrio) / caliente) * 100 * 100) / 100;
  }, [canalForm.peso_caliente, pesoFrio]);

  const consecutivo = pendientes.length + guardados.length + 1;
  // El peso caliente es opcional: en ocasiones no se pesa la canal en
  // caliente y solo se captura el peso frío (medios/cuartos). Si se deja
  // vacío, se guarda como 0.
  const puedeAgregar = Boolean(loteActivo);
  const puedeGuardar = pendientes.length > 0 && !savingCanales;

  async function registrarLote(e) {
    e.preventDefault();
    setSavingLote(true);
    try {
      const lote = await canalesApi.createLote(loteForm);
      if (pdfFile) {
        try {
          await canalesApi.subirRomaneajePdf(lote.id, pdfFile);
        } catch (err) {
          toast(err.response?.data?.error || 'El lote se registró, pero no se pudo subir el PDF — puedes subirlo después', 'error');
        }
      }
      toast(`Lote ${lote.numero} registrado`);
      setPdfFile(null);
      navigate(`/canales/${lote.id}`, { replace: true });
    } catch (err) {
      toast(err.response?.data?.error || 'No se pudo registrar el lote', 'error');
    } finally {
      setSavingLote(false);
    }
  }

  function agregarCanal() {
    if (!puedeAgregar) return;
    setPendientes((prev) => [
      ...prev,
      {
        ...canalForm,
        consecutivo: prev.length + guardados.length + 1,
        peso_caliente: Number(canalForm.peso_caliente) || 0,
        peso_frio: pesoFrio,
        diferencia_pct: diferenciaPct,
        medio_1: Number(canalForm.medio_1) || 0,
        medio_2: Number(canalForm.medio_2) || 0,
        cuarto_1: Number(canalForm.cuarto_1) || 0,
        cuarto_2: Number(canalForm.cuarto_2) || 0,
        cuarto_3: Number(canalForm.cuarto_3) || 0,
        cuarto_4: Number(canalForm.cuarto_4) || 0,
      },
    ]);
    setCanalForm(emptyCanalForm);
  }

  async function guardarPendientes() {
    if (!pendientes.length) return [];
    setSavingCanales(true);
    try {
      const payload = pendientes.map((p) => ({
        lote_id: loteActivo.id,
        consecutivo: p.consecutivo,
        tipo: p.tipo,
        peso_caliente: p.peso_caliente,
        peso_frio: p.peso_frio,
        diferencia_pct: p.diferencia_pct,
        medio_1: p.medio_1,
        medio_2: p.medio_2,
        cuarto_1: p.cuarto_1,
        cuarto_2: p.cuarto_2,
        cuarto_3: p.cuarto_3,
        cuarto_4: p.cuarto_4,
        fecha: loteActivo.fecha,
        observaciones: p.observaciones,
      }));
      const saved = await canalesApi.create(payload);
      setGuardados((prev) => [...prev, ...saved]);
      setPendientes([]);
      toast(`${saved.length} canal(es) guardado(s)`);
      return saved;
    } catch (err) {
      toast(err.response?.data?.error || 'No se pudieron guardar los canales', 'error');
      throw err;
    } finally {
      setSavingCanales(false);
    }
  }

  async function confirmarEliminar(justificacion) {
    if (!canalAEliminar) return;
    setEliminando(true);
    try {
      await canalesApi.remove(canalAEliminar, justificacion);
      setGuardados((prev) => prev.filter((c) => c.id !== canalAEliminar));
      toast('Registro eliminado');
      setCanalAEliminar(null);
    } catch (err) {
      toast(err.response?.data?.error || 'No se pudo eliminar', 'error');
    } finally {
      setEliminando(false);
    }
  }

  function abrirEdicion(canal) {
    setCanalAEditar(canal);
    setEditForm({
      tipo: canal.tipo,
      peso_caliente: canal.peso_caliente,
      medio_1: canal.medio_1,
      medio_2: canal.medio_2,
      cuarto_1: canal.cuarto_1,
      cuarto_2: canal.cuarto_2,
      cuarto_3: canal.cuarto_3,
      cuarto_4: canal.cuarto_4,
      observaciones: canal.observaciones || '',
    });
    setEditJustificacion('');
  }

  const editPesoFrio = useMemo(() => {
    if (!editForm) return 0;
    return editForm.tipo === 'medios'
      ? (Number(editForm.medio_1) || 0) + (Number(editForm.medio_2) || 0)
      : (Number(editForm.cuarto_1) || 0) + (Number(editForm.cuarto_2) || 0) + (Number(editForm.cuarto_3) || 0) + (Number(editForm.cuarto_4) || 0);
  }, [editForm]);

  const editDiferenciaPct = useMemo(() => {
    if (!editForm) return 0;
    const caliente = Number(editForm.peso_caliente);
    if (!caliente) return 0;
    return Math.round(((caliente - editPesoFrio) / caliente) * 100 * 100) / 100;
  }, [editForm, editPesoFrio]);

  async function guardarEdicion() {
    if (!canalAEditar || !editJustificacion.trim()) return;
    setGuardandoEdicion(true);
    try {
      const actualizado = await canalesApi.update(canalAEditar.id, {
        ...editForm,
        justificacion: editJustificacion.trim(),
      });
      setGuardados((prev) => prev.map((c) => (c.id === actualizado.id ? actualizado : c)));
      toast('Canal actualizada');
      setCanalAEditar(null);
    } catch (err) {
      toast(err.response?.data?.error || 'No se pudo actualizar la canal', 'error');
    } finally {
      setGuardandoEdicion(false);
    }
  }

  async function finalizar() {
    setFinalizando(true);
    try {
      if (pendientes.length > 0) {
        await guardarPendientes();
      }
      navigate('/canales');
    } catch {
      // el toast de error ya se mostró dentro de guardarPendientes
    } finally {
      setFinalizando(false);
    }
  }

  function volver() {
    if (pendientes.length > 0 && !window.confirm('Tienes canales sin guardar. ¿Salir sin guardarlos?')) {
      return;
    }
    navigate('/canales');
  }

  async function subirPdf() {
    if (!pdfFile || !loteActivo) return;
    if (pdfFile.type !== 'application/pdf') {
      toast('Solo se permiten archivos PDF', 'error');
      return;
    }
    setSubiendoPdf(true);
    try {
      const { romaneaje_pdf } = await canalesApi.subirRomaneajePdf(loteActivo.id, pdfFile);
      setLoteActivo((prev) => ({ ...prev, romaneaje_pdf }));
      setPdfFile(null);
      toast('PDF de romaneaje guardado');
    } catch (err) {
      toast(err.response?.data?.error || 'No se pudo subir el PDF', 'error');
    } finally {
      setSubiendoPdf(false);
    }
  }

  async function verPdf() {
    if (!loteActivo?.romaneaje_pdf) return;
    setViendoPdf(true);
    try {
      const blob = await canalesApi.verRomaneajePdf(loteActivo.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      toast('No se pudo abrir el PDF', 'error');
    } finally {
      setViendoPdf(false);
    }
  }

  const pendPesos = pendientes.reduce((s, p) => s + p.peso_caliente, 0);
  const pendDif = pendientes.reduce((s, p) => s + p.diferencia_pct, 0);
  const guardPesoCaliente = guardados.reduce((s, c) => s + Number(c.peso_caliente || 0), 0);
  const guardPesoFrio = guardados.reduce((s, c) => s + Number(c.peso_frio || 0), 0);

  const filas = [...guardados.map((g) => ({ ...g, _saved: true })), ...pendientes.map((p) => ({ ...p, _saved: false }))]
    .sort((a, b) => a.consecutivo - b.consecutivo);

  if (loadingLote) {
    return (
      <div>
        <PageHeader title="Canales / Romaneaje" subtitle="Cargando lote…" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={loteActivo ? `Lote ${loteActivo.numero}` : 'Nuevo lote'}
        subtitle={loteActivo ? 'Captura de canales de este lote' : 'Completa los datos del encabezado para registrar el lote'}
        actions={<Button variant="outline" onClick={volver}>← Volver a lotes</Button>}
      />

      {!loteActivo && (
        <Card className="p-6">
          <form onSubmit={registrarLote}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Fecha">
                <Input
                  type="date"
                  value={loteForm.fecha}
                  onChange={(e) => setLoteForm({ ...loteForm, fecha: e.target.value })}
                  required
                />
              </Field>
              <Field label="Fecha de sacrificio">
                <Input
                  type="date"
                  value={loteForm.fecha_sacrificio}
                  onChange={(e) => setLoteForm({ ...loteForm, fecha_sacrificio: e.target.value })}
                />
              </Field>
              <Field label="Lote (automático)">
                <Input value={siguienteNumero ?? '…'} disabled />
              </Field>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Tipo de ganado">
                <Select
                  value={loteForm.tipo_ganado}
                  onChange={(e) => setLoteForm({ ...loteForm, tipo_ganado: e.target.value })}
                  required
                >
                  <option value="">Selecciona…</option>
                  {tiposGanado.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Romaneaje">
                <Input
                  value={loteForm.romaneaje}
                  onChange={(e) => setLoteForm({ ...loteForm, romaneaje: e.target.value })}
                  placeholder="PROCARNE"
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="PDF de romaneaje (opcional)">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-ink-600"
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Observaciones del lote">
                <Textarea
                  rows={2}
                  value={loteForm.observaciones}
                  onChange={(e) => setLoteForm({ ...loteForm, observaciones: e.target.value })}
                  placeholder="Opcional…"
                />
              </Field>
            </div>

            <div className="mt-4">
              <Button type="submit" variant="blue" disabled={savingLote}>
                {savingLote ? 'Registrando…' : 'Registrar lote'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loteActivo && (
        <Card className="p-6">
          <div className="mb-4 rounded-lg border border-cream-300 bg-cream-50 p-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
              <p><span className="text-ink-400">Lote:</span> <span className="font-bold">{loteActivo.numero}</span></p>
              <p><span className="text-ink-400">Fecha:</span> {formatDateMX(loteActivo.fecha)}</p>
              <p><span className="text-ink-400">Sacrificio:</span> {formatDateMX(loteActivo.fecha_sacrificio)}</p>
              <p><span className="text-ink-400">Tipo:</span> {loteActivo.tipo_ganado}</p>
              <p><span className="text-ink-400">Romaneaje:</span> {loteActivo.romaneaje || '—'}</p>
              {loteActivo.observaciones && <p className="col-span-2 sm:col-span-4"><span className="text-ink-400">Obs.:</span> {loteActivo.observaciones}</p>}
            </div>
          </div>

          <SectionLabel>Romaneaje (PDF)</SectionLabel>
          <div className="mb-6 rounded-lg border border-cream-300 p-4">
            {loteActivo.romaneaje_pdf ? (
              <div className="flex flex-wrap items-center gap-3">
                <Pill tone="green">PDF cargado</Pill>
                <Button variant="outline" disabled={viendoPdf} onClick={verPdf}>
                  {viendoPdf ? 'Abriendo…' : '📄 Ver PDF'}
                </Button>
                <span className="text-xs text-ink-400">¿Necesitas reemplazarlo? Elige otro archivo abajo.</span>
              </div>
            ) : (
              <p className="mb-2 text-xs text-ink-400">Aún no se ha cargado el PDF de romaneaje de este lote.</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                className="text-sm"
              />
              <Button variant="blue" disabled={!pdfFile || subiendoPdf} onClick={subirPdf}>
                {subiendoPdf ? 'Subiendo…' : 'Subir PDF'}
              </Button>
            </div>
          </div>

          <SectionLabel>Registro de canal</SectionLabel>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-cream-300 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-400">Peso</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Caliente (kg) — opcional">
                  <Input
                    type="number"
                    step="0.01"
                    value={canalForm.peso_caliente}
                    onChange={(e) => setCanalForm({ ...canalForm, peso_caliente: e.target.value })}
                    placeholder="0.00 (si no se pesó en caliente)"
                  />
                </Field>
                <Field label="Frío (kg) — automático">
                  <Input value={pesoFrio.toFixed(2)} disabled className="font-bold text-teal-600" />
                </Field>
                <Field label="Diferencia %">
                  <Input value={diferenciaPct} disabled className="font-bold text-purple-600" />
                </Field>
              </div>
              <p className="mt-3 text-xs text-ink-400">Consecutivo de esta canal: <span className="font-bold text-ink-700">{consecutivo}</span></p>
            </div>

            <div className="rounded-lg border border-cream-300 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Canales</p>
                <div className="flex gap-3 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      checked={canalForm.tipo === 'medios'}
                      onChange={() => setCanalForm({ ...canalForm, tipo: 'medios' })}
                    />
                    Medios
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      checked={canalForm.tipo === 'cuartos'}
                      onChange={() => setCanalForm({ ...canalForm, tipo: 'cuartos' })}
                    />
                    Cuartos
                  </label>
                </div>
              </div>
              {canalForm.tipo === 'medios' ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="1/2">
                    <Input type="number" step="0.01" value={canalForm.medio_1} onChange={(e) => setCanalForm({ ...canalForm, medio_1: e.target.value })} placeholder="0.00" />
                  </Field>
                  <Field label="2/2">
                    <Input type="number" step="0.01" value={canalForm.medio_2} onChange={(e) => setCanalForm({ ...canalForm, medio_2: e.target.value })} placeholder="0.00" />
                  </Field>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {['cuarto_1', 'cuarto_2', 'cuarto_3', 'cuarto_4'].map((key, i) => (
                    <Field key={key} label={`${i + 1}/4`}>
                      <Input type="number" step="0.01" value={canalForm[key]} onChange={(e) => setCanalForm({ ...canalForm, [key]: e.target.value })} placeholder="0.00" />
                    </Field>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-cream-300 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-400">Observaciones</p>
              <Textarea
                rows={4}
                value={canalForm.observaciones}
                onChange={(e) => setCanalForm({ ...canalForm, observaciones: e.target.value })}
                placeholder="Opcional…"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant={puedeAgregar ? 'primary' : 'soft'} disabled={!puedeAgregar} onClick={agregarCanal}>
              + Agregar
            </Button>
            <Button variant={puedeGuardar ? 'blue' : 'soft'} disabled={!puedeGuardar} onClick={guardarPendientes}>
              {savingCanales ? 'Guardando…' : '💾 Guardar'}
            </Button>
            <Button variant="outline" onClick={() => setCanalForm(emptyCanalForm)}>
              Limpiar
            </Button>
            <Button variant="blue" disabled={finalizando} onClick={finalizar} className="ml-auto">
              {finalizando ? 'Finalizando…' : 'Finalizar y volver a lotes →'}
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            <Banner tone="yellow" title="Pendientes de guardar">
              <Pill tone="gray">Canales: {pendientes.length}</Pill>
              <Pill tone="blue">Pesos: {formatNumber(pendPesos, 2)}</Pill>
              <Pill tone="purple">Diferencias %: {formatNumber(pendDif, 2)}</Pill>
            </Banner>
            <Banner tone="green" title="Registros guardados">
              <Pill tone="dark">Canales: {guardados.length}</Pill>
              <Pill tone="teal">Peso caliente: {formatNumber(guardPesoCaliente, 2)}</Pill>
              <Pill tone="green">Peso frío: {formatNumber(guardPesoFrio, 2)}</Pill>
            </Banner>
          </div>

          <div className="mt-4">
            <Table
              columns={['#', 'Cons.', 'P. Caliente', 'P. Frío', 'Dif %', '1/2', '2/2', '1/4', '2/4', '3/4', '4/4', 'Obs.', '']}
              empty={filas.length === 0 ? 'Sin registros' : null}
            >
              {filas.map((f, i) => (
                <tr key={f.id ?? `pend-${i}`} className={f._saved ? '' : 'bg-amber-50/60'}>
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2">{f.consecutivo}</td>
                  <td className="px-3 py-2">{formatNumber(f.peso_caliente, 2)}</td>
                  <td className="px-3 py-2">{formatNumber(f.peso_frio, 2)}</td>
                  <td className="px-3 py-2">{formatNumber(f.diferencia_pct, 2)}</td>
                  <td className="px-3 py-2">{formatNumber(f.medio_1, 2)}</td>
                  <td className="px-3 py-2">{formatNumber(f.medio_2, 2)}</td>
                  <td className="px-3 py-2">{formatNumber(f.cuarto_1, 2)}</td>
                  <td className="px-3 py-2">{formatNumber(f.cuarto_2, 2)}</td>
                  <td className="px-3 py-2">{formatNumber(f.cuarto_3, 2)}</td>
                  <td className="px-3 py-2">{formatNumber(f.cuarto_4, 2)}</td>
                  <td className="px-3 py-2 max-w-[160px] truncate" title={f.observaciones}>{f.observaciones || '—'}</td>
                  <td className="px-3 py-2">
                    {f._saved ? (
                      <div className="flex gap-3">
                        <button onClick={() => abrirEdicion(f)} className="text-blue-600 hover:text-blue-800">
                          Editar
                        </button>
                        <button onClick={() => setCanalAEliminar(f.id)} className="text-red-500 hover:text-red-700">
                          Eliminar
                        </button>
                      </div>
                    ) : (
                      <Pill tone="orange">pendiente</Pill>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        </Card>
      )}

      <JustificacionModal
        open={!!canalAEliminar}
        title="Justifica la eliminación de esta canal"
        confirmando={eliminando}
        onCancel={() => setCanalAEliminar(null)}
        onConfirm={confirmarEliminar}
      />

      <Modal open={!!canalAEditar} onClose={() => setCanalAEditar(null)} title={`Editar canal #${canalAEditar?.consecutivo ?? ''}`} width="max-w-lg">
        {editForm && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Caliente (kg)">
                <Input
                  type="number"
                  step="0.01"
                  value={editForm.peso_caliente}
                  onChange={(e) => setEditForm({ ...editForm, peso_caliente: e.target.value })}
                />
              </Field>
              <Field label="Frío (kg) — automático">
                <Input value={editPesoFrio.toFixed(2)} disabled className="font-bold text-teal-600" />
              </Field>
              <Field label="Diferencia %">
                <Input value={editDiferenciaPct} disabled className="font-bold text-purple-600" />
              </Field>
            </div>

            <div className="flex gap-3 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={editForm.tipo === 'medios'} onChange={() => setEditForm({ ...editForm, tipo: 'medios' })} />
                Medios
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={editForm.tipo === 'cuartos'} onChange={() => setEditForm({ ...editForm, tipo: 'cuartos' })} />
                Cuartos
              </label>
            </div>

            {editForm.tipo === 'medios' ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="1/2">
                  <Input type="number" step="0.01" value={editForm.medio_1} onChange={(e) => setEditForm({ ...editForm, medio_1: e.target.value })} />
                </Field>
                <Field label="2/2">
                  <Input type="number" step="0.01" value={editForm.medio_2} onChange={(e) => setEditForm({ ...editForm, medio_2: e.target.value })} />
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {['cuarto_1', 'cuarto_2', 'cuarto_3', 'cuarto_4'].map((key, i) => (
                  <Field key={key} label={`${i + 1}/4`}>
                    <Input type="number" step="0.01" value={editForm[key]} onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })} />
                  </Field>
                ))}
              </div>
            )}

            <Field label="Observaciones">
              <Textarea rows={2} value={editForm.observaciones} onChange={(e) => setEditForm({ ...editForm, observaciones: e.target.value })} placeholder="Opcional…" />
            </Field>

            <Field label="Justificación del cambio (obligatoria)">
              <Textarea
                rows={2}
                value={editJustificacion}
                onChange={(e) => setEditJustificacion(e.target.value)}
                placeholder="Motivo de la corrección…"
              />
            </Field>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCanalAEditar(null)}>Cancelar</Button>
              <Button variant="blue" disabled={!editJustificacion.trim() || guardandoEdicion} onClick={guardarEdicion}>
                {guardandoEdicion ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
