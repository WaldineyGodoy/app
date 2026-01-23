import React from 'react';
import { Zap, FileText } from 'lucide-react';
import './UCCard.css';

const UCCard = ({ ucNumber, status, lastConsumption, amountToPay, concessionaire, onViewInvoices }) => {
    // Format currency
    const formattedAmount = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(amountToPay || 0);

    // Status Badge Logic
    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'ativo':
            case 'active':
                return '#2ecc71'; // Green
            case 'pendente':
            case 'pending':
                return '#f1c40f'; // Yellow
            case 'atrasado':
            case 'overdue':
                return '#e74c3c'; // Red
            default:
                return '#95a5a6'; // Gray
        }
    };

    return (
        <div className="uc-card">
            <div className="uc-card-header">
                <div className="uc-icon-wrapper">
                    <Zap size={20} color="#FF6600" />
                </div>
                <div className="uc-info">
                    <span className="uc-number">UC: {ucNumber}</span>
                    <span className="uc-concessionaire">{concessionaire}</span>
                </div>
                <span
                    className="uc-status-badge"
                    style={{ backgroundColor: getStatusColor(status) }}
                >
                    {status || 'Desconhecido'}
                </span>
            </div>

            <div className="uc-card-body">
                <div className="uc-stat">
                    <span className="stat-label">Último Consumo</span>
                    <span className="stat-value">{lastConsumption || 0} kWh</span>
                </div>
                <div className="uc-stat">
                    <span className="stat-label">Valor a Pagar</span>
                    <span className="stat-value highlight">{formattedAmount}</span>
                </div>
            </div>

            <div className="uc-card-footer">
                <button className="view-invoices-btn" onClick={onViewInvoices}>
                    <FileText size={16} />
                    Ver Faturas
                </button>
            </div>
        </div>
    );
};

export default UCCard;
