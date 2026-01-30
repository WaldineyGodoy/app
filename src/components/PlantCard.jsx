import React from 'react';
import { Activity, Zap, Users, FileText, BarChart2 } from 'lucide-react';
import './PlantCard.css';

const PlantCard = ({ usina, onOpenGraphs, onOpenInvoices }) => {
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
                <div className="plant-stat">
                    <span className="stat-label">Geração (Último Mês)</span>
                    <div className="stat-value-row">
                        <Zap size={18} color="#FF6600" />
                        <span className="stat-value">{formatNumber(usina.generation)} kWh</span>
                    </div>
                </div>

                <div className="plant-stat">
                    <span className="stat-label">UCs Vinculadas</span>
                    <div className="stat-value-row">
                        <Users size={18} color="#003366" />
                        <span className="stat-value">{usina.ucCount}</span>
                    </div>
                </div>

                <div className="plant-stat">
                    <span className="stat-label">Consumo Vinc. (Último Mês)</span>
                    <div className="stat-value-row">
                        <Zap size={18} color="#7f8c8d" /> {/* Grey for secondary consumption */}
                        <span className="stat-value secondary">{formatNumber(usina.kwhConsumption)} kWh</span>
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
