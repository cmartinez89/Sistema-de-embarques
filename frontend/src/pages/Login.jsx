import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button, Input, Label } from '../components/ui';

export default function Login() {
  const { user, login, loading, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');

  if (user) {
    return <Navigate to={location.state?.from || '/'} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const ok = await login(usuario, password);
    if (ok) navigate(location.state?.from || '/', { replace: true });
  }

  return (
    <div className="flex min-h-screen">
      <div
        className="relative hidden w-[42%] flex-col items-center justify-center overflow-hidden md:flex"
        style={{
          backgroundImage:
            'linear-gradient(135deg, var(--color-brand-300) 0%, var(--color-brand-500) 45%, var(--color-brand-700) 100%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 26px), repeating-linear-gradient(-45deg, #fff 0, #fff 1px, transparent 1px, transparent 26px)',
          }}
        />
        <div className="relative z-10 flex flex-col items-center px-8">
          <div className="flex h-40 w-40 items-center justify-center rounded-full bg-white/95 p-3 shadow-xl ring-8 ring-white/20">
            <img src="/logo-anden.png" alt="El Andén" className="h-full w-full rounded-full object-cover" />
          </div>
          <span className="mt-8 rounded-full bg-ink-950/25 px-5 py-2 text-sm font-bold uppercase tracking-wide text-white">
            Sistema de Embarques
          </span>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-cream-100 px-6">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-2xl border border-cream-300 bg-white p-8 shadow-lg"
        >
          <div className="mb-3 flex justify-center md:hidden">
            <img src="/logo-anden.png" alt="El Andén" className="h-16 w-16 rounded-full object-cover" />
          </div>
          <h1 className="text-2xl font-bold text-ink-900">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-ink-400">Ingresa tus credenciales para continuar</p>

          <div className="mt-6 space-y-4">
            <div>
              <Label>Usuario</Label>
              <Input
                autoFocus
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="admin"
                required
              />
            </div>
            <div>
              <Label>Contraseña</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>
          )}

          <Button type="submit" disabled={loading} className="mt-6 w-full">
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
