import React from 'react';
import { Activity, Zap, Users, FileText, BarChart2, Coins } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import './PlantCard.css';

const PlantCard = ({ usina, onOpenGraphs, onOpenInvoices, onOpenUCs, onOpenLedger }) => {
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

    const gen = usina.generation || 0;
    const cons = usina.consumption || 0;
    const est = usina.estimatedGen || 0;
    const comp = usina.committedCapacity || 0;

    const consPercent = gen > 0 ? (cons / gen) * 100 : 0;
    const occPercent = est > 0 ? (comp / est) * 100 : 0;

    const getConsumptionColor = (pct) => {
        if (pct < 40) return '#ef4444'; // red
        if (pct < 70) return '#f59e0b'; // orange
        if (pct < 90) return '#84cc16'; // light green
        return '#10b981'; // green
    };

    const getOccupationColor = (pct) => {
        if (pct > 100) return '#ef4444'; // overbook -> red
        if (pct < 40) return '#ef4444'; // red
        if (pct < 70) return '#f59e0b'; // orange
        if (pct < 90) return '#84cc16'; // light green
        return '#10b981'; // green
    };

    const consColor = getConsumptionColor(consPercent);
    const occColor = getOccupationColor(occPercent);

    return (
        <div className="plant-card">
            <div className="plant-header">
                <h3>{usina.name || 'Usina Sem Nome'}</h3>
                <span className={`plant-status ${statusColor}`}>{usina.status || 'Desconhecido'}</span>
            </div>

            <div className="plant-body">
                {/* 1. UCs vinculadas */}
                <div className="plant-stat clickable mb-3" onClick={onOpenUCs} title="Ver lista de UCs" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                    <span className="stat-label" style={{ fontWeight: '600', textTransform: 'uppercase', fontSize: '0.7rem' }}>UCs Vinculadas</span>
                    <div className="stat-value-row">
                        <Users size={20} style={{ color: 'var(--primary)' }} />
                        <span className="stat-value" style={{ fontSize: '1.1rem' }}>{usina.ucCount} unidades</span>
                    </div>
                </div>

                {/* CYCLE STRING */}
                <div style={{ marginBottom: '0.75rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                    Período: {usina.cycleString || 'Último Mês'}
                </div>

                {/* 2. Geração x Consumo */}
                <div className="plant-stat mb-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: '0.5rem', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                    <div>
                        <span className="stat-label" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>Geração</span>
                        <div className="stat-value-row">
                            <Zap size={16} className="orange-text" />
                            <span className="stat-value" style={{ fontSize: '1rem' }}>{formatNumber(gen)} kWh</span>
                        </div>
                    </div>
                    <div>
                        <span className="stat-label" style={{ color: consColor, textTransform: 'uppercase', fontSize: '0.7rem' }}>Consumo</span>
                        <div className="stat-value-row">
                            <span className="stat-value" style={{ fontSize: '1rem', color: consColor }}>{formatNumber(cons)} kWh</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: consColor, fontWeight: 600, marginTop: '2px' }}>
                            Consumo: {consPercent.toFixed(1)}%
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <PieChart width={40} height={40}>
                            <Pie
                                data={[
                                    { name: 'Consumo', value: cons, color: consColor },
                                    { name: 'Livre', value: Math.max(0, gen - cons), color: '#e2e8f0' }
                                ]}
                                dataKey="value"
                                innerRadius={12}
                                outerRadius={20}
                                startAngle={90}
                                endAngle={-270}
                            >
                                {[0, 1].map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 0 ? consColor : '#e2e8f0'} />
                                ))}
                            </Pie>
                            <Tooltip content={() => null} />
                        </PieChart>
                    </div>
                </div>

                {/* 3. Ger. Estimada x Comprometimento */}
                <div className="plant-stat" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: '0.5rem', alignItems: 'center' }}>
                    <div>
                        <span className="stat-label" style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '0.7rem' }}>Ger. Estimada</span>
                        <div className="stat-value-row">
                            <span className="stat-value" style={{ fontSize: '1rem', color: '#64748b' }}>{formatNumber(est)} kWh</span>
                        </div>
                    </div>
                    <div>
                        <span className="stat-label" style={{ color: occColor, textTransform: 'uppercase', fontSize: '0.7rem' }}>Comprometimento</span>
                        <div className="stat-value-row">
                            <Activity size={16} style={{ color: occColor }} />
                            <span className="stat-value" style={{ fontSize: '1rem', color: occColor }}>{formatNumber(comp)} kWh</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <PieChart width={40} height={40}>
                            <Pie
                                data={[
                                    { name: 'Comprometido', value: comp, color: occColor },
                                    { name: 'Reserva', value: Math.max(0, est - comp), color: '#e2e8f0' }
                                ]}
                                dataKey="value"
                                innerRadius={12}
                                outerRadius={20}
                                startAngle={90}
                                endAngle={-270}
                            >
                                {[0, 1].map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 0 ? occColor : '#e2e8f0'} />
                                ))}
                            </Pie>
                            <Tooltip content={() => null} />
                        </PieChart>
                    </div>
                </div>

                {/* Occupation / Vacancy line */}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.8rem' }}>
                    <div className="stat-subtext" style={{ color: occColor, fontWeight: 600 }}>
                        Ocupação: {Math.round(occPercent)}%
                    </div>
                    <div className="stat-subtext" style={{ color: '#64748b' }}>
                        Vacância: {Math.max(0, 100 - Math.round(occPercent))}%
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
                <button className="plant-action-btn" onClick={() => onOpenLedger(usina)} style={{ borderLeft: '1px solid #eee' }}>
                    <Coins size={18} />
                    Extrato
                </button>
            </div>
        </div>
    );
};

export default PlantCard;
