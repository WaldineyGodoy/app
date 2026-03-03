import React, { useState, useRef } from 'react';
import { X, Eye, Download, FileText, CreditCard, Calendar, ArrowLeft, Info, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PDFDocument } from 'pdf-lib';
import './InvoicesModal.css';

const InvoicesModal = ({ isOpen, onClose, ucData, invoices, subscriberName, branding }) => {
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [invoiceToDownload, setInvoiceToDownload] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const detailRef = useRef(null);
    const hiddenRef = useRef(null);

    if (!isOpen) return null;

    // Helper to format currency
    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    };

    // Helper to format date
    const formatDate = (dateString, type = 'short') => {
        if (!dateString) return '-';
        if (type === 'ref') {
            const [year, month] = dateString.split('-');
            return `${month}/${year}`;
        }
        return new Date(dateString).toLocaleDateString('pt-BR');
    };

    const getStatusInfo = (status) => {
        const s = status?.toLowerCase() || '';
        if (s === 'pago') return { label: 'Pago', color: '#2980b9' }; // Blue
        if (s === 'atrasado') return { label: 'Atrasado', color: '#e74c3c' }; // Red
        if (s === 'a_vencer') return { label: 'A vencer', color: '#27ae60' }; // Green
        return { label: status || 'N/A', color: '#7f8c8d' };
    };

    const handleViewDetail = (invoice) => {
        setSelectedInvoice(invoice);
    };

    const handleBackToList = () => {
        setSelectedInvoice(null);
    };

    const handleDownloadCombined = async (invoice) => {
        if (!invoice.asaas_boleto_url) {
            alert("Boleto não disponível para download.");
            return;
        }

        setIsGenerating(true);
        setInvoiceToDownload(invoice);

        try {
            // Wait for the hidden render to update
            await new Promise(resolve => setTimeout(resolve, 500));

            // 1. Prepare PDF of the detailed summary
            const element = hiddenRef.current;
            element.style.display = 'block';

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: "#f8fafc"
            });

            element.style.display = 'none';

            const imgData = canvas.toDataURL('image/png');
            const pdfSummary = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdfSummary.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdfSummary.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

            const summaryBytes = pdfSummary.output('arraybuffer');

            // 2. Fetch the Asaas Boleto PDF via custom Edge Function Proxy
            const { data: pdfBlob, error: proxyError } = await supabase.functions.invoke('proxy-pdf', {
                body: { url: invoice.asaas_boleto_url }
            });

            if (proxyError) throw proxyError;
            const boletoBytes = await pdfBlob.arrayBuffer();

            // 3. Merge PDFs using pdf-lib
            const mergedPdf = await PDFDocument.create();

            const summaryDoc = await PDFDocument.load(summaryBytes);
            const copiedSummaryPages = await mergedPdf.copyPages(summaryDoc, summaryDoc.getPageIndices());
            copiedSummaryPages.forEach((page) => mergedPdf.addPage(page));

            const boletoDoc = await PDFDocument.load(boletoBytes);
            const copiedBoletoPages = await mergedPdf.copyPages(boletoDoc, boletoDoc.getPageIndices());
            copiedBoletoPages.forEach((page) => mergedPdf.addPage(page));

            // 4. Save and trigger download
            const mergedPdfBytes = await mergedPdf.save();
            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `Fatura_${invoice.mes_referencia}_${ucData?.numero_uc}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Error generating combined PDF:", error);
            alert("Erro ao gerar PDF combinado. Por favor, tente novamente.");
        } finally {
            setIsGenerating(false);
            setInvoiceToDownload(null);
        }
    };

    // Render Detailed View (Item 3)
    const renderInvoiceDetail = () => {
        if (!selectedInvoice) return null;
        const statusInfo = getStatusInfo(selectedInvoice.status);

        // Data Sync Math (Matching CRM Logic)
        const tarifa = parseFloat(selectedInvoice.tarifa_concessionaria || ucData?.tarifa_concessionaria || 1);
        const totalKwh = parseFloat(selectedInvoice.consumo_kwh || 0);
        const tarifaMinimaRs = parseFloat(selectedInvoice.tarifa_minima || 0);
        const tarifaMinimaKwh = tarifaMinimaRs / tarifa;

        // Consumo Compensado = Total - Tarifa Mínima (e.g. 300 - 100 = 200)
        const consumoCompensadoKwh = totalKwh - tarifaMinimaKwh;
        const consumoCompensadoReais = consumoCompensadoKwh * tarifa;

        const economia = parseFloat(selectedInvoice.economia_reais || 0);
        const energiaCompensadaLiquida = consumoCompensadoReais - economia;

        return (
            <div className="invoice-detail-view">
                <button className="back-btn" onClick={handleBackToList}>
                    <ArrowLeft size={18} />
                    Voltar para a lista
                </button>

                <div className="detail-card">
                    <div className="branded-header">
                        {branding?.logo_url ? (
                            <img src={branding.logo_url} alt={branding.company_name} className="company-logo-modal" />
                        ) : (
                            <div className="company-info-fallback">
                                <FileText size={24} color="#FF6600" />
                                <span>{branding?.company_name || 'B2W Energia'}</span>
                            </div>
                        )}
                    </div>
                    <div className="detail-header">
                        <div className="header-info">
                            <Info size={20} color="#ffffff" />
                            <h3>Detalhamento da Fatura</h3>
                        </div>
                        <span className="detail-status" style={{ backgroundColor: statusInfo.color }}>
                            {statusInfo.label}
                        </span>
                    </div>

                    <div className="detail-grid">
                        <div className="detail-section dark">
                            <div className="detail-item">
                                <label>ASSINANTE</label>
                                <span>{subscriberName || 'N/A'}</span>
                            </div>
                            <div className="detail-row">
                                <div className="detail-item">
                                    <label>NÚMERO DA UC</label>
                                    <span>{ucData?.numero_uc}</span>
                                </div>
                                <div className="detail-item">
                                    <label>IDENTIFICAÇÃO (APELIDO)</label>
                                    <span>{ucData?.identification || ucData?.titular_conta || 'Unidade Consumidora'}</span>
                                </div>
                            </div>
                            <div className="detail-row">
                                <div className="detail-item">
                                    <label>MÊS REFERÊNCIA</label>
                                    <span>{formatDate(selectedInvoice.mes_referencia, 'ref')}</span>
                                </div>
                                <div className="detail-item">
                                    <label>VENCIMENTO</label>
                                    <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>{formatDate(selectedInvoice.vencimento)}</span>
                                </div>
                            </div>
                            <div className="detail-item">
                                <label>TIPO DE LIGAÇÃO</label>
                                <span className="connection-type-badge">{selectedInvoice.tipo_ligacao || ucData?.tipo_ligacao || 'N/A'}</span>
                            </div>
                        </div>

                        <div className="detail-section metrics">
                            <div className="metric-line">
                                <span>Consumo Compensado ({consumoCompensadoKwh.toFixed(0)} kWh):</span>
                                <span>{formatCurrency(consumoCompensadoReais)}</span>
                            </div>
                            <div className="metric-line secondary">
                                <span>Valor da Tarifa:</span>
                                <span>R$ {tarifa.toFixed(4)}</span>
                            </div>

                            <div className="economy-box">
                                <div className="metric-line economy">
                                    <span>Economia Gerada:</span>
                                    <span>- {formatCurrency(economia)}</span>
                                </div>
                                <div className="metric-line discount">
                                    <span>Desconto Aplicado:</span>
                                    <span>{selectedInvoice.desconto_assinante || ucData?.desconto_assinante || 0}%</span>
                                </div>
                            </div>

                            <div className="metric-line bold">
                                <span>Energia Compensada Líquida:</span>
                                <span>{formatCurrency(energiaCompensadaLiquida)}</span>
                            </div>

                            <hr />

                            <div className="metric-line">
                                <span>+ Iluminação Pública:</span>
                                <span>{formatCurrency(selectedInvoice.iluminacao_publica)}</span>
                            </div>
                            <div className="metric-line">
                                <span>+ Tarifa Mínima:</span>
                                <span>{formatCurrency(selectedInvoice.tarifa_minima)}</span>
                            </div>
                            <div className="metric-line">
                                <span>+ Outros Lançamentos:</span>
                                <span>{formatCurrency(selectedInvoice.outros_lancamentos)}</span>
                            </div>

                            <div className="total-box">
                                <div className="total-label">TOTAL A PAGAR</div>
                                <div className="total-value">{formatCurrency(selectedInvoice.valor_a_pagar)}</div>
                            </div>
                        </div>
                    </div>

                    {selectedInvoice.asaas_boleto_url && (
                        <div className="detail-footer">
                            <a href={selectedInvoice.asaas_boleto_url} target="_blank" rel="noopener noreferrer" className="pay-detail-btn">
                                <CreditCard size={18} />
                                Pagar agora
                            </a>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // This is the same as renderInvoiceDetail but wrapped for PDF capture
    const renderHiddenInvoiceDetail = (invoice) => {
        if (!invoice) return null;
        const statusInfo = getStatusInfo(invoice.status);

        const tarifa = parseFloat(invoice.tarifa_concessionaria || ucData?.tarifa_concessionaria || 1);
        const totalKwh = parseFloat(invoice.consumo_kwh || 0);
        const tarifaMinimaRs = parseFloat(invoice.tarifa_minima || 0);
        const tarifaMinimaKwh = tarifaMinimaRs / tarifa;
        const consumoCompensadoKwh = totalKwh - tarifaMinimaKwh;
        const consumoCompensadoReais = consumoCompensadoKwh * tarifa;
        const economia = parseFloat(invoice.economia_reais || 0);
        const energiaCompensadaLiquida = consumoCompensadoReais - economia;

        return (
            <div className="pdf-capture-wrapper" style={{ width: '800px', padding: '40px', background: '#f8fafc' }}>
                <div className="detail-card" style={{ border: '1px solid #e2e8f0' }}>
                    <div className="branded-header">
                        {branding?.logo_url ? (
                            <img src={branding.logo_url} alt={branding.company_name} className="company-logo-modal" />
                        ) : (
                            <div className="company-info-fallback">
                                <FileText size={24} color="#FF6600" />
                                <span>{branding?.company_name || 'B2W Energia'}</span>
                            </div>
                        )}
                    </div>
                    <div className="detail-header" style={{ background: '#003366' }}>
                        <div className="header-info">
                            <Info size={20} color="#ffffff" />
                            <h3 style={{ color: '#ffffff' }}>Detalhamento da Fatura</h3>
                        </div>
                        <span className="detail-status" style={{ backgroundColor: statusInfo.color }}>
                            {statusInfo.label}
                        </span>
                    </div>

                    <div className="detail-grid">
                        <div className="detail-section dark">
                            <div className="detail-item">
                                <label>ASSINANTE</label>
                                <span>{subscriberName || 'N/A'}</span>
                            </div>
                            <div className="detail-row">
                                <div className="detail-item">
                                    <label>NÚMERO DA UC</label>
                                    <span>{ucData?.numero_uc}</span>
                                </div>
                                <div className="detail-item">
                                    <label>IDENTIFICAÇÃO (APELIDO)</label>
                                    <span>{ucData?.identification || ucData?.titular_conta || 'Unidade Consumidora'}</span>
                                </div>
                            </div>
                            <div className="detail-row">
                                <div className="detail-item">
                                    <label>MÊS REFERÊNCIA</label>
                                    <span>{formatDate(invoice.mes_referencia, 'ref')}</span>
                                </div>
                                <div className="detail-item">
                                    <label>VENCIMENTO</label>
                                    <span style={{ color: '#ff6b6b', fontWeight: 'bold' }}>{formatDate(invoice.vencimento)}</span>
                                </div>
                            </div>
                            <div className="detail-item">
                                <label>TIPO DE LIGAÇÃO</label>
                                <span className="connection-type-badge">{invoice.tipo_ligacao || ucData?.tipo_ligacao || 'N/A'}</span>
                            </div>
                        </div>

                        <div className="detail-section metrics">
                            <div className="metric-line">
                                <span>Consumo Compensado ({consumoCompensadoKwh.toFixed(0)} kWh):</span>
                                <span>{formatCurrency(consumoCompensadoReais)}</span>
                            </div>
                            <div className="metric-line secondary">
                                <span>Valor da Tarifa:</span>
                                <span>R$ {tarifa.toFixed(4)}</span>
                            </div>

                            <div className="economy-box">
                                <div className="metric-line economy">
                                    <span>Economia Gerada:</span>
                                    <span>- {formatCurrency(economia)}</span>
                                </div>
                                <div className="metric-line discount">
                                    <span>Desconto Aplicado:</span>
                                    <span>{invoice.desconto_assinante || ucData?.desconto_assinante || 0}%</span>
                                </div>
                            </div>

                            <div className="metric-line bold">
                                <span>Energia Compensada Líquida:</span>
                                <span>{formatCurrency(energiaCompensadaLiquida)}</span>
                            </div>

                            <hr />

                            <div className="metric-line">
                                <span>+ Iluminação Pública:</span>
                                <span>{formatCurrency(invoice.iluminacao_publica)}</span>
                            </div>
                            <div className="metric-line">
                                <span>+ Tarifa Mínima:</span>
                                <span>{formatCurrency(invoice.tarifa_minima)}</span>
                            </div>
                            <div className="metric-line">
                                <span>+ Outros Lançamentos:</span>
                                <span>{formatCurrency(invoice.outros_lancamentos)}</span>
                            </div>

                            <div className="total-box">
                                <div className="total-label">TOTAL A PAGAR</div>
                                <div className="total-value">{formatCurrency(invoice.valor_a_pagar)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container-large" onClick={(e) => e.stopPropagation()}>
                <header className="modal-header">
                    <div className="modal-title">
                        <FileText size={24} color="#FF6600" />
                        <div>
                            <h2>{selectedInvoice ? 'Detalhes da Fatura' : `Faturas da UC: ${ucData?.numero_uc || 'N/A'}`}</h2>
                            <p>{ucData?.identification || ucData?.concessionaria || 'Neoenergia Cosern'}</p>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                </header>

                <div className="modal-body-enhanced">
                    {selectedInvoice ? (
                        renderInvoiceDetail()
                    ) : (
                        <>
                            {invoices && invoices.length > 0 ? (
                                <div className="invoices-list-premium">
                                    <div className="list-header-grid">
                                        <span>Status</span>
                                        <span>Referência</span>
                                        <span>Vencimento</span>
                                        <span>Valor</span>
                                        <span className="actions-header">Ações</span>
                                    </div>
                                    <div className="list-content">
                                        {invoices.map((inv) => {
                                            const status = getStatusInfo(inv.status);
                                            return (
                                                <div key={inv.id} className="invoice-row">
                                                    <div className="inv-col">
                                                        <span className="status-badge-outline" style={{ borderColor: status.color, color: status.color }}>
                                                            {status.label}
                                                        </span>
                                                    </div>
                                                    <div className="inv-col bold">
                                                        {formatDate(inv.mes_referencia, 'ref')}
                                                    </div>
                                                    <div className="inv-col">
                                                        {formatDate(inv.vencimento)}
                                                    </div>
                                                    <div className="inv-col value-col">
                                                        {formatCurrency(inv.valor_a_pagar)}
                                                    </div>
                                                    <div className="inv-col actions-group">
                                                        <button
                                                            className="action-icon-btn view"
                                                            onClick={() => handleViewDetail(inv)}
                                                            title="Ver Detalhes"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                        {inv.asaas_boleto_url && (
                                                            <a
                                                                href={inv.asaas_boleto_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="action-icon-btn pay"
                                                                title="Baixar Boleto"
                                                                download
                                                            >
                                                                <CreditCard size={18} />
                                                            </a>
                                                        )}
                                                        <button
                                                            className="action-icon-btn download"
                                                            title="Baixar Detalhamento + Boleto"
                                                            onClick={() => handleDownloadCombined(inv)}
                                                            disabled={isGenerating}
                                                        >
                                                            {isGenerating ? <Loader2 size={18} className="spin-animation" /> : <Download size={18} />}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <p>Nenhuma fatura encontrada para esta unidade.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Hidden wrapper for PDF capture */}
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

export default InvoicesModal;
