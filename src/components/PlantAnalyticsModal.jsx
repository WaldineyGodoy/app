import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowUpRight, ArrowDownRight, Info, DollarSign, Zap, Users, AlertCircle, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area, ComposedChart, Line
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import './PlantAnalyticsModal.css';

const PlantAnalyticsModal = ({ isOpen, onClose, usina }) => {
    const [loading, setLoading] = useState(true);
    const [selectedRange, setSelectedRange] = useState(1); // 1, 3, 6, 12 months
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const pickerRef = useRef(null);
    const [metrics, setMetrics] = useState({
        totalUCs: 0,
        generationLastMonth: 0,
        consumptionLastMonth: 0,
        revenueLastMonth: 0,
        vacancyKwh: 0,
        vacancyPercent: 0,
        profitability: 0,
        balanceToReceive: 0,
        totalFranquia: 0
    });
    const [chartData, setChartData] = useState([]);
    const [occupancyData, setOccupancyData] = useState([]);

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const shortMonthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                setShowMonthPicker(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && usina) {
            fetchAnalytics();
        }
    }, [isOpen, usina, selectedRange, selectedMonth]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const endPeriod = new Date(`${selectedMonth}-01T00:00:00`);
            const lastPeriod = new Date(endPeriod);
            lastPeriod.setMonth(endPeriod.getMonth() - (selectedRange - 1));

            // 1. Fetch Generation History
            const { data: genHistory, error: genError } = await supabase
                .from('generation_production')
                .select('geracao_mensal_kwh, geracao_prevista, fechamento')
                .eq('usina_id', usina.id)
                .gte('fechamento', lastPeriod.toISOString())
                .lte('fechamento', new Date(endPeriod.getFullYear(), endPeriod.getMonth() + 1, 0).toISOString())
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
                const endYear = endPeriod.getFullYear();
                const endMonth = endPeriod.getMonth() + 1;
                const endLastDay = new Date(endYear, endMonth, 0).getDate();

                const { data: invoices, error: invError } = await supabase
                    .from('invoices')
                    .select('consumo_kwh, valor_a_pagar, valor_concessionaria, tarifa_concessionaria, tarifa_minima, vencimento')
                    .in('uc_id', ucIds)
                    .gte('vencimento', `${lastPeriod.getFullYear()}-${(lastPeriod.getMonth() + 1).toString().padStart(2, '0')}-01`)
                    .lte('vencimento', `${endYear}-${endMonth.toString().padStart(2, '0')}-${endLastDay.toString().padStart(2, '0')}`);
                
                if (invError) console.error("Invoice fetch error:", invError);
                invHistory = invoices || [];
            }

            // Fetch Ledger Balance (Global for the Supplier)
            const { data: ledgerData } = await supabase
                .from('view_ledger_enriched')
                .select('amount')
                .eq('reference_id', usina.supplier_id || usina.id)
                .eq('account_code', '2.1.1');
            const netBalance = ledgerData?.reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0;
            const balanceToReceive = Math.abs(netBalance);

            // Fetch Usina Details (Investimento, IBGE e Potência)
            const { data: usinaDetails } = await supabase.from('usinas')
                .select('valor_investido, ibge_code, potencia_kwp, supplier_id')
                .eq('id', usina.id).single();
            const ibgeCode = usinaDetails?.ibge_code || usina.ibge_code;
            const potenciaKwp = parseFloat(usinaDetails?.potencia_kwp || usina.potencia_kwp || 0);

            // Fetch Irradiance Data
            let irrData = null;
            if (ibgeCode) {
                const { data: irr, error: irrError } = await supabase
                    .from('vw_irradiancia')
                    .select('*')
                    .eq('ibge_code', String(ibgeCode))
                    .single();
                if (irrError) console.error("Irradiance fetch error:", irrError);
                irrData = irr;
            }

            const monthMap = {
                'Jan': 'jan_kwh', 'Fev': 'fev_kwh', 'Mar': 'mar_kwh', 'Abr': 'abr_kwh',
                'Mai': 'mai_kwh', 'Jun': 'jun_kwh', 'Jul': 'jul_kwh', 'Ago': 'ago_kwh',
                'Set': 'set_kwh', 'Out': 'out_kwh', 'Nov': 'nov_kwh', 'Dez': 'dez_kwh'
            };

            // 3. Process Chart Data
            const processedData = [];
            for (let i = 0; i < selectedRange; i++) {
                const d = new Date(lastPeriod.getFullYear(), lastPeriod.getMonth() + i, 1);
                const monthKey = d.toISOString().slice(0, 7); // YYYY-MM
                const monthName = shortMonthNames[d.getMonth()];

                const genItem = genHistory?.find(g => g.fechamento.startsWith(monthKey));
                const generation = Number(genItem?.geracao_mensal_kwh) || 0;
                
                let estimatedGen = 0;
                if (irrData && monthMap[monthName]) {
                    estimatedGen = Math.round((irrData[monthMap[monthName]] || 0) * potenciaKwp);
                } else {
                    // Fallback to table value if irradiance is not found
                    estimatedGen = Number(genItem?.geracao_prevista) || 0;
                }

                const consItems = invHistory.filter(inv => inv.vencimento.startsWith(monthKey));
                
                const consumption = consItems.reduce((acc, inv) => {
                    const tarifa = parseFloat(inv.tarifa_concessionaria || 1);
                    const tarifaMinimaKwh = parseFloat(inv.tarifa_minima || 0) / (tarifa > 0 ? tarifa : 1);
                    return acc + Math.max(0, parseFloat(inv.consumo_kwh || 0) - tarifaMinimaKwh);
                }, 0);
                
                const revenue = consItems.reduce((acc, inv) => {
                    const saldoReal = parseFloat(inv.valor_a_pagar || 0) - parseFloat(inv.valor_concessionaria || 0);
                    return acc + Math.max(0, saldoReal);
                }, 0);

                processedData.push({
                    name: monthName,
                    monthKey: monthKey,
                    Geracao: generation,
                    GeracaoEstimada: estimatedGen,
                    Consumo: consumption,
                    Revenue: revenue,
                    Franquia: totalFranquia
                });
            }

            setChartData(processedData);

            // 4. Metrics Helper (Syncing with selectedMonth or Period)
            let generationLastMonth = 0;
            let consumptionLastMonth = 0;
            let revenueLastMonth = 0;
            let estimatedGenLastMonth = 0;

            if (selectedRange === 1) {
                const currentMonthData = processedData[processedData.length - 1] || { Geracao: 0, GeracaoEstimada: 0, Consumo: 0, Revenue: 0 };
                generationLastMonth = currentMonthData.Geracao;
                consumptionLastMonth = currentMonthData.Consumo;
                revenueLastMonth = currentMonthData.Revenue;
                estimatedGenLastMonth = currentMonthData.GeracaoEstimada;
            } else {
                generationLastMonth = processedData.reduce((acc, curr) => acc + curr.Geracao, 0);
                consumptionLastMonth = processedData.reduce((acc, curr) => acc + curr.Consumo, 0);
                revenueLastMonth = processedData.reduce((acc, curr) => acc + curr.Revenue, 0);
                estimatedGenLastMonth = processedData.reduce((acc, curr) => acc + curr.GeracaoEstimada, 0);
            }

            const vacancyKwh = Math.max(0, generationLastMonth - consumptionLastMonth);
            const vacancyPercent = generationLastMonth > 0 ? (vacancyKwh / generationLastMonth) * 100 : 0;

            const avgEstimatedGen = estimatedGenLastMonth / selectedRange;
            const reserveKwh = avgEstimatedGen - totalFranquia;
            const reservePercent = avgEstimatedGen > 0 ? (reserveKwh / avgEstimatedGen) * 100 : 0;

            // 5. Profitability & Financials
            const invested = usinaDetails?.valor_investido || usina.valor_investido || 0;
            const profitability = invested > 0 ? (revenueLastMonth / invested) * 100 : 0;

            setOccupancyData([
                { name: 'Ocupado', value: consumptionLastMonth, color: '#003366' },
                { name: 'Livre', value: vacancyKwh, color: '#FF6600' }
            ]);

            setMetrics({
                totalUCs: ucs?.length || 0,
                generationLastMonth,
                consumptionLastMonth,
                revenueLastMonth,
                vacancyKwh,
                vacancyPercent,
                reserveKwh,
                reservePercent,
                profitability,
                balanceToReceive,
                totalFranquia
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
                            </div>
                            <div className="col-auto d-flex gap-3 align-items-center">
                                <div className="month-selector" ref={pickerRef} style={{ position: 'relative', zIndex: 100 }}>
                                    <div className="custom-month-picker-wrapper">
                                        <button
                                            className="picker-trigger btn btn-outline-secondary d-flex align-items-center gap-2"
                                            onClick={() => setShowMonthPicker(!showMonthPicker)}
                                            style={{ borderRadius: '20px', padding: '6px 16px', background: '#fff' }}
                                        >
                                            <Calendar size={18} />
                                            <span>{`${monthNames[parseInt(selectedMonth.split('-')[1]) - 1]} de ${selectedMonth.split('-')[0]}`}</span>
                                        </button>

                                        <AnimatePresence>
                                            {showMonthPicker && (
                                                <motion.div
                                                    className="picker-popover"
                                                    style={{ position: 'absolute', top: '100%', right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', minWidth: '280px', marginTop: '8px' }}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 10 }}
                                                >
                                                    <div className="picker-header d-flex justify-content-between align-items-center mb-3">
                                                        <button className="btn btn-sm btn-light" onClick={() => {
                                                            const [year, month] = selectedMonth.split('-');
                                                            setSelectedMonth(`${parseInt(year) - 1}-${month}`);
                                                        }}><ChevronLeft size={16} /></button>
                                                        <span className="current-year fw-bold text-dark">{selectedMonth.split('-')[0]}</span>
                                                        <button className="btn btn-sm btn-light" onClick={() => {
                                                            const [year, month] = selectedMonth.split('-');
                                                            setSelectedMonth(`${parseInt(year) + 1}-${month}`);
                                                        }}><ChevronRight size={16} /></button>
                                                    </div>
                                                    <div className="months-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                                        {shortMonthNames.map((m, i) => {
                                                            const monthVal = (i + 1).toString().padStart(2, '0');
                                                            const isSelected = selectedMonth.split('-')[1] === monthVal;
                                                            return (
                                                                <button
                                                                    key={m}
                                                                    className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline-secondary'}`}
                                                                    onClick={() => {
                                                                        const year = selectedMonth.split('-')[0];
                                                                        setSelectedMonth(`${year}-${monthVal}`);
                                                                        setShowMonthPicker(false);
                                                                    }}
                                                                >
                                                                    {m}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                                <div className="range-selector">
                                    {[1, 3, 6, 12].map(range => (
                                        <button
                                            key={range}
                                            className={`range-btn ${selectedRange === range ? 'active' : ''}`}
                                            onClick={() => setSelectedRange(range)}
                                        >
                                            {range === 1 ? 'Mês' : `${range} meses`}
                                        </button>
                                    ))}
                                </div>
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
                                                <span className="fs-3 fw-bold">{formatNumber(metrics.totalFranquia)} kWh</span>
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
                                                <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                                                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px' }} />
                                                    {selectedRange === 1 ? (
                                                        <>
                                                            <Bar dataKey="Consumo" name="Consumo" fill="#003366" radius={[4, 4, 0, 0]} animationDuration={1500} barSize={30} />
                                                            <Bar dataKey="Franquia" name="Franquia" fill="#dc2626" radius={[4, 4, 0, 0]} animationDuration={1500} barSize={30} />
                                                            <Bar dataKey="Geracao" name="Geração" fill="#FF6600" radius={[4, 4, 0, 0]} animationDuration={1500} barSize={30} />
                                                            <Bar dataKey="GeracaoEstimada" name="Ger. Estimada" fill="#ef4444" radius={[4, 4, 0, 0]} animationDuration={1500} barSize={30} />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Area type="monotone" dataKey="Geracao" name="Geração" stroke="#FF6600" fillOpacity={1} fill="url(#colorGen)" strokeWidth={3} animationDuration={1500} />
                                                            <Area type="monotone" dataKey="Consumo" name="Consumo" stroke="#003366" fillOpacity={1} fill="url(#colorCons)" strokeWidth={3} animationDuration={1500} />
                                                            <Line type="monotone" dataKey="GeracaoEstimada" name="Ger. Estimada" stroke="#ef4444" strokeWidth={3} dot={false} animationDuration={1500} />
                                                            <Line type="step" dataKey="Franquia" name="Franquia" stroke="#dc2626" strokeWidth={2} strokeDasharray="5 5" dot={false} animationDuration={1500} />
                                                        </>
                                                    )}
                                                </ComposedChart>
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
                                                    <small className="text-muted d-block mt-2">Diferença Geração - Consumo</small>
                                                </div>
                                            </div>

                                            {/* RESERVA */}
                                            <div className="col-12">
                                                <div className="stat-card side p-3 bg-white rounded shadow-sm border-start border-warning border-4">
                                                    <div className="side-header d-flex justify-content-between align-items-start mb-2">
                                                        <h4 className="h6 text-muted mb-0">Reserva</h4>
                                                        <div className="icon-circle yellow text-warning bg-warning bg-opacity-10 p-1 rounded-circle"><Sun size={16} /></div>
                                                    </div>
                                                    <div className="side-values d-flex align-items-baseline gap-2">
                                                        <span className="fs-4 fw-bold text-dark">{formatNumber(metrics.reserveKwh)} kWh</span>
                                                        <span className={`badge px-2 py-1 ${metrics.reserveKwh >= 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`}>
                                                            {metrics.reservePercent.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                    <small className="text-muted d-block mt-2">Geração Média Estimada - Cap. Comprometida</small>
                                                </div>
                                            </div>                 </div>

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
