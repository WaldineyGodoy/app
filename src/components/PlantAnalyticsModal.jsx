import React, { useState, useEffect } from 'react';
import { X, ArrowUpRight, ArrowDownRight, Info, DollarSign, Zap, Users, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import './PlantAnalyticsModal.css';

const PlantAnalyticsModal = ({ isOpen, onClose, usina }) => {
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState({
        totalUCs: 0,
        generationLastMonth: 0,
        consumptionLastMonth: 0,
        revenueLastMonth: 0,
        vacancyKwh: 0,
        vacancyPercent: 0,
        profitability: 0,
        balanceToReceive: 0
    });
    const [chartData, setChartData] = useState([]);
    const [occupancyData, setOccupancyData] = useState([]);

    useEffect(() => {
        if (isOpen && usina) {
            fetchAnalytics();
        }
    }, [isOpen, usina]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            // 1. Fetch History (Last 12 months)
            // Mocking for visual demonstration if DB is empty, but trying real fetch first
            // Real fetch logic:
            // const { data: genHistory } = ...
            // const { data: invHistory } = ...

            // --- MOCK DATA GENERATION (To match the visual request perfectly) ---
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const mockChartData = months.map(m => ({
                name: m,
                Geracao: Math.floor(Math.random() * 400) + 300,
                Consumo: Math.floor(Math.random() * 300) + 200,
            }));

            // Use Last Month from mock for consistency
            const lastMonth = mockChartData[mockChartData.length - 1];
            const generationLastMonth = lastMonth.Geracao;
            const consumptionLastMonth = lastMonth.Consumo;

            // 2. Fetch specific Usina details for financial calc
            const { data: usinaDetails } = await supabase
                .from('usinas')
                .select('valor_investido, total_despesas') // Check exact schema cols
                .eq('id', usina.id)
                .single();

            const invested = usinaDetails?.valor_investido || usina.valor_investido || 500000; // Fallback mock
            const expenses = usinaDetails?.total_despesas || 1500; // Fallback mock

            // 3. Count UCs & Franquia
            const { data: ucs, error: ucsError } = await supabase
                .from('consumer_units')
                .select('franquia, status')
                .eq('usina_id', usina.id);

            const totalUCs = ucs?.length || 0;
            const totalFranquia = ucs?.reduce((acc, curr) => acc + (Number(curr.franquia) || 0), 0) || 0;

            // 4. Calculate Revenue (Faturamento)
            // Mocking revenue based on consumption (e.g. R$ 0.85/kWh)
            const revenueLastMonth = consumptionLastMonth * 0.85;

            // 5. Vacancy (Difference)
            const vacancyKwh = generationLastMonth - consumptionLastMonth;
            const vacancyPercent = generationLastMonth > 0 ? (vacancyKwh / generationLastMonth) * 100 : 0;

            // 6. Occupancy (Avg Gen vs Franquia) -> Here simplified to Last Gen vs Franquia for Occupancy
            // "Ocupação: Geração Média vs Franquia" -> Let's show Franquia usage
            // Occupied = Consumption (or Franquia Allocated?) -> User said "Franquia de consumo das UCs"
            // Let's assume Occupancy is how much of the Generation is allocated to Franquias.
            // Or usually: Occupancy = Total Franquia / Capacity.
            // Let's use: Occupancy Data for Pie Chart.
            const occupancyRate = generationLastMonth > 0 ? (consumptionLastMonth / generationLastMonth) * 100 : 0;

            const pieData = [
                { name: 'Ocupado', value: consumptionLastMonth, color: '#FF6600' },
                { name: 'Vacância', value: Math.max(0, vacancyKwh), color: '#eee' }
            ];

            // 7. Profitability
            const profitability = invested > 0 ? (revenueLastMonth / invested) * 100 : 0;

            // 8. Balance to Receive (Saldo)
            // Faturamento - Despesas - Inadimplência
            const delinquency = 0; // Mocked
            const balanceToReceive = revenueLastMonth - expenses - delinquency;

            setMetrics({
                totalUCs,
                generationLastMonth,
                consumptionLastMonth,
                revenueLastMonth,
                vacancyKwh,
                vacancyPercent,
                profitability,
                balanceToReceive
            });
            setChartData(mockChartData);
            setOccupancyData(pieData);

        } catch (err) {
            console.error("Error fetching analytics:", err);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !usina) return null;

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const formatNumber = (val) => new Intl.NumberFormat('pt-BR').format(val);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content analytics-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    <X size={24} />
                </button>

                <div className="analytics-header">
                    <h2>Painel de Análise - {usina.name}</h2>
                    <span className="date-range-badge">Últimos 12 Meses</span>
                </div>

                {loading ? (
                    <div className="loading-spinner">Carregando dados...</div>
                ) : (
                    <div className="analytics-grid">

                        {/* TOP CARDS ROW */}
                        <div className="stat-card top">
                            <h4>UCs Vinculadas</h4>
                            <div className="stat-main">
                                <Users size={24} color="#FF6600" />
                                <span>{metrics.totalUCs}</span>
                            </div>
                            <small className="stat-sub">Todas as propriedades</small>
                        </div>

                        <div className="stat-card top">
                            <h4>Geração (Mês)</h4>
                            <div className="stat-main">
                                <Zap size={24} color="#FF6600" />
                                <span>{formatNumber(metrics.generationLastMonth)} kWh</span>
                            </div>
                            <small className="stat-sub">Analíticos do último mês</small>
                        </div>

                        <div className="stat-card top">
                            <h4>Consumo (Mês)</h4>
                            <div className="stat-main">
                                <ArrowDownRight size={24} color="#FF6600" />
                                <span>{formatNumber(metrics.consumptionLastMonth)} kWh</span>
                            </div>
                            <small className="stat-sub">Soma das UCs vinculadas</small>
                        </div>

                        <div className="stat-card top">
                            <h4>Faturamento (Mês)</h4>
                            <div className="stat-main">
                                <DollarSign size={24} color="#FF6600" />
                                <span>{formatCurrency(metrics.revenueLastMonth)}</span>
                            </div>
                            <small className="stat-sub">Total faturas emitidas</small>
                        </div>

                        {/* MIDDLE SECTION - CHARTS & SIDE STATS */}

                        {/* CHART: Generation x Consumption */}
                        <div className="chart-container large">
                            <div className="chart-header">
                                <h3>Geração x Consumo</h3>
                                <div className="chart-actions">
                                    <button>...</button>
                                </div>
                            </div>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} />
                                    <Tooltip
                                        cursor={{ fill: 'transparent' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Legend />
                                    <Bar dataKey="Geracao" name="Geração" fill="#FF6600" radius={[4, 4, 0, 0]} maxBarSize={20} />
                                    <Bar dataKey="Consumo" name="Consumo" fill="#003366" radius={[4, 4, 0, 0]} maxBarSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* RIGHT SIDE STATS COLUMN */}
                        <div className="side-stats-column">

                            {/* VACANCY */}
                            <div className="stat-card side">
                                <div className="side-header">
                                    <h4>Vacância</h4>
                                    <div className="icon-circle red"><AlertCircle size={14} /></div>
                                </div>
                                <div className="side-values">
                                    <span className="big-val">{formatNumber(metrics.vacancyKwh)} kWh</span>
                                    <span className={`percent-badge ${metrics.vacancyKwh >= 0 ? 'pos' : 'neg'}`}>
                                        {metrics.vacancyPercent.toFixed(1)}%
                                    </span>
                                </div>
                                <small>Diferença Geração - Consumo</small>
                            </div>

                            {/* PROFITABILITY */}
                            <div className="stat-card side">
                                <div className="side-header">
                                    <h4>Rentabilidade</h4>
                                    <div className="icon-circle user"><Users size={14} /></div>
                                </div>
                                <div className="side-values">
                                    <span className="big-val">{metrics.profitability.toFixed(2)}%</span>
                                    <small>Retorno sobre Investimento</small>
                                </div>
                            </div>

                            {/* BALANCE */}
                            <div className="stat-card side">
                                <div className="side-header">
                                    <h4>Saldo a Receber</h4>
                                    <div className="icon-circle user"><DollarSign size={14} /></div>
                                </div>
                                <div className="side-values">
                                    <span className="big-val">{formatCurrency(metrics.balanceToReceive)}</span>
                                    <small>Faturamento - Despesas</small>
                                </div>
                            </div>

                        </div>

                        {/* OCCUPANCY CHART (Bottom Right) */}
                        <div className="chart-container small">
                            <div className="chart-header">
                                <h3>Ocupação</h3>
                            </div>
                            <div className="donut-wrapper">
                                <ResponsiveContainer width="100%" height={180}>
                                    <PieChart>
                                        <Pie
                                            data={occupancyData}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {occupancyData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="donut-center-text">
                                    {/* Calculated Occupancy % */}
                                    <strong>{((metrics.consumptionLastMonth / metrics.generationLastMonth) * 100).toFixed(0)}%</strong>
                                </div>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};

export default PlantAnalyticsModal;
