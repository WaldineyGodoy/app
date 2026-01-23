import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Users, Factory, Globe, Shield } from 'lucide-react';
import RoleCard from '../components/RoleCard';
import AccessDeniedModal from '../components/AccessDeniedModal';
import { checkSubscriberAccess, checkOriginatorAccess, checkSupplierAccess } from '../services/permissionService';
import './RoleSelectionScreen.css';
import B2WLogo from '../assets/B2W_Logo.png';

const RoleSelectionScreen = () => {
    const navigate = useNavigate();
    const [debugEmail, setDebugEmail] = useState('');
    const [viewMode, setViewMode] = useState('grid');

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

    const handleRoleSelect = async (role, path) => {
        let hasPermission = false;

        // --- AUTH LOGIC ---
        if (!debugEmail) {
            openModal(
                "Login Necessário",
                "Por favor, insira um e-mail para simular o login.",
                "Entendi",
                closeModal
            );
            return;
        }

        try {
            if (role === 'assinante') {
                hasPermission = await checkSubscriberAccess(debugEmail);
            } else if (role === 'originador') {
                hasPermission = await checkOriginatorAccess(debugEmail);
            } else if (role === 'fornecedor') {
                hasPermission = await checkSupplierAccess(debugEmail);
            }
        } catch (error) {
            console.error("Permission check failed", error);
            openModal("Erro", "Erro ao verificar permissão.", "Fechar", closeModal);
            return;
        }

        if (hasPermission) {
            navigate(path);
        } else {
            // Access Denied Logic - Dynamic for each role as requested
            if (role === 'originador') {
                openModal(
                    "Embaixadores",
                    "Você ainda não tem o link de divulgação, cadastre-se e venha faturar alto com indicações.",
                    "Cadastre-se e Fature",
                    () => {
                        closeModal();
                        navigate('/cadastro-embaixador');
                    }
                );
            } else if (role === 'assinante') {
                openModal(
                    "Assinantes",
                    "Este e-mail não consta como assinante ativo ou pendente.",
                    "Verificar Cadastro",
                    closeModal // Or navigate to signup if existed
                );
            } else if (role === 'fornecedor') {
                openModal(
                    "Fornecedores",
                    "Acesso restrito a parceiros geradores cadastrados.",
                    "Fale Conosco",
                    closeModal
                );
            }
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
            </header>

            <div className="debug-login-container">
                <input
                    type="email"
                    placeholder="Debug Login (E-mail)"
                    value={debugEmail}
                    onChange={(e) => setDebugEmail(e.target.value)}
                    className="debug-input"
                />
            </div>

            {/* View Toggle Buttons - Explicitly Added Back */}
            <div className="view-toggle">
                <button
                    className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setViewMode('grid')}
                    title="Visualização em Grade"
                >
                    <Globe size={18} />
                </button>
                <button
                    className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                    onClick={() => setViewMode('list')}
                    title="Visualização em Lista"
                >
                    <Shield size={18} />
                </button>
            </div>

            {/* Using 'cards-grid' class to match CSS */}
            <div className={`cards-grid ${viewMode}`}>
                <RoleCard
                    title="Assinantes"
                    description="Consulte suas UCs, relatórios de consumo e faturas."
                    icon={User}
                    color="#FF6600"
                    onClick={() => handleRoleSelect('assinante', '/assinantes')}
                    buttonText="Acessar Área do Assinante"
                />

                <RoleCard
                    title="Embaixadores / Originadores"
                    description="Gerencie seus leads e acompanhe suas comissões."
                    icon={Users}
                    color="#8F00FF"
                    onClick={() => handleRoleSelect('originador', '/originadores')}
                    buttonText="Acessar Painel do Embaixador"
                />

                <RoleCard
                    title="Donos de Usinas"
                    description="Visualize a geração e performance de suas usinas."
                    icon={Factory}
                    color="#FFB800"
                    onClick={() => handleRoleSelect('fornecedor', '/fornecedores')}
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
