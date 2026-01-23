import React from 'react';
import { X, Eye, Download, FileText } from 'lucide-react';
import './InvoicesModal.css';

const InvoicesModal = ({ isOpen, onClose, ucData, invoices }) => {
    if (!isOpen) return null;

    // Helper to format currency
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    // Helper to format date (YYYY-MM-DD -> MM/YYYY or similar)
    const formatDate = (dateString, type = 'short') => {
        if (!dateString) return '-';
        if (type === 'ref') {
            // Assumes YYYY-MM-DD
            const [year, month] = dateString.split('-');
            return `${month}/${year}`;
        }
        return new Date(dateString).toLocaleDateString('pt-BR');
    };

    const getStatusBadge = (status) => {
        let colorClass = 'gray';
        const s = status?.toLowerCase() || '';

        if (s.includes('paid') || s.includes('paga') || s === 'recebida') colorClass = 'green';
        else if (s.includes('pending') || s.includes('pendente') || s === 'enviada') colorClass = 'yellow';
        else if (s.includes('overdue') || s.includes('atrasada') || s === 'vencida') colorClass = 'red';

        return <span className={`status-badge ${colorClass}`}>{status || 'N/A'}</span>;
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                <header className="modal-header">
                    <div className="modal-title">
                        <FileText size={24} color="#FF6600" />
                        <div>
                            <h2>Faturas da UC: {ucData?.numero_uc || ucData?.consumer_unit_number || 'N/A'}</h2>
                            <p>{ucData?.concessionaria || ucData?.distributor}</p>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                </header>

                <div className="modal-body">
                    {invoices && invoices.length > 0 ? (
                        <div className="invoices-list">
                            <div className="list-header">
                                <span>Status</span>
                                <span>Referência</span>
                                <span>Valor</span>
                                <span className="actions-header">Ações</span>
                            </div>
                            <div className="list-content">
                                {invoices.map((inv) => (
                                    <div key={inv.id} className="invoice-item">
                                        <div className="inv-col status">
                                            {getStatusBadge(inv.status || inv.asaas_status)}
                                        </div>
                                        <div className="inv-col ref">
                                            <span className="mobile-label">Referência:</span>
                                            {formatDate(inv.mes_referencia, 'ref')}
                                        </div>
                                        <div className="inv-col value">
                                            <span className="mobile-label">Valor:</span>
                                            {formatCurrency(inv.valor_a_pagar)}
                                        </div>
                                        <div className="inv-col actions">
                                            {inv.asaas_boleto_url ? (
                                                <>
                                                    <a
                                                        href={inv.asaas_boleto_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="action-btn view"
                                                        title="Visualizar Boleto"
                                                    >
                                                        <Eye size={18} />
                                                    </a>
                                                    <a
                                                        href={inv.asaas_boleto_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="action-btn download"
                                                        title="Baixar Boleto"
                                                        download
                                                    >
                                                        <Download size={18} />
                                                    </a>
                                                </>
                                            ) : (
                                                <span className="no-action">-</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="no-invoices-state">
                            <p>Nenhuma fatura encontrada para esta unidade.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InvoicesModal;
