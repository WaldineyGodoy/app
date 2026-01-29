import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Users, Factory } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import RoleCard from '../components/RoleCard';
import AccessDeniedModal from '../components/AccessDeniedModal';
import './RoleSelectionScreen.css';
import B2WLogo from '../assets/B2W_Logo.png';

const RoleSelectionScreen = () => {
    const navigate = useNavigate();
    const { user, profile } = useAuth();

    // Modal State
    const [modalState, setModalState] = useState({
        isOpen: false,
        title: '',
        message: '',
        actionText: '',
        action: () => { } // Default action
    });

    const openModal = (title, message, actionText, action) => {
        setModalState({
            isOpen: true,
            title,
            message,
            actionText,
            action
        });
    };

    const closeModal = () => {
        setModalState(prev => ({ ...prev, isOpen: false }));
    };

    const handleRoleSelect = (path, requiredRole) => {
        const userRole = profile?.role || user?.user_metadata?.role;
        const allowedRoles = ['admin', 'super_admin', 'super_super_admin', requiredRole];

        if (userRole && allowedRoles.includes(userRole)) {
            navigate(path);
        } else {
            // Access Denied Logic
            let title = "Acesso Restrito";
            let message = "Você não tem permissão para acessar esta área.";
            let actionText = "Entendi";
            let action = closeModal;

            if (requiredRole === 'subscriber') {
                title = "Assinantes";
                message = "Você ainda não tem um plano de assinatura ativo conosco, aproveite para se cadastrar e começar a economizar com os nossos descontos.";
                actionText = "Conhecer Planos";
                action = () => { closeModal(); navigate('/assine'); };
            } else if (requiredRole === 'originator') {
                title = "Embaixadores / Originadores";
                message = "Você ainda não tem um link de indicação ativo conosco, aproveite para se cadastrar e começar a receber recompensas.";
                actionText = "Quero ser Embaixador";
                action = () => { closeModal(); navigate('/cadastro-embaixador'); };
            } else if (requiredRole === 'supplier') {
                title = "Donos de Usinas";
                message = "Você ainda não tem uma usina conosco, aproveite para se cadastrar e começar a faturar alto com as nossas usinas de investimento e energia por assinatura.";
                actionText = "Saiba Mais";
                action = () => { closeModal(); window.open('https://b2wenergia.com.br', '_blank'); }; // Redirect to institutional site for now
            }

            openModal(title, message, actionText, action);
        }
    };

    return (
        <div className="role-selection-container">
            <div className="brand-header">
                <img src={B2WLogo} alt="B2W Energia" className="brand-logo" />
            </div>

            <header className="selection-header">
                <h1>Bem-vindo ao Portal</h1>
                <p>Selecione seu perfil de acesso</p>
                {/* Optional Debug: <p style={{fontSize: '10px', color: '#ccc'}}>Role: {profile?.role || user?.user_metadata?.role}</p> */}
            </header>

            {/* Using 'cards-grid' class to match CSS */}
            <div className="cards-grid grid">
                <RoleCard
                    title="Assinantes"
                    description="Consulte suas UCs, relatórios de consumo e faturas."
                    icon={User}
                    color="#FF6600"
                    onClick={() => handleRoleSelect('/assinantes', 'subscriber')}
                    buttonText="Acessar Área do Assinante"
                />

                <RoleCard
                    title="Embaixadores / Originadores"
                    description="Gerencie seus leads e acompanhe suas comissões."
                    icon={Users}
                    color="#8F00FF"
                    onClick={() => handleRoleSelect('/originadores', 'originator')}
                    buttonText="Acessar Painel do Embaixador"
                />

                <RoleCard
                    title="Donos de Usinas"
                    description="Visualize a geração e performance de suas usinas."
                    icon={Factory}
                    color="#FFB800"
                    onClick={() => handleRoleSelect('/fornecedores', 'supplier')}
                    buttonText="Acessar Painel do Fornecedor"
                />
            </div>

            <AccessDeniedModal
                isOpen={modalState.isOpen}
                onClose={closeModal}
                onAction={modalState.action}
                title={modalState.title}
                message={modalState.message}
                actionText={modalState.actionText}
            />
        </div>
    );
};

export default RoleSelectionScreen;
