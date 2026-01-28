import React, { useState, useEffect } from 'react';
import { X, ArrowUpRight, ArrowDownRight, Info, DollarSign, Zap, Users, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
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
            // 1. Fetch Generation History (Last 12 months)
            const today = new Date();
            const lastYear = new Date();
            lastYear.setFullYear(today.getFullYear() - 1);

            const { data: genHistory, error: genError } = await supabase
                .from('generation_production')
                .select('geracao_mensal_kwh, fechamento')
                .eq('usina_id', usina.id)
                .gte('fechamento', lastYear.toISOString())
                .order('fechamento', { ascending: true });

            if (genError) throw genError;

            // 2. Fetch Consumption History (Sum of UCs)
            // Simplified: Fetch invoices for filtered UCs for the last 12 months
            const { data: ucs } = await supabase.from('consumer_units').select('id, franquia').eq('usina_id', usina.id);
            const ucIds = ucs?.map(u => u.id) || [];
            const totalFranquia = ucs?.reduce((acc, curr) => acc + (Number(curr.franquia) || 0), 0) || 0;

            let invHistory = [];
            if (ucIds.length > 0) {
                const { data: invoices } = await supabase
                    .from('invoices')
                    .select('consumo_kwh, valor_a_pagar, mes_referencia')
                    .in('uc_id', ucIds)
                    .gte('mes_referencia', `${lastYear.getFullYear()}-${lastYear.getMonth() + 1}-01`);
                invHistory = invoices || [];
            }

            // 3. Process Chart Data
            // We need to merge Generation and Consumption by Month (YYYY-MM)
            const processedData = [];
            for (let i = 0; i < 12; i++) {
                const d = new Date(today.getFullYear(), today.getMonth() - 11 + i, 1);
                const monthKey = d.toISOString().slice(0, 7); // YYYY-MM
                const monthName = d.toLocaleDateString('pt-BR', { month: 'short' });

                // Find Competing Data
                // Generation: 'fechamento' is date
                const genItem = genHistory?.find(g => g.fechamento.startsWith(monthKey));
                const generation = Number(genItem?.geracao_mensal_kwh) || 0;

                // Consumption: 'mes_referencia' is date
                const consItems = invHistory.filter(inv => inv.mes_referencia.startsWith(monthKey));
                const consumption = consItems.reduce((acc, curr) => acc + (Number(curr.consumo_kwh) || 0), 0);
                const revenue = consItems.reduce((acc, curr) => acc + (Number(curr.valor_a_pagar) || 0), 0);

                processedData.push({
                    name: monthName,
                    monthKey: monthKey,
                    Geracao: generation,
                    Consumo: consumption,
                    Revenue: revenue
                });
            }

            setChartData(processedData);

            // 4. Metrics Helper (Last Month)
            const lastMonthData = processedData[processedData.length - 1]; // or the last one with data?
            // Let's use the actual last month of array

            const totalUCs = ucs?.length || 0;
            const generationLastMonth = lastMonthData.Geracao;
            const consumptionLastMonth = lastMonthData.Consumo;
            const revenueLastMonth = lastMonthData.Revenue;

            // 5. Vacancy
            const vacancyKwh = generationLastMonth - consumptionLastMonth;
            const vacancyPercent = generationLastMonth > 0 ? (vacancyKwh / generationLastMonth) * 100 : 0;

            // 6. Occupancy (Based on Franquia Allocation usually, but let's use actual consumption ratio)
            const occupancyRate = generationLastMonth > 0 ? (consumptionLastMonth / generationLastMonth) * 100 : 0;

            const pieData = [
                { name: 'Ocupado', value: consumptionLastMonth, color: '#FF6600' },
                { name: 'Vacância', value: Math.max(0, vacancyKwh), color: '#eee' }
            ];
            setOccupancyData(pieData);


            // 7. Profitability & Financials
            // Hardcoded expenses/investment logic as fallback if columns missing
            const { data: usinaDetails } = await supabase.from('usinas').select('*').eq('id', usina.id).single();
            const invested = usinaDetails?.valor_investido || usina.valor_investido || 500000;
            const expenses = 500; // Mock fixed operational cost
            // Balance = Revenue - Expenses
            const balanceToReceive = revenueLastMonth - expenses;
            const profitability = invested > 0 ? (revenueLastMonth / invested) * 100 : 0;

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
