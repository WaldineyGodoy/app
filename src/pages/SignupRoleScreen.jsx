import React, { useState, useEffect } from 'react';
import { User, Users, Factory, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import RoleCard from '../components/RoleCard';
import SubscriberModal from '../components/SubscriberModal';
import SupplierModal from '../components/SupplierModal';
import OriginatorSignupForm from '../components/OriginatorSignupForm';
import B2WLogo from '../assets/B2W_Logo.png';
import './RoleSelectionScreen.css'; // Reusing existing CSS

const SignupRoleScreen = () => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [selectedRole, setSelectedRole] = useState(null); // 'subscriber', 'originator', 'supplier'

    // Safety check: Redirect if not logged in
    useEffect(() => {
        if (!user) {
            // Optional: You might want to allow viewing this page without auth if the flow changes
            // But for now, assuming auth is required as per plan
            console.log("User not logged in on Signup Screen");
            // navigate('/login'); 
        }
    }, [user, navigate]);


    const handleRoleSelect = (role) => {
        setSelectedRole(role);
    };

    const handleCloseModal = () => {
        setSelectedRole(null);
    };

    const handleSuccess = (data) => {
        // Handle successful registration
        // Maybe redirect to dashboard/role-selection or show success message?
        console.log("Registration Successful", data);
        setSelectedRole(null);
        // You might want to show a global success modal here or redirect
        // For now, let's redirect to the main role selection screen (which will redirect to dashboard)
        // But wait, they need to be approved?
        // Originators need verification? Subscribers active?

        // If generic success, maybe just reload or go to root
        navigate('/');
    };

    // If Originator is selected, we render the form in full page or just replace content?
    // OriginatorSignupForm is designed as a standalone block.
    // Let's render it over the grid.

    if (selectedRole === 'originator') {
        return (
            <div className="role-selection-container" style={{ justifyContent: 'flex-start', paddingTop: '2rem' }}>
                <div style={{ marginBottom: '1rem', width: '100%', maxWidth: '42rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button onClick={() => setSelectedRole(null)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        &larr; Voltar
                    </button>
                </div>
                <OriginatorSignupForm />
            </div>
        )
    }

    return (
        <div className="role-selection-container">
            <div className="brand-header">
                <img src={B2WLogo} alt="B2W Energia" className="brand-logo" />
            </div>
            <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                <button onClick={() => { signOut(); navigate('/login'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666' }} title="Sair">
                    <LogOut size={20} />
                </button>
            </div>

            <header className="selection-header">
                <h1>Finalize seu Cadastro</h1>
                <p>Selecione seu perfil para continuar</p>
            </header>

            <div className="cards-grid grid">
                <RoleCard
                    title="Assinantes"
                    description="Quero economizar na conta de energia."
                    icon={User}
                    color="#FF6600"
                    onClick={() => handleRoleSelect('subscriber')}
                    buttonText="Sou Assinante"
                />

                <RoleCard
                    title="Embaixadores / Originadores"
                    description="Quero indicar clientes e receber comissões."
                    icon={Users}
                    color="#8F00FF"
                    onClick={() => handleRoleSelect('originator')}
                    buttonText="Sou Embaixador"
                />

                <RoleCard
                    title="Donos de Usinas"
                    description="Tenho uma usina e quero parceiros."
                    icon={Factory}
                    color="#FFB800"
                    onClick={() => handleRoleSelect('supplier')}
                    buttonText="Sou Fornecedor"
                />
            </div>

            {selectedRole === 'subscriber' && (
                <SubscriberModal
                    userId={user?.id}
                    // Pass initial data from user if possible
                    subscriber={{
                        name: user?.user_metadata?.name || '',
                        email: user?.email || '',
                        phone: user?.user_metadata?.phone || ''
                    }}
                    onClose={handleCloseModal}
                    onSave={handleSuccess}
                />
            )}

            {selectedRole === 'supplier' && (
                <SupplierModal
                    userId={user?.id}
                    supplier={{
                        name: user?.user_metadata?.name || '',
                        email: user?.email || '',
                        phone: user?.user_metadata?.phone || ''
                    }}
                    onClose={handleCloseModal}
                    onSave={handleSuccess}
                />
            )}
        </div>
    );
};

export default SignupRoleScreen;
