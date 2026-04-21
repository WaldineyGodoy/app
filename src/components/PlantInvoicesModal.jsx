
import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Download, Loader2, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { motion, AnimatePresence } from 'framer-motion';
import { mergePdf } from '../lib/api';
import './PlantInvoicesModal.css';
import { supabase } from '../lib/supabase';

const PlantInvoicesModal = ({ isOpen, onClose, usina }) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [loadingStep, setLoadingStep] = useState('');
    const [invoiceToDownload, setInvoiceToDownload] = useState(null);
    const hiddenRef = useRef(null);

    const [showMonthPicker, setShowMonthPicker] = useState(false);
    const pickerRef = useRef(null);

    const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

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
            fetchInvoices();
        }
    }, [isOpen, usina, selectedMonth]);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            // 1. Get UCs linked to this Usina
            const { data: ucs, error: ucsError } = await supabase
                .from('consumer_units')
                .select('id, numero_uc, subscriber_id, tipo_unidade')
                .eq('usina_id', usina.id)
                .eq('tipo_unidade', 'beneficiaria');

            if (ucsError) throw ucsError;

            const ucIds = ucs.map(uc => uc.id);

            if (ucIds.length === 0) {
                setInvoices([]);
                setLoading(false);
                return;
            }

            // 2. Fetch Invoices for these UCs in the selected Month
            // Assuming 'mes_referencia' is YYYY-MM-DD (stored as first day of month)
            const yearMonth = selectedMonth; // "YYYY-MM"
            const startOfMonth = `${yearMonth}-01`;
            const endOfMonth = `${yearMonth}-31`;

            const { data: invData, error: invError } = await supabase
                .from('invoices')
                .select('*, consumer_units(numero_uc, subscriber:subscriber_id(name))')
                .in('uc_id', ucIds)
                .gte('mes_referencia', startOfMonth)
                .lte('mes_referencia', endOfMonth);

            if (invError) throw invError;

            setInvoices(invData || []);

        } catch (error) {
            console.error("Error fetching plant invoices:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadCombined = async (invoice) => {
        if (!invoice.asaas_boleto_url) {
            alert("Boleto não disponível para download.");
            return;
        }

        setIsGenerating(true);
        setInvoiceToDownload(invoice);
        setLoadingStep('Preparando faturamento...');

        try {
            // Wait for hidden render
            await new Promise(resolve => setTimeout(resolve, 600));

            setLoadingStep('Capturando dados...');
            const element = hiddenRef.current;
            element.style.display = 'block';

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#f8fafc"
            });

            element.style.display = 'none';

            const imgData = canvas.toDataURL('image/png');
            const pdfSummary = new jsPDF('p', 'mm', 'a4');
            const pageWidth = 210;
            const imgHeight = (canvas.height * pageWidth) / canvas.width;

            pdfSummary.addImage(imgData, 'PNG', 0, 0, pageWidth, imgHeight);

            const base64Summary = pdfSummary.output('datauristring');

            setLoadingStep('Mesclando com boleto Asaas...');
            await mergePdf(
                base64Summary,
                invoice.asaas_boleto_url,
                `Fatura_${invoice.mes_referencia}_${invoice.consumer_units?.numero_uc}.pdf`
            );

        } catch (error) {
            console.error("Erro no download:", error);
            alert("Erro ao gerar PDF combinado.");
        } finally {
            setIsGenerating(false);
            setInvoiceToDownload(null);
            setLoadingStep('');
        }
    };

    const renderHiddenInvoiceDetail = (invoice) => {
        if (!invoice) return null;

        // Local logic for detail calculation (same as InvoicesModal)
        const tarifa = parseFloat(invoice.tarifa_concessionaria || 1);
        const totalKwh = parseFloat(invoice.consumo_kwh || 0);
        const tarifaMinimaRs = parseFloat(invoice.tarifa_minima || 0);
        const tarifaMinimaKwh = tarifaMinimaRs / tarifa;
        const consumoCompensadoKwh = totalKwh - tarifaMinimaKwh;
        const consumoCompensadoReais = consumoCompensadoKwh * tarifa;
        const economia = parseFloat(invoice.economia_reais || 0);
        const energiaCompensadaLiquida = consumoCompensadoReais - economia;

        return (
            <div className="pdf-capture-wrapper" style={{ width: '800px', padding: '40px', background: '#f8fafc' }}>
                <div className="detail-card" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#fff', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                    <div className="detail-header" style={{ background: '#003366', padding: '20px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Detalhamento da Fatura</h3>
                            <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: '0.875rem' }}>Ref: {invoice.mes_referencia}</p>
                        </div>
                        <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', background: 'rgba(255,255,255,0.2)' }}>
                            {invoice.status?.toUpperCase()}
                        </span>
                    </div>

                    <div style={{ padding: '24px' }}>
                        <div style={{ marginBottom: '24px', padding: '16px', background: '#f1f5f9', borderRadius: '8px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>ASSINANTE</label>
                                    <span style={{ color: '#1e293b', fontWeight: '500' }}>{invoice.consumer_units?.subscriber?.name || 'Assinante'}</span>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '10px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px' }}>NÚMERO DA UC</label>
                                    <span style={{ color: '#1e293b', fontWeight: '500' }}>{invoice.consumer_units?.numero_uc}</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                                <span>Consumo Compensado ({consumoCompensadoKwh.toFixed(0)} kWh):</span>
                                <span>R$ {consumoCompensadoReais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', fontWeight: '500' }}>
                                <span>Economia Gerada:</span>
                                <span>- R$ {economia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ height: '1px', background: '#e2e8f0', margin: '8px 0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.125rem', fontWeight: 'bold', color: '#003366' }}>
                                <span>TOTAL A PAGAR</span>
                                <span>R$ {parseFloat(invoice.valor_a_pagar).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (!isOpen || !usina) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content invoices-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    <X size={24} />
                </button>

                <header className="invoices-header">
                    <div>
                        <h2>Faturamento</h2>
                        <p>Usina: {usina.name}</p>
                    </div>

                    <div className="month-selector" ref={pickerRef}>
                        <div className="custom-month-picker-wrapper">
                            <div className="picker-label-group">
                                <span className="picker-label">Mês:</span>
                                <button
                                    className="picker-trigger"
                                    onClick={() => setShowMonthPicker(!showMonthPicker)}
                                >
                                    <Calendar size={18} />
                                    <span>{`${monthNames[parseInt(selectedMonth.split('-')[1]) - 1]} de ${selectedMonth.split('-')[0]}`}</span>
                                </button>
                            </div>

                            <AnimatePresence>
                                {showMonthPicker && (
                                    <motion.div
                                        className="picker-popover"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                    >
                                        <button className="any-date-btn" onClick={() => {
                                            const now = new Date();
                                            setSelectedMonth(`${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`);
                                            setShowMonthPicker(false);
                                        }}>Qualquer Data</button>

                                        <div className="picker-header">
                                            <button onClick={() => {
                                                const [year, month] = selectedMonth.split('-');
                                                setSelectedMonth(`${parseInt(year) - 1}-${month}`);
                                            }}><ChevronLeft size={16} /></button>
                                            <span className="current-year">{selectedMonth.split('-')[0]}</span>
                                            <button onClick={() => {
                                                const [year, month] = selectedMonth.split('-');
                                                setSelectedMonth(`${parseInt(year) + 1}-${month}`);
                                            }}><ChevronRight size={16} /></button>
                                        </div>
                                        <div className="months-grid">
                                            {shortMonthNames.map((m, i) => {
                                                const monthVal = (i + 1).toString().padStart(2, '0');
                                                const isSelected = selectedMonth.split('-')[1] === monthVal;
                                                return (
                                                    <button
                                                        key={m}
                                                        className={`month-btn ${isSelected ? 'active' : ''}`}
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
                </header>

                <div className="invoices-list-container">
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>Carregando...</div>
                    ) : (
                        <>
                            {invoices.length > 0 && (
                                <div className="invoices-totals-panel" style={{ display: 'flex', gap: '24px', padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', justifyContent: 'flex-start' }}>
                                    <div className="total-item">
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Energia Compensada</span>
                                        <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>
                                            {invoices.reduce((acc, inv) => {
                                                const tarifa = parseFloat(inv.tarifa_concessionaria || 1);
                                                const totalKwh = parseFloat(inv.consumo_kwh || 0);
                                                const tarifaMinimaRs = parseFloat(inv.tarifa_minima || 0);
                                                const tarifaMinimaKwh = tarifaMinimaRs / (tarifa > 0 ? tarifa : 1);
                                                return acc + (totalKwh - tarifaMinimaKwh);
                                            }, 0).toFixed(0)} kWh
                                        </span>
                                    </div>
                                    <div className="total-item">
                                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Total a Receber</span>
                                        <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#16a34a' }}>
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                                invoices.reduce((acc, inv) => {
                                                    const saldo = parseFloat(inv.valor_a_pagar || 0) - parseFloat(inv.valor_concessionaria || 0);
                                                    return acc + Math.max(0, saldo); // Prevent negative balance if value is somehow higher
                                                }, 0)
                                            )}
                                        </span>
                                    </div>
                                </div>
                            )}
                            <table className="invoices-table">
                            <thead>
                                <tr>
                                    <th>UC</th>
                                    <th>Cliente</th>
                                    <th>Energia Compensada</th>
                                    <th>Saldo</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.length > 0 ? (
                                    invoices.map(inv => {
                                        const tarifa = parseFloat(inv.tarifa_concessionaria || 1);
                                        const totalKwh = parseFloat(inv.consumo_kwh || 0);
                                        const tarifaMinimaRs = parseFloat(inv.tarifa_minima || 0);
                                        const tarifaMinimaKwh = tarifaMinimaRs / (tarifa > 0 ? tarifa : 1);
                                        const consumoCompensadoKwh = totalKwh - tarifaMinimaKwh;
                                        const saldoReal = parseFloat(inv.valor_a_pagar || 0) - parseFloat(inv.valor_concessionaria || 0);

                                        return (
                                            <tr key={inv.id}>
                                                <td>{inv.consumer_units?.numero_uc || 'N/A'}</td>
                                                <td>{inv.consumer_units?.subscriber?.name || 'Cliente'}</td>
                                                <td>
                                                    {consumoCompensadoKwh.toFixed(0)} kWh
                                                </td>
                                                <td className="value-col">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.max(0, saldoReal))}
                                                </td>
                                                <td>
                                                    <span className={`status-badge ${inv.status === 'pago' ? 'green' :
                                                        (inv.status === 'atrasado' ? 'red' : 'yellow')
                                                        }`}>
                                                        {inv.status === 'pago' ? 'Pago' :
                                                            (inv.status === 'atrasado' ? 'Atrasado' : 'A Vencer')}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Nenhuma fatura encontrada.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                        </>
                    )}
                </div>
            </div>

            {/* Hidden capture area */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                <div ref={hiddenRef} style={{ display: 'none' }}>
                    {invoiceToDownload && renderHiddenInvoiceDetail(invoiceToDownload)}
                </div>
            </div>

            <AnimatePresence>
                {isGenerating && (
                    <motion.div
                        className="generation-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="generation-card"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", damping: 20 }}
                        >
                            <div className="motion-spinner-container">
                                <motion.div
                                    className="motion-spinner"
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                />
                                <div className="spinner-icon-center">
                                    <Download size={24} style={{ color: '#00D166' }} />
                                </div>
                            </div>
                            <h4 style={{ marginTop: '1rem', marginBottom: '0.25rem', fontSize: '1.1rem', fontWeight: '600' }}>Processando Fatura</h4>
                            <motion.p
                                key={loadingStep}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{ color: '#64748b', fontSize: '0.85rem' }}
                            >
                                {loadingStep}
                            </motion.p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PlantInvoicesModal;
