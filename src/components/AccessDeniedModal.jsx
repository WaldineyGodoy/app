import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import './AccessDeniedModal.css';

const AccessDeniedModal = ({ isOpen, onClose, onAction, title, message, actionText }) => {
    if (!isOpen) return null;

    return (
        <div className="denied-overlay" onClick={onClose}>
            <div className="denied-modal" onClick={(e) => e.stopPropagation()}>
                <button className="denied-close-btn" onClick={onClose}>
                    <X size={20} />
                </button>

                <div className="denied-icon-wrapper">
                    <AlertCircle size={40} color="#FF6600" />
                </div>

                <div className="denied-content">
                    <h3>{title || "Acesso Negado"}</h3>
                    <p>
                        {message || "Você não tem permissão para acessar esta área."}
                    </p>
                </div>

                <div className="denied-actions">
                    <button className="register-btn" onClick={onAction}>
                        {actionText || "OK"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AccessDeniedModal;
