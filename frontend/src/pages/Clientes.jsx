import { useEffect, useState } from 'react';
import { clientesApi } from '../api/services';
import { useToast } from '../context/ToastContext';
import { Button, Field, Input, Modal, PageHeader, Pill, Table } from '../components/ui';

const emptyForm = { nombre: '', rfc: '', contacto: '', telefono: '' };

export default function Clientes() {
  const toast = useToast();
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    clientesApi.list().then(setClientes).finally(() => setLoading(false));
  }

  useEffect(load, []);

  function abrirNuevo() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function abrirEditar(c) {
    setEditing(c);
    setForm({ nombre: c.nombre, rfc: c.rfc || '', contacto: c.contacto || '', telefono: c.telefono || '' });
    setModalOpen(true);
  }

  async function guardar(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await clientesApi.update(editing.id, { ...form, activo: editing.activo });
        toast('Cliente actualizado');
      } else {
        await clientesApi.create(form);
        toast('Cliente creado');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast(err.response?.data?.error || 'No se pudo guardar', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivo(c) {
    try {
      if (c.activo) {
        await clientesApi.remove(c.id);
      } else {
        await clientesApi.update(c.id, { ...c, activo: true });
      }
      load();
    } catch {
      toast('No se pudo actualizar', 'error');
    }
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Catálogo de clientes para salidas"
        actions={<Button onClick={abrirNuevo}>+ Nuevo cliente</Button>}
      />

      <Table
        columns={['Nombre', 'RFC', 'Contacto', 'Teléfono', 'Estado', '']}
        empty={!loading && clientes.length === 0 ? 'Sin clientes registrados' : null}
      >
        {clientes.map((c) => (
          <tr key={c.id}>
            <td className="px-3 py-2 font-medium">{c.nombre}</td>
            <td className="px-3 py-2">{c.rfc || '—'}</td>
            <td className="px-3 py-2">{c.contacto || '—'}</td>
            <td className="px-3 py-2">{c.telefono || '—'}</td>
            <td className="px-3 py-2">
              <Pill tone={c.activo ? 'green' : 'gray'}>{c.activo ? 'Activo' : 'Inactivo'}</Pill>
            </td>
            <td className="px-3 py-2 space-x-3">
              <button onClick={() => abrirEditar(c)} className="text-blue-600 hover:text-blue-800">Editar</button>
              <button onClick={() => toggleActivo(c)} className="text-red-500 hover:text-red-700">
                {c.activo ? 'Desactivar' : 'Activar'}
              </button>
            </td>
          </tr>
        ))}
      </Table>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar cliente' : 'Nuevo cliente'}>
        <form onSubmit={guardar} className="space-y-4">
          <Field label="Nombre">
            <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
          </Field>
          <Field label="RFC">
            <Input value={form.rfc} onChange={(e) => setForm({ ...form, rfc: e.target.value })} />
          </Field>
          <Field label="Contacto">
            <Input value={form.contacto} onChange={(e) => setForm({ ...form, contacto: e.target.value })} />
          </Field>
          <Field label="Teléfono">
            <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          </Field>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
