import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  {
    label: 'Operación',
    icon: '📦',
    items: [
      { to: '/canales', label: 'Canales / Romaneaje' },
      { to: '/entradas', label: 'Entradas' },
      { to: '/salidas', label: 'Salidas' },
      { to: '/existencias', label: 'Existencias' },
      { to: '/etiquetas', label: 'Etiquetas' },
    ],
  },
  {
    label: 'Reportes',
    icon: '📄',
    items: [{ to: '/reportes', label: 'Ver reportes' }],
  },
  {
    label: 'Datos',
    icon: '🗂️',
    items: [
      { to: '/clientes', label: 'Clientes' },
      { to: '/productos', label: 'Productos' },
    ],
  },
  {
    label: 'Inventario',
    icon: '⚠️',
    items: [
      { to: '/movimientos', label: 'Movimientos de inventario' },
      { to: '/inventario-inicial', label: 'Inventario inicial' },
    ],
  },
  {
    label: 'Dispositivos',
    icon: '🔌',
    items: [{ to: '/bascula', label: 'Báscula' }],
  },
];

const NAV_ADMIN = {
  label: 'Auditoría',
  icon: '🔒',
  items: [{ to: '/bitacora', label: 'Bitácora' }],
};

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const nav = user?.rol === 'admin' ? [...NAV, NAV_ADMIN] : NAV;

  return (
    <aside
      className={`flex h-screen shrink-0 flex-col bg-ink-950 text-ink-200 transition-all ${
        collapsed ? 'w-[76px]' : 'w-64'
      }`}
    >
      <div className="flex items-center gap-3 border-b border-white/5 px-4 py-4">
        <img src="/logo-anden.png" alt="El Andén" className="h-9 w-9 shrink-0 rounded-full object-cover" />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">El Andén</p>
            <p className="truncate text-xs text-ink-400">Sistema de Embarques</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-400 hover:bg-white/5 hover:text-white"
          title={collapsed ? 'Expandir' : 'Colapsar'}
        >
          {collapsed ? '»' : '‹'}
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {nav.map((group) => (
          <div key={group.label}>
            <div className={`mb-1.5 flex items-center gap-2 px-2 ${collapsed ? 'justify-center' : ''}`}>
              <span className="text-sm">{group.icon}</span>
              {!collapsed && (
                <span className="text-xs font-bold uppercase tracking-wide text-white">{group.label}</span>
              )}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `block truncate rounded-lg px-3 py-2 text-sm transition ${
                      collapsed ? 'text-center px-0' : ''
                    } ${
                      isActive
                        ? 'bg-brand-500 font-semibold text-white shadow-sm'
                        : 'text-ink-300 hover:bg-white/5 hover:text-white'
                    }`
                  }
                  title={item.label}
                >
                  {collapsed ? item.label.slice(0, 1) : item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-3 border-t border-white/5 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
          {(user?.nombre || '?').slice(0, 1).toUpperCase()}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user?.nombre}</p>
            <p className="truncate text-xs capitalize text-ink-400">{user?.rol}</p>
          </div>
        )}
        <button
          onClick={logout}
          title="Cerrar sesión"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-white/5 hover:text-white"
        >
          ⏻
        </button>
      </div>
    </aside>
  );
}
