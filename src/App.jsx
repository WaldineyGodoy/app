import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import RoleSelectionScreen from './pages/RoleSelectionScreen'
import SubscriberDashboard from './pages/SubscriberDashboard'
import AmbassadorDashboard from './pages/AmbassadorDashboard'
import SupplierDashboard from './pages/SupplierDashboard'
import InvestorArea from './pages/investidor/InvestorArea'
import InvestorPreview from './pages/investidor/InvestorPreview'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import './App.css'
import OriginatorSignup from './pages/OriginatorSignup'
import SignupRoleScreen from './pages/SignupRoleScreen'
const ProtectedRoute = ({ allowedRoles }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <div>Carregando...</div>;

  if (!user) {
    return <Navigate to="/login" state={{ from: window.location.pathname }} replace />;
  }

  // Check profile role or fallback to metadata role
  const userRole = profile?.role || user?.user_metadata?.role;

  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    // Redirect to unauthorized or home if role doesn't match
    console.warn(`Access Denied: Role '${userRole}' not in allowed list [${allowedRoles.join(', ')}]`);
    return <Navigate to="/" state={{ deniedRole: allowedRoles[0], from: window.location.pathname }} replace />;
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
            <Route path="/fornecedores/novo" element={<InvestorArea />} />
          </Route>


          {/* Só em desenvolvimento: o painel do investidor com dados de exemplo. */}
          {import.meta.env.DEV && (
            <Route path="/preview/investidor" element={<InvestorPreview />} />
          )}

          <Route path="/cadastro-embaixador" element={<OriginatorSignup />} />
          <Route path="/cadastro-parceiro" element={<SignupRoleScreen />} />

        </Routes>
      </AuthProvider>
    </UIProvider>
  )
}

export default App
