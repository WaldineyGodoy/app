import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import AccessDeniedModal from '../components/AccessDeniedModal';
import './RoleSelectionScreen.css';
import B2WLogo from '../assets/B2W_Logo.png';

// Images
import SubsImg from '../assets/subscribers.png';
import AmbImg from '../assets/ambassadors.png';
import SuppImg from '../assets/suppliers.png';

const RoleSelectionScreen = () => {
    const navigate = useNavigate();
    const { user, profile } = useAuth();

    const [modalState, setModalState] = useState({
        isOpen: false,
        title: '',
        message: '',
        actionText: '',
        action: () => { }
    });

    const openModal = (title, message, actionText, action) => {
        setModalState({ isOpen: true, title, message, actionText, action });
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
                action = () => { closeModal(); window.open('https://b2wenergia.com.br', '_blank'); };
            }
            openModal(title, message, actionText, action);
        }
    };

    const roles = [
        {
            title: "Assinantes",
            desc: "Consulte suas UCs, relatórios de consumo e faturas.",
            icon: "bi-house-heart",
            img: SubsImg,
            color: "#FF6600",
            path: "/assinantes",
            role: "subscriber",
            btn: "Acessar Área do Assinante"
        },
        {
            title: "Embaixadores / Originadores",
            desc: "Gerencie seus leads e acompanhe suas comissões.",
            icon: "bi-people-fill",
            img: AmbImg,
            color: "#8F00FF",
            path: "/originadores",
            role: "originator",
            btn: "Acessar Painel do Embaixador"
        },
        {
            title: "Donos de Usinas",
            desc: "Visualize a geração e performance de suas usinas.",
            icon: "bi-building-up",
            img: SuppImg,
            color: "#FFB800",
            path: "/fornecedores",
            role: "supplier",
            btn: "Acessar Painel do Fornecedor"
        }
    ];

    return (
        <div className="role-selection-wrapper">
            <div className="container py-5">
                <div className="text-center mb-5">
                    <motion.img
                        src={B2WLogo}
                        alt="B2W Energia"
                        className="b2w-main-logo mb-4"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{
                            opacity: 1,
                            scale: [1, 1.05, 1],
                        }}
                        transition={{
                            opacity: { duration: 0.8 },
                            scale: { repeat: Infinity, duration: 3, ease: "easeInOut" }
                        }}
                    />
                    <motion.h1
                        className="display-5 fw-bold text-dark"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        Bem-vindo ao Portal
                    </motion.h1>
                    <motion.p
                        className="lead text-muted"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        Selecione seu perfil de acesso
                    </motion.p>
                </div>

                <div className="row g-4 justify-content-center">
                    {roles.map((item, index) => (
                        <div key={index} className="col-12 col-md-6 col-lg-4">
                            <motion.div
                                className="role-modern-card shadow-lg h-100"
                                initial={{ opacity: 0, y: 50 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 * (index + 1), duration: 0.5 }}
                                whileHover={{ y: -10, transition: { duration: 0.2 } }}
                            >
                                <div className="card-image-wrapper">
                                    <img src={item.img} alt={item.title} className="card-top-img" />
                                    <div className="card-icon-float" style={{ backgroundColor: item.color }}>
                                        <i className={`bi ${item.icon} text-white fs-4`}></i>
                                    </div>
                                </div>
                                <div className="card-content p-4 text-center">
                                    <h3 className="h4 fw-bold mb-3">{item.title}</h3>
                                    <p className="text-muted mb-4">{item.desc}</p>
                                    <motion.button
                                        className="btn w-100 py-2 fw-bold text-white shadow-sm"
                                        style={{ backgroundColor: item.color, border: 'none' }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleRoleSelect(item.path, item.role)}
                                    >
                                        {item.btn}
                                    </motion.button>
                                </div>
                            </motion.div>
                        </div>
                    ))}
                </div>
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
