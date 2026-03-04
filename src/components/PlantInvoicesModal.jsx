
import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { mergePdf } from '../lib/api';
import './PlantInvoicesModal.css';
import { supabase } from '../lib/supabase';

const PlantInvoicesModal = ({ isOpen, onClose, usina }) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [invoiceToDownload, setInvoiceToDownload] = useState(null);
    const hiddenRef = useRef(null);

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
                .select('id, numero_uc, subscriber_id')
                .eq('usina_id', usina.id);

            if (ucsError) throw ucsError;

            const ucIds = ucs.map(uc => uc.id);

            if (ucIds.length === 0) {
                setInvoices([]);
                setLoading(false);
                return;
            }

            // 2. Fetch Invoices for these UCs in the selected Month
            // Assuming 'mes_referencia' is YYYY-MM-DD
            const startOfMonth = `${selectedMonth}-01`;
            const endOfMonth = `${selectedMonth}-31`; // Loose match is fine for YYYY-MM filter usually, or use start/end logic

            const { data: invData, error: invError } = await supabase
                .from('invoices')
                .select('*, consumer_units(numero_uc, subscribers(name))') // JOIN to get UC Number and Client Name
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

        try {
            // Wait for hidden render
            await new Promise(resolve => setTimeout(resolve, 500));

            const element = hiddenRef.current;
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#f8fafc"
            });

            const imgData = canvas.toDataURL('image/png');
            const pdfSummary = new jsPDF('p', 'mm', 'a4');
            pdfSummary.addImage(imgData, 'PNG', 0, 0, 210, 297);

            const base64Summary = pdfSummary.output('datauristring');

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
                                    <span style={{ color: '#1e293b', fontWeight: '500' }}>{invoice.consumer_units?.subscribers?.name || 'Assinante'}</span>
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

                    <div className="month-selector">
                        <label>Mês de Referência:</label>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        />
                    </div>
                </header>

                <div className="invoices-list-container">
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>Carregando...</div>
                    ) : (
                        <table className="invoices-table">
                            <thead>
                                <tr>
                                    <th>UC</th>
                                    <th>Cliente</th>
                                    <th>Valor</th>
                                    <th>Status</th>
                                    <th align="right">Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.length > 0 ? (
                                    invoices.map(inv => (
                                        <tr key={inv.id}>
                                            <td>{inv.consumer_units?.numero_uc || 'N/A'}</td>
                                            <td>{inv.consumer_units?.subscribers?.name || 'Cliente'}</td>
                                            <td className="value-col">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inv.valor_a_pagar)}
                                            </td>
                                            <td>
                                                <span className={`status-badge ${inv.status === 'pago' ? 'green' :
                                                    (inv.status === 'atrasado' ? 'red' : 'yellow')
                                                    }`}>
                                                    {inv.status === 'pago' ? 'Pago' :
                                                        (inv.status === 'atrasado' ? 'Atrasado' : 'A Vencer')}
                                                </span>
                                            </td>
                                            <td align="right">
                                                {inv.asaas_boleto_url ? (
                                                    <button
                                                        onClick={() => handleDownloadCombined(inv)}
                                                        className="download-btn"
                                                        title="Baixar Detalhamento + Boleto"
                                                        disabled={isGenerating}
                                                    >
                                                        {isGenerating && invoiceToDownload?.id === inv.id ? (
                                                            <Loader2 size={16} className="spin-animation" />
                                                        ) : (
                                                            <Download size={16} />
                                                        )}
                                                    </button>
                                                ) : (
                                                    <span style={{ color: '#ccc' }}>-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Nenhuma fatura encontrada.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Hidden capture area */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                <div ref={hiddenRef}>
                    {invoiceToDownload && renderHiddenInvoiceDetail(invoiceToDownload)}
                </div>
            </div>

            {isGenerating && (
                <div className="generation-overlay">
                    <div className="generation-spinner">
                        <Loader2 size={48} className="spin-animation" />
                        <p>Gerando PDF combinado...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PlantInvoicesModal;
