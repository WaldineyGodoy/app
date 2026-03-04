import React, { useState, useEffect } from 'react';
import { X, ArrowUpRight, ArrowDownRight, Info, DollarSign, Zap, Users, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
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

            // 2. Fetch UCs and calculate Total Franquia (Committed Capacity)
            const { data: ucs, error: ucsError } = await supabase
                .from('consumer_units')
                .select('id, franquia')
                .eq('usina_id', usina.id);

            if (ucsError) throw ucsError;
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
            const processedData = [];
            for (let i = 0; i < 12; i++) {
                const d = new Date(today.getFullYear(), today.getMonth() - 11 + i, 1);
                const monthKey = d.toISOString().slice(0, 7); // YYYY-MM
                const monthName = d.toLocaleDateString('pt-BR', { month: 'short' });

                const genItem = genHistory?.find(g => g.fechamento.startsWith(monthKey));
                const generation = Number(genItem?.geracao_mensal_kwh) || 0;

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

            // 4. Metrics Helper (Syncing with CRM logic)
            // Latest generation record specifically
            const latestGenItem = [...genHistory].reverse()[0];
            const generationLastMonth = Number(latestGenItem?.geracao_mensal_kwh) || 0;

            // For sync: Occupancy kwh Value = Total Franquia (Committed)
            // Occupancy % = Committed / Generation
            const consumptionLastMonth = totalFranquia;
            const revenueLastMonth = processedData[processedData.length - 1].Revenue;

            const vacancyKwh = Math.max(0, generationLastMonth - totalFranquia);
            const vacancyPercent = generationLastMonth > 0 ? (vacancyKwh / generationLastMonth) * 100 : 0;
            const occupancyRate = generationLastMonth > 0 ? (totalFranquia / generationLastMonth) * 100 : 0;

            // 5. Profitability & Financials
            // Hardcoded expenses/investment logic as fallback if columns missing
            const { data: usinaDetails } = await supabase.from('usinas').select('*').eq('id', usina.id).single();
            const invested = usinaDetails?.valor_investido || usina.valor_investido || 500000;
            const expenses = 500; // Mock fixed operational cost
            // Balance = Revenue - Expenses
            const balanceToReceive = revenueLastMonth - expenses;
            const profitability = invested > 0 ? (revenueLastMonth / invested) * 100 : 0;

            setMetrics({
                totalUCs: ucs?.length || 0,
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

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="custom-tooltip bg-white p-3 rounded shadow border">
                    <p className="label fw-bold mb-1 text-dark">{label}</p>
                    {payload.map((entry, index) => (
                        <p key={index} className="mb-0" style={{ color: entry.color }}>
                            {entry.name}: {entry.name === 'Revenue' ? formatCurrency(entry.value) : `${formatNumber(entry.value)} kWh`}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="modal-overlay" onClick={onClose}>
                    <motion.div
                        className="modal-content analytics-modal container-fluid"
                        onClick={(e) => e.stopPropagation()}
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    >
                        <button className="modal-close" onClick={onClose}>
                            <X size={24} />
                        </button>

                        <div className="analytics-header row mb-4 align-items-center">
                            <div className="col">
                                <h2 className="mb-0">Painel de Análise - {usina.name}</h2>
                                <span className="badge bg-primary mt-1">Últimos 12 Meses</span>
                            </div>
                        </div>

                        {loading ? (
                            <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Carregando dados...</span>
                                </div>
                            </div>
                        ) : (
                            <div className="analytics-grid">

                                {/* TOP CARDS ROW */}
                                <div className="row g-3 mb-4">
                                    <div className="col-12 col-sm-6 col-lg-3">
                                        <motion.div className="stat-card top h-100 p-3 bg-white rounded shadow-sm" whileHover={{ y: -5 }}>
                                            <h4>UCs Vinculadas</h4>
                                            <div className="stat-main d-flex align-items-center gap-2">
                                                <Users size={24} color="#FF6600" />
                                                <span className="fs-3 fw-bold">{metrics.totalUCs}</span>
                                            </div>
                                            <small className="text-muted">Todas as propriedades</small>
                                        </motion.div>
                                    </div>

                                    <div className="col-12 col-sm-6 col-lg-3">
                                        <motion.div className="stat-card top h-100 p-3 bg-white rounded shadow-sm" whileHover={{ y: -5 }}>
                                            <h4>Geração (Mês)</h4>
                                            <div className="stat-main d-flex align-items-center gap-2">
                                                <Zap size={24} color="#FF6600" />
                                                <span className="fs-3 fw-bold">{formatNumber(metrics.generationLastMonth)} kWh</span>
                                            </div>
                                            <small className="text-muted">Analíticos do último mês</small>
                                        </motion.div>
                                    </div>

                                    <div className="col-12 col-sm-6 col-lg-3">
                                        <motion.div className="stat-card top h-100 p-3 bg-white rounded shadow-sm" whileHover={{ y: -5 }}>
                                            <h4>Capacidade Comprometida</h4>
                                            <div className="stat-main d-flex align-items-center gap-2">
                                                <ArrowDownRight size={24} color="#FF6600" />
                                                <span className="fs-3 fw-bold">{formatNumber(metrics.consumptionLastMonth)} kWh</span>
                                            </div>
                                            <small className="text-muted">Soma da franquia das UCs</small>
                                        </motion.div>
                                    </div>

                                    <div className="col-12 col-sm-6 col-lg-3">
                                        <motion.div className="stat-card top h-100 p-3 bg-white rounded shadow-sm" whileHover={{ y: -5 }}>
                                            <h4>Faturamento (Mês)</h4>
                                            <div className="stat-main d-flex align-items-center gap-2">
                                                <DollarSign size={24} color="#FF6600" />
                                                <span className="fs-3 fw-bold">{formatCurrency(metrics.revenueLastMonth)}</span>
                                            </div>
                                            <small className="text-muted">Total faturas emitidas</small>
                                        </motion.div>
                                    </div>
                                </div>

                                {/* MIDDLE SECTION - CHARTS & SIDE STATS */}
                                <div className="row g-4 mb-4">
                                    {/* CHART: Generation x Consumption */}
                                    <div className="col-12 col-xl-8">
                                        <div className="chart-container p-4 bg-white rounded shadow-sm h-100">
                                            <div className="chart-header d-flex justify-content-between mb-4">
                                                <h3 className="h5 mb-0">Geração x Consumo</h3>
                                            </div>
                                            <div className="side-values">
                                                <span className="big-val">{formatNumber(metrics.consumptionLastMonth)} kWh</span>
                                                <span className={`percent-badge pos`}>
                                                    {metrics.generationLastMonth > 0 ? ((metrics.consumptionLastMonth / metrics.generationLastMonth) * 100).toFixed(1) : 0}% Ocupação
                                                </span>
                                            </div>
                                            <ResponsiveContainer width="100%" height={350}>
                                                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="colorGen" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#FF6600" stopOpacity={0.1} />
                                                            <stop offset="95%" stopColor="#FF6600" stopOpacity={0} />
                                                        </linearGradient>
                                                        <linearGradient id="colorCons" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#003366" stopOpacity={0.1} />
                                                            <stop offset="95%" stopColor="#003366" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#7f8c8d', fontSize: 12 }} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#7f8c8d', fontSize: 12 }} />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                                    <Area type="monotone" dataKey="Geracao" name="Geração (kWh)" stroke="#FF6600" fillOpacity={1} fill="url(#colorGen)" strokeWidth={3} animationDuration={1500} />
                                                    <Area type="monotone" dataKey="Consumo" name="Consumo (kWh)" stroke="#003366" fillOpacity={1} fill="url(#colorCons)" strokeWidth={3} animationDuration={1500} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* RIGHT SIDE STATS COLUMN */}
                                    <div className="col-12 col-xl-4">
                                        <div className="row g-3">
                                            {/* VACANCY */}
                                            <div className="col-12">
                                                <div className="stat-card side p-3 bg-white rounded shadow-sm border-start border-danger border-4">
                                                    <div className="side-header d-flex justify-content-between align-items-start mb-2">
                                                        <h4 className="h6 text-muted mb-0">Vacância</h4>
                                                        <div className="icon-circle red text-danger bg-danger bg-opacity-10 p-1 rounded-circle"><AlertCircle size={16} /></div>
                                                    </div>
                                                    <div className="side-values d-flex align-items-baseline gap-2">
                                                        <span className="fs-4 fw-bold text-dark">{formatNumber(metrics.vacancyKwh)} kWh</span>
                                                        <span className={`badge px-2 py-1 ${metrics.vacancyKwh >= 0 ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success'}`}>
                                                            {metrics.vacancyPercent.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                    <small className="text-muted d-block mt-1">Diferença Geração - Consumo</small>
                                                </div>
                                            </div>

                                            {/* PROFITABILITY */}
                                            <div className="col-12">
                                                <div className="stat-card side p-3 bg-white rounded shadow-sm border-start border-success border-4">
                                                    <div className="side-header d-flex justify-content-between align-items-start mb-2">
                                                        <h4 className="h6 text-muted mb-0">Rentabilidade</h4>
                                                        <div className="icon-circle user text-success bg-success bg-opacity-10 p-1 rounded-circle"><Users size={16} /></div>
                                                    </div>
                                                    <div className="side-values">
                                                        <span className="fs-4 fw-bold text-dark">{metrics.profitability.toFixed(2)}%</span>
                                                        <small className="text-muted d-block">Retorno sobre Investimento</small>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* BALANCE */}
                                            <div className="col-12">
                                                <div className="stat-card side p-3 bg-white rounded shadow-sm border-start border-primary border-4">
                                                    <div className="side-header d-flex justify-content-between align-items-start mb-2">
                                                        <h4 className="h6 text-muted mb-0">Saldo a Receber</h4>
                                                        <div className="icon-circle user text-primary bg-primary bg-opacity-10 p-1 rounded-circle"><DollarSign size={16} /></div>
                                                    </div>
                                                    <div className="side-values">
                                                        <span className="fs-4 fw-bold text-dark">{formatCurrency(metrics.balanceToReceive)}</span>
                                                        <small className="text-muted d-block">Faturamento - Despesas</small>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* BOTTOM SECTION - SECONDARY CHART */}
                                <div className="row g-4">
                                    <div className="col-12 col-md-6">
                                        <div className="chart-container p-4 bg-white rounded shadow-sm">
                                            <h3 className="h6 mb-4">Distribuição de Receita</h3>
                                            <ResponsiveContainer width="100%" height={250}>
                                                <BarChart data={chartData.slice(-6)}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                                    <YAxis axisLine={false} tickLine={false} />
                                                    <Tooltip content={<CustomTooltip />} />
                                                    <Bar dataKey="Revenue" name="Receita" fill="#003366" radius={[4, 4, 0, 0]} animationDuration={1500} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="col-12 col-md-6">
                                        <div className="chart-container p-4 bg-white rounded shadow-sm d-flex flex-column align-items-center">
                                            <h3 className="h6 mb-4 w-100">Ocupação da Usina</h3>
                                            <div className=" donut-wrapper position-relative" style={{ width: '100%', maxWidth: '250px' }}>
                                                <ResponsiveContainer width="100%" height={200}>
                                                    <PieChart>
                                                        <Pie
                                                            data={occupancyData}
                                                            innerRadius={60}
                                                            outerRadius={80}
                                                            paddingAngle={5}
                                                            dataKey="value"
                                                            animationDuration={1500}
                                                        >
                                                            {occupancyData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                                <div className="donut-center-text position-absolute top-50 start-50 translate-middle text-center">
                                                    <strong className="fs-4 text-dark">{((metrics.consumptionLastMonth / metrics.generationLastMonth) * 100 || 0).toFixed(0)}%</strong>
                                                    <small className="text-muted d-block">Ocupação</small>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default PlantAnalyticsModal;
