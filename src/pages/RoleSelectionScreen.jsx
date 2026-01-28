import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Users, Factory } from 'lucide-react';
import RoleCard from '../components/RoleCard';
import AccessDeniedModal from '../components/AccessDeniedModal';
import './RoleSelectionScreen.css';
import B2WLogo from '../assets/B2W_Logo.png';

const RoleSelectionScreen = () => {
    const navigate = useNavigate();


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

    const handleRoleSelect = (path) => {
        // Simple navigation - ProtectedRoute handles auth
        navigate(path);
    };

    return (
        <div className="role-selection-container">
            <div className="brand-header">
                <img src={B2WLogo} alt="B2W Energia" className="brand-logo" />
            </div>

            <header className="selection-header">
                <h1>Bem-vindo ao Portal</h1>
                <p>Selecione seu perfil de acesso</p>
            </header>

            {/* Using 'cards-grid' class to match CSS */}
            <div className="cards-grid grid">
                <RoleCard
                    title="Assinantes"
                    description="Consulte suas UCs, relatórios de consumo e faturas."
                    icon={User}
                    color="#FF6600"
                    onClick={() => handleRoleSelect('/assinantes')}
                    buttonText="Acessar Área do Assinante"
                />

                <RoleCard
                    title="Embaixadores / Originadores"
                    description="Gerencie seus leads e acompanhe suas comissões."
                    icon={Users}
                    color="#8F00FF"
                    onClick={() => handleRoleSelect('/originadores')}
                    buttonText="Acessar Painel do Embaixador"
                />

                <RoleCard
                    title="Donos de Usinas"
                    description="Visualize a geração e performance de suas usinas."
                    icon={Factory}
                    color="#FFB800"
                    onClick={() => handleRoleSelect('/fornecedores')}
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
