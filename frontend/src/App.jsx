import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Canales from './pages/Canales';
import CanalCaptura from './pages/CanalCaptura';
import Entradas from './pages/Entradas';
import Salidas from './pages/Salidas';
import Existencias from './pages/Existencias';
import Etiquetas from './pages/Etiquetas';
import Reportes from './pages/Reportes';
import Clientes from './pages/Clientes';
import Productos from './pages/Productos';
import MovimientosInventario from './pages/MovimientosInventario';
import InventarioInicial from './pages/InventarioInicial';
import Bitacora from './pages/Bitacora';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="canales" element={<Canales />} />
              <Route path="canales/:id" element={<CanalCaptura />} />
              <Route path="entradas" element={<Entradas />} />
              <Route path="salidas" element={<Salidas />} />
              <Route path="existencias" element={<Existencias />} />
              <Route path="etiquetas" element={<Etiquetas />} />
              <Route path="reportes" element={<Reportes />} />
              <Route path="clientes" element={<Clientes />} />
              <Route path="productos" element={<Productos />} />
              <Route path="movimientos" element={<MovimientosInventario />} />
              <Route path="inventario-inicial" element={<InventarioInicial />} />
              <Route path="bitacora" element={<AdminRoute><Bitacora /></AdminRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
