import { useEffect, useState } from 'react';
import { productosApi } from '../api/services';
import { useToast } from '../context/ToastContext';
import { Button, Field, Input, Modal, PageHeader, Pill, Select, Table } from '../components/ui';

const emptyForm = { codigo: '', nombre: '', tipo_ganado: 'Ambos' };

export default function Productos() {
  const toast = useToast();
  const [productos, setProductos] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    productosApi.list().then(setProductos).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    productosApi.tiposGanado().then(setTipos).catch(() => setTipos([]));
  }, []);

  function abrirNuevo() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function abrirEditar(p) {
    setEditing(p);
    setForm({ codigo: p.codigo, nombre: p.nombre, tipo_ganado: p.tipo_ganado || 'Ambos' });
    setModalOpen(true);
  }

  async function guardar(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await productosApi.update(editing.id, { ...form, activo: editing.activo });
        toast('Producto actualizado');
      } else {
        await productosApi.create(form);
        toast('Producto creado');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast(err.response?.data?.error || 'No se pudo guardar', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivo(p) {
    try {
      if (p.activo) {
        await productosApi.remove(p.id);
      } else {
        await productosApi.update(p.id, { ...p, activo: true });
      }
      load();
    } catch {
      toast('No se pudo actualizar', 'error');
    }
  }

  return (
    <div>
      <PageHeader
        title="Productos"
        subtitle="Catálogo de cortes / productos"
        actions={<Button onClick={abrirNuevo}>+ Nuevo producto</Button>}
      />

      <Table
        columns={['Código', 'Nombre', 'Tipo de ganado', 'Estado', '']}
        empty={!loading && productos.length === 0 ? 'Sin productos registrados' : null}
      >
        {productos.map((p) => (
          <tr key={p.id}>
            <td className="px-3 py-2 font-medium">{p.codigo}</td>
            <td className="px-3 py-2">{p.nombre}</td>
            <td className="px-3 py-2">{p.tipo_ganado}</td>
            <td className="px-3 py-2">
              <Pill tone={p.activo ? 'green' : 'gray'}>{p.activo ? 'Activo' : 'Inactivo'}</Pill>
            </td>
            <td className="px-3 py-2 space-x-3">
              <button onClick={() => abrirEditar(p)} className="text-blue-600 hover:text-blue-800">Editar</button>
              <button onClick={() => toggleActivo(p)} className="text-red-500 hover:text-red-700">
                {p.activo ? 'Desactivar' : 'Activar'}
              </button>
            </td>
          </tr>
        ))}
      </Table>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar producto' : 'Nuevo producto'}>
        <form onSubmit={guardar} className="space-y-4">
          <Field label="Código">
            <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} required />
          </Field>
          <Field label="Nombre">
            <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
          </Field>
          <Field label="Tipo de ganado">
            <Select value={form.tipo_ganado} onChange={(e) => setForm({ ...form, tipo_ganado: e.target.value })}>
              {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
