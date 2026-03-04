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
                        <Zap size={18} color="#FF6600" />
                        <span className="stat-value">{formatNumber(usina.generation)} kWh</span>
                    </div>
                    {/* [NEW] Valor a receber */}
                    <div className="stat-subtext orange-text fw-bold mt-1">
                        Valor a receber: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(usina.plantReceivable || 0)}
                    </div>
                </div>

                <div className="plant-stat clickable mb-3" onClick={onOpenUCs} title="Ver lista de UCs">
                    <span className="stat-label">UCs Vinculadas</span>
                    <div className="stat-value-row">
                        <Users size={18} color="#003366" />
                        <span className="stat-value">{usina.ucCount}</span>
                    </div>
                </div>

                <div className="plant-stat">
                    <span className="stat-label">Capacidade Comprometida</span>
                    <div className="stat-value-row">
                        <Zap size={18} color="#7f8c8d" />
                        <span className="stat-value secondary">{formatNumber(usina.committedCapacity)} kWh</span>
                    </div>
                    {/* [NEW] Ocupação e Vacância */}
                    <div className="mt-2">
                        <div className="stat-subtext orange-text fw-semibold">
                            Ocupação: {Math.round(usina.occupation || 0)}%
                        </div>
                        <div className="stat-subtext text-muted">
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
