import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import RoleSelectionScreen from './pages/RoleSelectionScreen'
import SubscriberDashboard from './pages/SubscriberDashboard'
import AmbassadorDashboard from './pages/AmbassadorDashboard'
import SupplierDashboard from './pages/SupplierDashboard'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import './App.css'
import OriginatorSignup from './pages/OriginatorSignup'
const ProtectedRoute = ({ allowedRoles }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <div>Carregando...</div>;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    // Redirect to unauthorized or home if role doesn't match
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

import { UIProvider } from './contexts/UIContext'

function App() {
  return (
    <UIProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/assine" element={<LandingPage />} />

          {/* Public or General routes */}
          <Route path="/" element={<RoleSelectionScreen />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute allowedRoles={['subscriber', 'admin', 'super_admin']} />}>
            <Route path="/assinantes" element={<SubscriberDashboard />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['originator', 'admin', 'super_admin']} />}>
            <Route path="/originadores" element={<AmbassadorDashboard />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['supplier', 'admin', 'super_admin']} />}>
            <Route path="/fornecedores" element={<SupplierDashboard />} />
          </Route>

          <Route path="/cadastro-embaixador" element={<OriginatorSignup />} />

        </Routes>
      </AuthProvider>
    </UIProvider>
  )
}

export default App
