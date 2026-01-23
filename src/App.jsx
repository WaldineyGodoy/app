import { Routes, Route } from 'react-router-dom'
import RoleSelectionScreen from './pages/RoleSelectionScreen'
import SubscriberDashboard from './pages/SubscriberDashboard'
import AmbassadorDashboard from './pages/AmbassadorDashboard'
import SupplierDashboard from './pages/SupplierDashboard'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<RoleSelectionScreen />} />
      <Route path="/assinantes" element={<SubscriberDashboard />} />
      <Route path="/originadores" element={<AmbassadorDashboard />} />
      <Route path="/cadastro-embaixador" element={<div className="placeholder-page"><h1>Cadastro de Embaixador</h1><p>Formulário de cadastro aqui.</p></div>} />
      <Route path="/fornecedores" element={<SupplierDashboard />} />
    </Routes>
  )
}

export default App
