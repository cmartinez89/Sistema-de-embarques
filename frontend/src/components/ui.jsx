import { forwardRef, useEffect, useState } from 'react';

export function Card({ className = '', children }) {
  return (
    <div className={`rounded-xl border border-cream-300 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
        {subtitle && <p className="text-sm text-ink-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionLabel({ children, className = '' }) {
  return (
    <p className={`text-xs font-bold uppercase tracking-wide text-ink-400 mb-3 ${className}`}>
      {children}
    </p>
  );
}

export function Label({ children }) {
  return <label className="block text-sm font-medium text-ink-600 mb-1.5">{children}</label>;
}

const fieldBase =
  'w-full rounded-lg border border-cream-300 bg-cream-100 px-3 py-2 text-sm text-ink-800 placeholder:text-ink-300 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-200 disabled:opacity-60 disabled:cursor-not-allowed';

export const Input = forwardRef(function Input({ className = '', ...props }, ref) {
  return <input ref={ref} className={`${fieldBase} ${className}`} {...props} />;
});

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`${fieldBase} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...props }) {
  return <textarea className={`${fieldBase} resize-none ${className}`} {...props} />;
}

export function Field({ label, children }) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      {children}
    </div>
  );
}

const buttonVariants = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm',
  blue: 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm',
  outline: 'border border-cream-300 bg-white text-ink-600 hover:bg-cream-100',
  ghost: 'text-ink-500 hover:bg-cream-200',
  danger: 'bg-red-50 text-red-600 hover:bg-red-100',
  soft: 'bg-cream-200 text-ink-500 cursor-not-allowed',
};

export function Button({ variant = 'primary', className = '', disabled, children, ...props }) {
  const style = disabled ? buttonVariants.soft : buttonVariants[variant];
  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${style} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Pill({ children, tone = 'gray' }) {
  const tones = {
    gray: 'bg-ink-100 text-ink-600',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    green: 'bg-emerald-100 text-emerald-700',
    teal: 'bg-teal-100 text-teal-700',
    orange: 'bg-brand-100 text-brand-700',
    dark: 'bg-ink-800 text-white',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Banner({ tone = 'yellow', title, children }) {
  const tones = {
    yellow: 'bg-amber-50 border-amber-200',
    green: 'bg-emerald-50 border-emerald-200',
  };
  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 ${tones[tone]}`}>
      <span className="text-sm font-semibold text-ink-700">{title}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function Table({ columns, children, empty }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-cream-300">
      <table className="w-full min-w-max text-sm">
        <thead>
          <tr className="bg-ink-900 text-white">
            {columns.map((col) => (
              <th key={col} className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-cream-200 bg-white">{children}</tbody>
      </table>
      {empty && (
        <div className="py-10 text-center text-sm text-ink-300">{empty}</div>
      )}
    </div>
  );
}

export function EmptyState({ icon = '📦', title, subtitle }) {
  return (
    <Card className="p-10 text-center">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="font-semibold text-ink-700">{title}</p>
      {subtitle && <p className="text-sm text-ink-400 mt-1">{subtitle}</p>}
    </Card>
  );
}

export function Modal({ open, onClose, title, children, width = 'max-w-md' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 p-4" onClick={onClose}>
      <div
        className={`w-full ${width} rounded-xl bg-white p-6 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">{title}</h2>
          <button onClick={onClose} className="text-ink-300 hover:text-ink-600 text-xl leading-none">
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Modal genérico para pedir justificación antes de editar/eliminar un
// renglón. Queda registrado en la bitácora del sistema.
export function JustificacionModal({ open, title, onConfirm, onCancel, confirmando }) {
  const [texto, setTexto] = useState('');

  useEffect(() => {
    if (open) setTexto('');
  }, [open]);

  return (
    <Modal open={open} onClose={onCancel} title={title || 'Justificación requerida'}>
      <p className="mb-2 text-sm text-ink-500">
        Escribe el motivo de este cambio. Quedará registrado en la bitácora del sistema.
      </p>
      <Textarea
        rows={3}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Motivo…"
        autoFocus
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button
          variant="danger"
          disabled={!texto.trim() || confirmando}
          onClick={() => onConfirm(texto.trim())}
        >
          {confirmando ? 'Enviando…' : 'Confirmar'}
        </Button>
      </div>
    </Modal>
  );
}

export function StatCard({ icon, label, value, tone = 'orange' }) {
  const tones = {
    green: 'bg-emerald-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    orange: 'bg-brand-500',
  };
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white text-lg ${tones[tone]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-ink-900 leading-none">{value}</p>
        <p className="text-xs text-ink-400 mt-1">{label}</p>
      </div>
    </Card>
  );
}
