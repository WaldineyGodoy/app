import React from 'react';
import { Activity, Zap, Users, FileText, BarChart2 } from 'lucide-react';
import './PlantCard.css';

const PlantCard = ({ usina, onOpenGraphs, onOpenInvoices, onOpenUCs }) => {
    // Determine status color
    const getStatusColor = (status) => {
        const s = status?.toLowerCase() || '';
        if (s.includes('active') || s.includes('ativa') || s.includes('operacao') || s.includes('gerando')) return 'green';
        if (s.includes('maintenance') || s.includes('manutencao')) return 'yellow';
        if (s.includes('inactive') || s.includes('inativa')) return 'red';
        return 'gray';
    };

    const statusColor = getStatusColor(usina.status);

    const formatNumber = (num) => new Intl.NumberFormat('pt-BR').format(num || 0);

    return (
        <div className="plant-card">
            <div className="plant-header">
                <h3>{usina.name || 'Usina Sem Nome'}</h3>
                <span className={`plant-status ${statusColor}`}>{usina.status || 'Desconhecido'}</span>
            </div>

            <div className="plant-body">
                <div className="plant-stat mb-3">
                    <span className="stat-label">Geração (Último Mês)</span>
                    <div className="stat-value-row">
                        <Zap size={20} className="orange-text" />
                        <span className="stat-value">{formatNumber(usina.generation)} kWh</span>
                    </div>
                    <div className="stat-subtext orange-text fw-bold">
                        Recebível: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(usina.plantReceivable || 0)}
                    </div>
                </div>

                <div className="plant-stat clickable mb-3" onClick={onOpenUCs} title="Ver lista de UCs">
                    <span className="stat-label">UCs Vinculadas</span>
                    <div className="stat-value-row">
                        <Users size={20} style={{ color: 'var(--primary)' }} />
                        <span className="stat-value">{usina.ucCount} unidades</span>
                    </div>
                </div>

                <div className="plant-stat">
                    <span className="stat-label">Capacidade</span>
                    <div className="stat-value-row">
                        <Activity size={20} style={{ color: 'var(--text-muted)' }} />
                        <span className="stat-value secondary">{formatNumber(usina.committedCapacity)} kWh</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                        <div className="stat-subtext orange-text">
                            Ocupação: {Math.round(usina.occupation || 0)}%
                        </div>
                        <div className="stat-subtext" style={{ color: 'var(--text-muted)' }}>
                            Vacância: {Math.round(usina.vacancy || 0)}%
                        </div>
                    </div>
                </div>
            </div>

            <div className="plant-footer">
                <button className="plant-action-btn" onClick={() => onOpenGraphs(usina)}>
                    <BarChart2 size={18} />
                    Gráficos
                </button>
                <button className="plant-action-btn" onClick={() => onOpenInvoices(usina)}>
                    <FileText size={18} />
                    Faturamento
                </button>
            </div>
        </div>
    );
};

export default PlantCard;
