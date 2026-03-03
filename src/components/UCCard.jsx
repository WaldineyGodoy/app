import React from 'react';
import { Zap, FileText, CreditCard, Calendar, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import './UCCard.css';

const UCCard = ({
    ucNumber,
    identification,
    concessionaire,
    ucStatus,
    invoiceStatus,
    lastConsumption,
    compensatedConsumption,
    invoiceDueDate,
    amountToPay,
    paymentUrl,
    onViewInvoices
}) => {

    // Format currency
    const formattedAmount = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(amountToPay || 0);

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    };

    // Status Badge Colors (B2W Standard)
    const getStatusColor = (status, type) => {
        const s = status?.toLowerCase();

        // UC Status Colors
        if (type === 'uc') {
            switch (s) {
                case 'ativo': return '#2ecc71'; // Verde
                case 'cancelado': return '#e74c3c'; // Vermelho
                case 'em_atraso': return '#e67e22'; // Laranja escuro
                default: return '#34495e'; // Navy/Gray
            }
        }

        // Invoice Status Colors
        switch (s) {
            case 'pago': return '#2980b9'; // Blue
            case 'atrasado': return '#e74c3c'; // Red
            case 'a_vencer': return '#27ae60'; // Green
            default: return '#7f8c8d';
        }
    };

    // Show Pay Button only if pending/overdue
    const canPay = (invoiceStatus?.toLowerCase() === 'a_vencer' || invoiceStatus?.toLowerCase() === 'atrasado') && paymentUrl;

    return (
        <motion.div
            className="uc-card-enhanced"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            whileHover={{ scale: 1.01 }}
        >
            <div className="card-header-top">
                <div className="uc-main-info">
                    <div className="uc-badge">
                        <Zap size={14} fill="#FF6600" color="#FF6600" />
                        <span>UC: {ucNumber}</span>
                    </div>
                    {identification && <div className="uc-identification-text">{identification}</div>}
                    {/* Item 4: Identificação da fatura/concessionaria */}
                    <span className="uc-concessionaire-text">{concessionaire}</span>
                </div>

                <div className="status-badges-group">
                    {/* Item 2: Status UC */}
                    <div className="badge-wrapper">
                        <small>Status UC</small>
                        <span className="status-dot" style={{ backgroundColor: getStatusColor(ucStatus, 'uc') }}>
                            {ucStatus}
                        </span>
                    </div>
                    {/* Item 3: Status Fatura */}
                    <div className="badge-wrapper">
                        <small>Fatura</small>
                        <span className="status-dot-outline" style={{ borderColor: getStatusColor(invoiceStatus, 'inv'), color: getStatusColor(invoiceStatus, 'inv') }}>
                            {invoiceStatus?.toLowerCase() === 'a_vencer' ? 'A vencer' : (invoiceStatus || 'Sem Fatura')}
                        </span>
                    </div>
                </div>
            </div>

            <div className="card-metrics-grid">
                <div className="metric-item">
                    <div className="metric-label">
                        <BarChart3 size={14} />
                        <span>Consumo Compensado</span>
                    </div>
                    {/* Item 1: Consumo Compensado */}
                    <div className="metric-value">{compensatedConsumption || 0} <small>kWh</small></div>
                    {/* Item 7: Data Vencimento */}
                    <div className="metric-sub-label">
                        <Calendar size={12} />
                        <span>Venc: {formatDate(invoiceDueDate)}</span>
                    </div>
                </div>

                <div className="metric-item highlight">
                    <div className="metric-label">Valor a Pagar</div>
                    <div className="metric-value-large">{formattedAmount}</div>

                    {/* Item 8: Botão Pagar */}
                    {canPay && (
                        <a
                            href={paymentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="pay-now-btn"
                        >
                            <CreditCard size={14} />
                            Pagar
                        </a>
                    )}
                </div>
            </div>

            <div className="card-footer-actions">
                {/* Item 5: Alterar para Detalhamentos */}
                <button className="details-button" onClick={onViewInvoices}>
                    <FileText size={14} />
                    Detalhamentos
                </button>
            </div>
        </motion.div>
    );
};

export default UCCard;
