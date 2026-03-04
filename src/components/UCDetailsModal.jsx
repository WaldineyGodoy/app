import React from 'react';
import { X, Zap, Calendar, User, FileText, Hash, Building2, Droplets } from 'lucide-react';
import './UCDetailsModal.css';

const UCDetailsModal = ({ uc, onClose }) => {
    if (!uc) return null;

    const subscriber = uc.subscriber || uc.subscribers;
    const usina = uc.usina || uc.usinas;

    const formatNumber = (val) => {
        if (!val && val !== 0) return '0';
        return Number(val).toLocaleString('pt-BR');
    };

    const statusMap = {
        ativo: { label: 'ATIVO', color: '#2ecc71', bg: '#e8f8f0' },
        em_ativacao: { label: 'EM ATIVAÇÃO', color: '#f39c12', bg: '#fef5e7' },
        aguardando_conexao: { label: 'AGUARDANDO CONEXÃO', color: '#3498db', bg: '#ebf5fb' },
        em_atraso: { label: 'EM ATRASO', color: '#e74c3c', bg: '#fdedec' },
        cancelado: { label: 'CANCELADO', color: '#95a5a6', bg: '#f2f4f4' }
    };

    const status = statusMap[uc.status] || { label: (uc.status || 'N/A').toUpperCase(), color: '#7f8c8d', bg: '#f8f9fa' };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content uc-details-modal" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    <X size={24} />
                </button>

                <header className="modal-header-premium">
                    <div className="header-icon-wrapper">
                        <Zap size={24} color="#6f42c1" />
                    </div>
                    <div className="header-text-main">
                        <h3>Detalhes da UC</h3>
                        <p>Visualização básica - <span className="highlight-text">{uc.titular_conta || subscriber?.name}</span></p>
                    </div>
                </header>

                <div className="details-grid-container">
                    {/* Linha 1 */}
                    <div className="detail-section">
                        <div className="detail-item">
                            <label><Hash size={14} /> NÚMERO DA UC</label>
                            <span className="detail-value bold">{uc.numero_uc}</span>
                        </div>
                    </div>
                    <div className="detail-section">
                        <div className="detail-item">
                            <label>STATUS</label>
                            <span className="status-badge-premium" style={{ backgroundColor: status.bg, color: status.color }}>
                                {status.label}
                            </span>
                        </div>
                    </div>

                    {/* Linha 2 */}
                    <div className="detail-section full-width">
                        <div className="detail-item">
                            <label><FileText size={14} /> IDENTIFICAÇÃO DA FATURA</label>
                            <span className="detail-value">{uc.titular_conta || '---'}</span>
                        </div>
                        <div className="detail-item text-end">
                            <label><Calendar size={14} /> VENCIMENTO</label>
                            <span className="detail-value bold">Dia {uc.dia_vencimento || 10}</span>
                        </div>
                    </div>

                    {/* Linha 3 */}
                    <div className="detail-section full-width border-bottom pb-4 mb-4">
                        <div className="detail-item">
                            <label><User size={14} /> TITULAR DA FATURA</label>
                            <span className="detail-value">{subscriber?.name || uc.titular_conta || '---'}</span>
                        </div>
                        <div className="detail-item text-end">
                            <label>CPF/CNPJ DO TITULAR</label>
                            <span className="detail-value">{subscriber?.cpf_cnpj || uc.cpf_cnpj_fatura || '---'}</span>
                        </div>
                    </div>

                    {/* Coluna Esquerda - Outros Dados */}
                    <div className="details-two-columns">
                        <div className="column">
                            <div className="detail-item compact">
                                <label>TIPO DE UNIDADE</label>
                                <span className="detail-value text-capitalize">{uc.tipo_unidade || 'Beneficiária'}</span>
                            </div>
                            <div className="detail-item compact mt-3">
                                <label><Building2 size={14} /> CONCESSIONÁRIA</label>
                                <span className="detail-value">{uc.concessionaria || 'Neoenergia Cosern'}</span>
                            </div>
                            <div className="detail-item compact mt-3">
                                <label><Droplets size={14} /> FRANQUIA (KWH)</label>
                                <span className="detail-value brand-color bold">{formatNumber(uc.franquia)} kWh</span>
                            </div>
                            <div className="detail-item compact mt-3">
                                <label>SALDO REMANESCENTE</label>
                                <span className="detail-value bold">{uc.saldo_remanescente ? 'Sim' : 'Não'}</span>
                            </div>
                        </div>

                        {/* Coluna Direita */}
                        <div className="column">
                            <div className="detail-item compact">
                                <label>DIA DE LEITURA</label>
                                <span className="detail-value">{uc.dia_vencimento ? (Number(uc.dia_vencimento) - 2 > 0 ? Number(uc.dia_vencimento) - 2 : 28) : '10'}</span>
                            </div>
                            <div className="detail-item compact mt-3">
                                <label>USINA VINCULADA</label>
                                <span className="detail-value">{usina?.name || '---'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <footer className="modal-footer-simple">
                    <button className="btn-close-modal" onClick={onClose}>Fechar</button>
                </footer>
            </div>
        </div>
    );
};

export default UCDetailsModal;
