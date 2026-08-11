import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowUpRight, ArrowDownRight, Info, DollarSign, Zap, Users, AlertCircle, Calendar, ChevronLeft, ChevronRight, Sun, Building2 } from 'lucide-react';
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
    const [concessionariaTarifas, setConcessionariaTarifas] = useState(null);
    const [usinaDetailsState, setUsinaDetailsState] = useState(null);
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
        totalFranquia: 0,
        cycleString: 'Geração'
    });
    const [chartData, setChartData] = useState([]);
    const [occupancyData, setOccupancyData] = useState([]);

    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const shortMonthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    const getTariffValues = () => {
        if (!concessionariaTarifas) return null;
        
        const uDetails = usinaDetailsState || usina;
        const grupo = uDetails.grupo_tarifario || 'B1 Residencial';
        let tarifa = 0;
        let descontoPercent = 0;
        let fioB = 0;

        if (grupo === 'B1 Residencial') {
            tarifa = Number(concessionariaTarifas['Tarifa Concessionaria']) || 0;
            descontoPercent = Number(concessionariaTarifas['Desconto Assinante']) || 0;
            fioB = Number(concessionariaTarifas['Fio B']) || 0;
        } else if (grupo === 'B2 Rural') {
            tarifa = Number(concessionariaTarifas['Tarifa Concessionaria_B2']) || 0;
            descontoPercent = Number(concessionariaTarifas['Desconto Assinante_B2']) || 0;
            fioB = Number(concessionariaTarifas['Fio B_B2']) || 0;
        } else if (grupo === 'B3 Comercial') {
            tarifa = Number(concessionariaTarifas['Tarifa Concessionaria_B3']) || 0;
            descontoPercent = Number(concessionariaTarifas['Desconto Assinante_B3']) || 0;
            fioB = Number(concessionariaTarifas['Fio B_B3']) || 0;
        } else if (grupo === 'Grupo A') {
            tarifa = Number(concessionariaTarifas['Tarifa Concessionaria_A']) || 0;
            descontoPercent = Number(concessionariaTarifas['Desconto Assinante_A']) || 0;
            fioB = Number(concessionariaTarifas['Fio B_A']) || 0;
        }

        const descontoReais = tarifa * (descontoPercent / 100);
        const gestaoPercent = Number(uDetails.gestao_percentual) || 0;
        const baseGestao = tarifa - descontoReais - fioB;
        const gestaoReais = baseGestao * (gestaoPercent / 100);
        const tarifaLiquida = tarifa - descontoReais - fioB - gestaoReais;

        return {
            tarifa,
            descontoPercent,
            descontoReais,
            fioB,
            gestaoPercent,
            gestaoReais,
            tarifaLiquida
        };
    };

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
                .select('geracao_mensal_kwh, geracao_prevista, energia_compensada, saldo_receber, mes_referencia')
                .eq('usina_id', usina.id)
                .gte('mes_referencia', lastPeriod.toISOString().split('T')[0])
                .lte('mes_referencia', new Date(endPeriod.getFullYear(), endPeriod.getMonth() + 1, 0).toISOString().split('T')[0])
                .order('mes_referencia', { ascending: true });

            if (genError) throw genError;

            // 2. Fetch UCs and calculate Total Franquia (Committed Capacity)
            const { data: ucs, error: ucsError } = await supabase
                .from('consumer_units')
                .select('id, franquia, status, numero_uc')
                .eq('usina_id', usina.id);

            if (ucsError) throw ucsError;
            const ucIds = ucs?.map(u => u.id) || [];
            const totalFranquia = ucs?.filter(uc => uc.status !== 'desconectado' && uc.status !== 'cancelado').reduce((acc, curr) => acc + (Number(curr.franquia) || 0), 0) || 0;

            let invHistory = [];
            if (ucIds.length > 0) {
                const endYear = endPeriod.getFullYear();
                const endMonth = endPeriod.getMonth() + 1;
                const endLastDay = new Date(endYear, endMonth, 0).getDate();

                const { data: invoices, error: invError } = await supabase
                    .from('invoices')
                    .select('energia_injetada, consumo_kwh, consumo_compensado, valor_a_pagar, valor_concessionaria, tarifa_concessionaria, tarifa_minima, vencimento, uc_id, mes_referencia, status')
                    .in('uc_id', ucIds)
                    .gte('mes_referencia', `${lastPeriod.getFullYear()}-${(lastPeriod.getMonth() + 1).toString().padStart(2, '0')}-01`)
                    .lte('mes_referencia', `${endYear}-${endMonth.toString().padStart(2, '0')}-${endLastDay.toString().padStart(2, '0')}`);
                
                if (invError) console.error("Invoice fetch error:", invError);
                invHistory = invoices || [];
            }

            // Fetch Usina Details (Investimento, IBGE e Potência)
            const { data: usinaDetails } = await supabase.from('usinas')
                .select('valor_investido, ibge_code, potencia_kwp, supplier_id, unidade_geradora, concessionaria, grupo_tarifario, gestao_percentual')
                .eq('id', usina.id).single();
            setUsinaDetailsState(usinaDetails);

            if (usinaDetails?.concessionaria || usina.concessionaria) {
                const { data: concData } = await supabase
                    .from('Concessionaria')
                    .select('*')
                    .eq('Concessionaria', usinaDetails?.concessionaria || usina.concessionaria)
                    .limit(1)
                    .maybeSingle();
                setConcessionariaTarifas(concData);
            }
            
            const supplierId = usinaDetails?.supplier_id || usina.supplier_id;
            const ibgeCode = usinaDetails?.ibge_code || usina.ibge_code;
            const potenciaKwp = parseFloat(usinaDetails?.potencia_kwp || usina.potencia_kwp || 0);

            // Fetch Ledger Balance (Global for the Supplier)
            const { data: ledgerData } = await supabase
                .from('view_ledger_enriched')
                .select('amount, created_at, reference_type')
                .or(`reference_id.eq.${supplierId || usina.id},supplier_id.eq.${supplierId || usina.id}`)
                .eq('account_code', '2.1.1');
            
            const startStr = lastPeriod.toISOString().split('T')[0];
            const endStr = new Date(endPeriod.getFullYear(), endPeriod.getMonth() + 1, 0).toISOString().split('T')[0];

            const filteredLedger = (ledgerData || []).filter(item => {
                if (!item.created_at) return false;
                const itemDateStr = item.created_at.split('T')[0];
                return itemDateStr >= startStr && itemDateStr <= endStr;
            });
            const netBalance = filteredLedger.reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0;
            // In account 2.1.1 (liability), a negative net balance means the platform owes the supplier money.
            // Therefore, for the supplier's perspective, their "Available Balance" is the inverse of the net balance.
            const balanceToReceive = -netBalance;

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

            const ugNum = usinaDetails?.unidade_geradora || usina.unidade_geradora;
            const mainUG = ucs?.find(u => u.numero_uc === ugNum);

            // 3. Process Chart Data
            const processedData = [];
            for (let i = 0; i < selectedRange; i++) {
                const d = new Date(lastPeriod.getFullYear(), lastPeriod.getMonth() + i, 1);
                const monthKey = d.toISOString().slice(0, 7); // YYYY-MM
                const monthName = shortMonthNames[d.getMonth()];

                const genItem = genHistory?.find(g => g.mes_referencia.startsWith(monthKey));

                // Monthly closing (generation_production) is the primary source: it is the
                // figure the operator reviewed and closed the month on. Same precedence as
                // SupplierDashboard, so both screens report the same number.
                let generation = Number(genItem?.geracao_mensal_kwh) || 0;
                if (generation === 0 && mainUG) {
                    // The generating unit has no subscriber boleto, so invoices.status
                    // ('cancelado', 'sem_faturamento', ...) describes a charge that does not
                    // exist here and says nothing about the meter reading. Filtering the UG
                    // invoice by it silently dropped the generation and showed zero.
                    const ugInvoice = invHistory.find(inv => inv.uc_id === mainUG.id && inv.mes_referencia?.startsWith(monthKey));
                    generation = Number(ugInvoice?.energia_injetada) || 0;
                }

                // Cancelled invoices stay out of the consumption sum: there the status does
                // describe the subscriber charge, which is what consumo_compensado bills.
                const consItems = invHistory.filter(inv => inv.status !== 'cancelado' && inv.mes_referencia?.startsWith(monthKey));
                const consumption = consItems.reduce((acc, inv) => acc + (Number(inv.consumo_compensado) || 0), 0);
                
                const monthLedger = filteredLedger.filter(l => l.created_at?.startsWith(monthKey) && l.amount < 0);
                const revenue = Math.abs(monthLedger.reduce((acc, curr) => acc + curr.amount, 0));
                
                let estimatedGen = 0;
                if (irrData && monthMap[monthName]) {
                    estimatedGen = Math.round((irrData[monthMap[monthName]] || 0) * potenciaKwp);
                }
                
                if (estimatedGen === 0) {
                    estimatedGen = Number(genItem?.geracao_prevista) || 0;
                }

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
                { name: 'Ocupado', value: consumptionLastMonth, color: '#3b82f6' },
                { name: 'Livre', value: vacancyKwh, color: '#10b981' }
            ]);

            setMetrics({
                totalUCs: ucs?.length || 0,
                generationLastMonth,
                estimatedGenLastMonth,
                consumptionLastMonth,
                revenueLastMonth,
                vacancyKwh,
                vacancyPercent,
                reserveKwh,
                reservePercent,
                profitability,
                balanceToReceive,
                totalFranquia,
                cycleString: (() => {
                    const mainUG = ucs?.find(u => u.numero_uc === usina.unidade_geradora);
                    const diaLeitura = mainUG?.dia_leitura;
                    if (selectedRange === 1 && diaLeitura) {
                        const lastGen = processedData[processedData.length - 1];
                        if (lastGen?.monthKey) {
                            const [year, month] = lastGen.monthKey.split('-').map(Number);
                            const day = parseInt(diaLeitura);
                            const endD = new Date(year, month - 1, day);
                            const startD = new Date(year, month - 2, day + 1);
                            return `${startD.toLocaleDateString('pt-BR')} a ${endD.toLocaleDateString('pt-BR')}`;
                        }
                    }
                    return selectedRange === 1 ? 'Geração' : 'Total do Período';
                })()
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

                                {concessionariaTarifas && (() => {
                                    const values = getTariffValues();
                                    if (!values) return null;
                                    const uDetails = usinaDetailsState || usina;
                                    return (
                                        <div style={{
                                            marginBottom: '2rem',
                                            background: '#f8fafc',
                                            padding: '1.5rem',
                                            borderRadius: '16px',
                                            border: '1px solid #e2e8f0',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '1rem',
                                            animation: 'slideDown 0.3s ease-out'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                                                <div style={{ padding: '0.5rem', background: '#eff6ff', borderRadius: '10px', color: '#2563eb' }}>
                                                    <Building2 size={20} />
                                                </div>
                                                <div>
                                                    <h4 style={{ margin: 0, fontSize: '1rem', color: '#1e3a8a', fontWeight: 700 }}>
                                                        Detalhamento de Tarifas: {uDetails.concessionaria}
                                                    </h4>
                                                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                                                        Classe selecionada: {uDetails.grupo_tarifario || 'B1 Residencial'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                                <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>TARIFA CONCESSIONÁRIA</span>
                                                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                                                        {values.tarifa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })}
                                                    </span>
                                                </div>
                                                <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>DESCONTO CLIENTE ({values.descontoPercent}%)</span>
                                                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#dc2626' }}>
                                                        -{values.descontoReais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })}
                                                    </span>
                                                </div>
                                                <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>FIO B</span>
                                                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#d97706' }}>
                                                        {values.fioB.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })}
                                                    </span>
                                                </div>
                                                <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>GESTÃO ({values.gestaoPercent}%)</span>
                                                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#16a34a' }}>
                                                        {values.gestaoReais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })}
                                                    </span>
                                                </div>
                                                <div style={{ gridColumn: '1 / -1', background: '#eff6ff', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                    <div>
                                                        <span style={{ fontSize: '0.7rem', color: '#1d4ed8', fontWeight: 800, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fórmula da Gestão</span>
                                                        <span style={{ fontSize: '0.8rem', color: '#1e40af', fontWeight: 600 }}>
                                                            ({values.tarifa.toFixed(4)} - {values.descontoReais.toFixed(4)} - {values.fioB.toFixed(4)}) × {values.gestaoPercent}% = {values.gestaoReais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })}
                                                        </span>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <span style={{ fontSize: '0.75rem', color: '#1d4ed8', fontWeight: 800, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>TARIFA LÍQUIDA</span>
                                                        <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1e3a8a' }}>
                                                            {values.tarifaLiquida.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

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
                                                <Zap size={24} color={metrics.generationLastMonth > 0 ? "#FF6600" : "#ef4444"} />
                                                <span className="fs-3 fw-bold">
                                                    {formatNumber(metrics.generationLastMonth)} kWh
                                                </span>
                                            </div>
                                            <small className="text-muted">
                                                {metrics.cycleString}
                                            </small>
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
                                            <h4>Saldo a Receber</h4>
                                            <div className="stat-main d-flex align-items-center gap-2">
                                                <DollarSign size={24} color="#FF6600" />
                                                <span className="fs-3 fw-bold">{formatCurrency(metrics.balanceToReceive)}</span>
                                            </div>
                                            <small className="text-muted">Extrato - Saldo Disponível</small>
                                        </motion.div>
                                    </div>
                                </div>

                                {/* MIDDLE SECTION - CHARTS & SIDE STATS */}
                                <div className="row g-4 mb-4">
                                    {/* CHART: Generation x Consumption */}
                                    <div className="col-12 col-xl-8" style={{ minWidth: 0 }}>
                                        <div className="chart-container p-4 bg-white rounded shadow-sm h-100" style={{ minWidth: 0, width: '100%' }}>
                                            <div className="chart-header d-flex justify-content-between mb-4">
                                                <h3 className="h5 mb-0">Geração x Consumo</h3>
                                            </div>
                                            <div className="side-values">
                                                <span className="big-val">{formatNumber(metrics.consumptionLastMonth)} kWh</span>
                                                <span className={`percent-badge pos`}>
                                                    {metrics.generationLastMonth > 0 ? ((metrics.consumptionLastMonth / metrics.generationLastMonth) * 100).toFixed(1) : 0}% Ocupação
                                                </span>
                                            </div>
                                            <div style={{ width: '100%', height: 350 }}>
                                                <ResponsiveContainer width="99%" height="100%">
                                                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                        <defs>
                                                            <linearGradient id="colorGen" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                            </linearGradient>
                                                            <linearGradient id="colorCons" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#7f8c8d', fontSize: 12 }} />
                                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#7f8c8d', fontSize: 12 }} />
                                                        <Tooltip content={<CustomTooltip />} />
                                                        <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px' }} />
                                                        {selectedRange === 1 ? (
                                                            <>
                                                                <Bar dataKey="Consumo" name="Consumo" fill="#3b82f6" radius={[4, 4, 0, 0]} animationDuration={1500} barSize={30} />
                                                                <Bar dataKey="Franquia" name="Franquia" fill="#f59e0b" radius={[4, 4, 0, 0]} animationDuration={1500} barSize={30} />
                                                                <Bar dataKey="Geracao" name="Geração" fill="#10b981" radius={[4, 4, 0, 0]} animationDuration={1500} barSize={30} />
                                                                <Bar dataKey="GeracaoEstimada" name="Ger. Estimada" fill="#94a3b8" radius={[4, 4, 0, 0]} animationDuration={1500} barSize={30} />
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Area type="monotone" dataKey="Geracao" name="Geração" stroke="#10b981" fillOpacity={1} fill="url(#colorGen)" strokeWidth={3} animationDuration={1500} />
                                                                <Area type="monotone" dataKey="Consumo" name="Consumo" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCons)" strokeWidth={3} animationDuration={1500} />
                                                                <Line type="monotone" dataKey="GeracaoEstimada" name="Ger. Estimada" stroke="#94a3b8" strokeWidth={3} dot={false} animationDuration={1500} />
                                                                <Line type="step" dataKey="Franquia" name="Franquia" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} animationDuration={1500} />
                                                            </>
                                                        )}
                                                    </ComposedChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>

                                    {/* RIGHT SIDE STATS COLUMN */}
                                    <div className="col-12 col-xl-4">
                                        <div className="row g-3">
                                            {/* VACANCY */}
                                            <div className="col-12">
                                                <div className="stat-card side p-3 bg-white rounded shadow-sm border-start border-danger border-4">
                                                    <div className="side-header d-flex justify-content-between align-items-start mb-2">
                                                        <h4 className="h6 text-muted mb-0">Energia Não compensada</h4>
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
                                                    <div className="side-header d-flex justify-content-between align-items-start mb-3">
                                                        <h4 className="h6 text-muted mb-0">{metrics.reserveKwh >= 0 ? 'Reserva' : 'Overbook'}</h4>
                                                        <div className="icon-circle yellow text-warning bg-warning bg-opacity-10 p-1 rounded-circle"><Sun size={16} /></div>
                                                    </div>
                                                    
                                                    <div className="calculation-memory mb-3" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                        <div className="d-flex justify-content-between mb-1">
                                                            <span>Geração Média Estimada</span>
                                                            <strong>{formatNumber(metrics.estimatedGenLastMonth / selectedRange)} kWh</strong>
                                                        </div>
                                                        <div className="d-flex justify-content-between mb-1">
                                                            <span>Capacidade Comprometida (Franquia)</span>
                                                            <strong>{formatNumber(metrics.totalFranquia)} kWh</strong>
                                                        </div>
                                                    </div>

                                                    <div className="side-values d-flex justify-content-between align-items-center border-top pt-2 mt-2">
                                                        <span className="text-dark fw-bold" style={{ fontSize: '0.85rem' }}>{metrics.reserveKwh >= 0 ? 'Reserva:' : 'Overbook:'}</span>
                                                        <div className="d-flex align-items-baseline gap-2">
                                                            <span className="fs-5 fw-bold text-dark">{formatNumber(Math.abs(metrics.reserveKwh))} kWh</span>
                                                            <span className={`badge px-2 py-1 ${metrics.reserveKwh >= 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`}>
                                                                {metrics.reservePercent.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </div>
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

                                            {/* FATURAMENTO */}
                                            <div className="col-12">
                                                <div className="stat-card side p-3 bg-white rounded shadow-sm border-start border-primary border-4">
                                                    <div className="side-header d-flex justify-content-between align-items-start mb-2">
                                                        <h4 className="h6 text-muted mb-0">Faturamento (Mês)</h4>
                                                        <div className="icon-circle user text-primary bg-primary bg-opacity-10 p-1 rounded-circle"><DollarSign size={16} /></div>
                                                    </div>
                                                    <div className="side-values">
                                                        <span className="fs-4 fw-bold text-dark">{formatCurrency(metrics.revenueLastMonth)}</span>
                                                        <small className="text-muted d-block">Lançamentos do extrato</small>
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
