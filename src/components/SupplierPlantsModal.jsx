import React from 'react';
import { X, Zap, Activity, Shield, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import './SupplierPlantsModal.css';

const SupplierPlantsModal = ({ isOpen, onClose, usinas }) => {
    if (!isOpen) return null;

    // Aggregations
    const totalGen = usinas.reduce((acc, u) => acc + (u.generation || 0), 0);
    const totalUcs = usinas.reduce((acc, u) => acc + (u.ucCount || 0), 0);
    const activePlants = usinas.filter(u => u.status?.toLowerCase().includes('gerando') || u.status?.toLowerCase().includes('ativa')).length;

    // Chart Data
    const chartData = usinas.map(u => ({
        name: u.name?.length > 15 ? u.name.substring(0, 12) + '...' : u.name,
        geracao: u.generation || 0,
        fullName: u.name
    }));

    const formatKwh = (val) => new Intl.NumberFormat('pt-BR').format(val) + ' kWh';

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content plants-dashboard-modal" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    <X size={24} />
                </button>

                <header className="dashboard-header">
                    <div className="header-info">
                        <h2>Analytics das Usinas</h2>
                        <p>Visão detalhada de performance e status</p>
                    </div>
                </header>

                <div className="dashboard-grid">
                    {/* Summary Cards - Inspiration from Img 2 */}
                    <div className="summary-row">
                        <div className="mini-card highlight">
                            <TrendingUp size={20} />
                            <div className="mini-card-content">
                                <span className="label">Geração Total</span>
                                <span className="value">{formatKwh(totalGen)}</span>
                            </div>
                        </div>
                        <div className="mini-card">
                            <Activity size={20} color="#2ecc71" />
                            <div className="mini-card-content">
                                <span className="label">Usinas Ativas</span>
                                <span className="value">{activePlants} / {usinas.length}</span>
                            </div>
                        </div>
                        <div className="mini-card">
                            <Shield size={20} color="#003366" />
                            <div className="mini-card-content">
                                <span className="label">Total de UCs</span>
                                <span className="value">{totalUcs}</span>
                            </div>
                        </div>
                    </div>

                    <div className="main-content-row">
                        <div className="chart-section">
                            <div className="section-header">
                                <h3>Geração por Usina (Mensal)</h3>
                            </div>
                            <div className="chart-container">
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f3f5" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#7f8c8d' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#7f8c8d' }} />
                                        <Tooltip
                                            cursor={{ fill: 'rgba(255, 102, 0, 0.05)' }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                                            formatter={(value) => [formatKwh(value), 'Geração']}
                                        />
                                        <Bar dataKey="geracao" radius={[4, 4, 0, 0]}>
                                            {chartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#FF6600' : '#003366'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="plants-mini-list">
                            <div className="section-header">
                                <h3>Status Recente</h3>
                            </div>
                            <div className="list-container">
                                {usinas.map(u => (
                                    <div className="plant-item-row" key={u.id}>
                                        <div className="plant-dot" style={{ backgroundColor: u.status?.toLowerCase().includes('gerando') ? '#2ecc71' : '#f1c40f' }}></div>
                                        <div className="plant-text">
                                            <span className="p-name">{u.name}</span>
                                            <span className="p-status">{u.status}</span>
                                        </div>
                                        <div className="plant-val">
                                            {formatKwh(u.generation)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupplierPlantsModal;
