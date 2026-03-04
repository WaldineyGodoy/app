import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import UCCard from '../components/UCCard';
import { SavingsChart, ConsumptionChart } from '../components/DashboardCharts';
import InvoicesModal from '../components/InvoicesModal';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, FileText, LogOut } from 'lucide-react';
import { mergePdf } from '../lib/api';
import './SubscriberDashboard.css';

const SubscriberDashboard = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [subscriberName, setSubscriberName] = useState('');
    const [subscriberStatus, setSubscriberStatus] = useState(null);
    const [ucs, setUcs] = useState([]);
    const [allInvoices, setAllInvoices] = useState([]); // Store all raw invoices
    const [chartData, setChartData] = useState([]);
    const [branding, setBranding] = useState(null);
    const [billingMode, setBillingMode] = useState('individualizada');
    const [consolidatedInvoice, setConsolidatedInvoice] = useState(null);
    const [consolidatedDetails, setConsolidatedDetails] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [loadingStep, setLoadingStep] = useState('');
    const [error, setError] = useState(null);
    const hiddenConsolidatedRef = useRef(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUC, setSelectedUC] = useState(null);
    const [selectedVCInvoices, setSelectedVCInvoices] = useState([]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // 1. Get User Session
            const { data: { session } } = await supabase.auth.getSession();
            const email = session?.user?.email;

            if (!email) {
                // Fallback / Error handling
                console.log("No session found. Please login properly.");
                setLoading(false);
                return;
            }

            // fetch branding
            const { data: brandingData } = await supabase
                .from('branding_settings')
                .select('*')
                .single();
            if (brandingData) setBranding(brandingData);

            // 2. Fetch Subscriber Profile
            const { data: subscriber, error: subError } = await supabase
                .from('subscribers')
                .select('id, name, status, billing_mode')
                .eq('email', email)
                .single();

            if (subError) throw subError;
            setSubscriberName(subscriber.name);
            setSubscriberStatus(subscriber.status);
            setBillingMode(subscriber.billing_mode || 'individualizada');

            // 2.1 Fetch Consolidated Invoice if applicable
            if (subscriber.billing_mode === 'consolidada') {
                const { data: consolidated, error: consError } = await supabase
                    .from('consolidated_invoices')
                    .select('*')
                    .eq('subscriber_id', subscriber.id)
                    .order('due_date', { ascending: false })
                    .limit(1)
                    .single();

                if (consolidated) {
                    setConsolidatedInvoice(consolidated);

                    // Fetch details (individual invoices)
                    const { data: details, error: detailsError } = await supabase
                        .from('invoices')
                        .select('*, consumer_units(numero_uc, titular_conta)')
                        .eq('consolidated_invoice_id', consolidated.id);

                    if (details) setConsolidatedDetails(details);
                }
            }

            // 3. Fetch Consumer Units
            const { data: units, error: ucError } = await supabase
                .from('consumer_units')
                .select('*')
                .eq('subscriber_id', subscriber.id);

            if (ucError) throw ucError;

            // 4. Fetch Invoices for these UCs
            const ucIds = units.map(uc => uc.id);
            if (ucIds.length > 0) {
                const { data: invoices, error: invError } = await supabase
                    .from('invoices')
                    .select('*')
                    .in('uc_id', ucIds)
                    .order('mes_referencia', { ascending: false }); // Latest first is better for lists

                if (invError) throw invError;

                setAllInvoices(invoices); // Store all for reference

                // 4.1 Filter Valid Invoices for Charts and Summaries (exclude cancelled)
                const validInvoices = invoices.filter(inv => inv.status !== 'cancelado');

                // 5. Process Data for UC Cards (Latest Valid Invoice per UC)
                const processedUnits = units.map(uc => {
                    // Filter valid invoices for this UC
                    const ucInvoices = validInvoices.filter(inv => inv.uc_id === uc.id);
                    // Sort descending to get latest
                    const sortedInvoices = [...ucInvoices].sort((a, b) => new Date(b.mes_referencia) - new Date(a.mes_referencia));
                    const latestInvoice = sortedInvoices[0];

                    return {
                        ...uc,
                        identification: uc.titular_conta || uc.address?.apelido || 'Unidade Consumidora',
                        lastConsumption: latestInvoice?.consumo_kwh || 0,
                        compensatedConsumption: latestInvoice?.energia_compensada || latestInvoice?.consumo_kwh || 0,
                        amountToPay: latestInvoice?.valor_a_pagar || 0,
                        invoiceStatus: latestInvoice?.status || 'Sem Faturas',
                        invoiceDueDate: latestInvoice?.vencimento || null,
                        invoiceId: latestInvoice?.id || null,
                        paymentUrl: latestInvoice?.asaas_boleto_url || null,
                        // Data Sync Fixes: Fallback to UC data if invoice data is missing
                        invoiceTipoLigacao: latestInvoice?.tipo_ligacao || uc.tipo_ligacao,
                        invoiceDesconto: latestInvoice?.desconto_assinante || uc.desconto_assinante
                    };
                });
                setUcs(processedUnits);

                // 6. Process Data for Charts (Aggregated by Month, Ascending) - Use validInvoices only
                const monthlyData = {};
                // Need to sort ascending for chart
                const ascendingInvoices = [...validInvoices].sort((a, b) => new Date(a.mes_referencia) - new Date(b.mes_referencia));

                ascendingInvoices.forEach(inv => {
                    const monthKey = inv.mes_referencia ? inv.mes_referencia.substring(0, 7) : 'Unknown'; // YYYY-MM

                    if (!monthlyData[monthKey]) {
                        monthlyData[monthKey] = {
                            month: monthKey,
                            concessionaireValue: 0,
                            b2wValue: 0,
                            consumption: 0
                        };
                    }

                    // To show real savings, Concessionaire = B2W + Economy
                    // This avoids apples-to-oranges comparison if columns are populated differently
                    const b2w = (inv.valor_a_pagar || 0);
                    const economy = (inv.economia_reais || 0);

                    monthlyData[monthKey].concessionaireValue += (b2w + economy);
                    monthlyData[monthKey].b2wValue += b2w;
                    monthlyData[monthKey].consumption += (inv.consumo_kwh || 0);
                });

                // Convert object to array
                const sortedChartData = Object.values(monthlyData);
                // prettify labels
                const formattedChartData = sortedChartData.map(item => {
                    const [year, month] = item.month.split('-');
                    const dateObj = new Date(year, month - 1);
                    return {
                        ...item,
                        month: dateObj.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
                    };
                });

                setChartData(formattedChartData);
            } else {
                setUcs(units);
            }

        } catch (err) {
            console.error("Error fetching dashboard data:", err);
            setError("Erro ao carregar dados. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (uc) => {
        setSelectedUC(uc);
        // Filter invoices for this UC and exclude cancelled ones
        const filtered = allInvoices.filter(inv =>
            inv.uc_id === uc.id &&
            inv.status?.toLowerCase() !== 'cancelado'
        );
        setSelectedVCInvoices(filtered);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedUC(null);
        setSelectedVCInvoices([]);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const handleDownloadConsolidated = async () => {
        if (!consolidatedInvoice) return;

        setIsGenerating(true);
        setLoadingStep('Preparando demonstrativo consolidado...');

        try {
            // Wait for hidden render
            await new Promise(resolve => setTimeout(resolve, 800));

            setLoadingStep('Capturando resumo das unidades...');
            const element = hiddenConsolidatedRef.current;
            element.style.display = 'block';

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff"
            });

            element.style.display = 'none';

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = 210;
            const imgHeight = (canvas.height * pageWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, imgHeight);
            const base64Summary = pdf.output('datauristring');

            setLoadingStep('Mesclando com boleto consolidado...');
            await mergePdf(
                base64Summary,
                consolidatedInvoice.asaas_boleto_url,
                `Fatura_Consolidada_${consolidatedInvoice.due_date}.pdf`
            );

        } catch (error) {
            console.error("Erro no download consolidado:", error);
            alert("Erro ao gerar fatura consolidada.");
        } finally {
            setIsGenerating(false);
            setLoadingStep('');
        }
    };

    const renderHiddenConsolidatedDetail = () => {
        if (!consolidatedInvoice || consolidatedDetails.length === 0) return null;

        const totalValue = consolidatedDetails.reduce((sum, inv) => sum + (Number(inv.valor_a_pagar) || 0), 0);

        return (
            <div className="consolidated-pdf-template" style={{ padding: '40px', background: 'white', color: '#1e293b', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: '2px solid #003366', paddingBottom: '20px' }}>
                    <div>
                        {branding?.logo_url ? (
                            <img src={branding.logo_url} alt="Logo" style={{ height: '50px' }} />
                        ) : (
                            <h2 style={{ color: '#003366', margin: 0 }}>{branding?.company_name || 'B2W Energia'}</h2>
                        )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <h1 style={{ margin: 0, fontSize: '24px', color: '#003366' }}>DETALHAMENTO CONSOLIDADO</h1>
                        <p style={{ margin: '5px 0', color: '#64748b' }}>Referência: {new Date(consolidatedInvoice.due_date).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                    </div>
                </div>

                <div style={{ marginBottom: '30px' }}>
                    <p><strong>Assinante:</strong> {subscriberName}</p>
                    <p><strong>Vencimento:</strong> {new Date(consolidatedInvoice.due_date).toLocaleDateString('pt-BR')}</p>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', color: '#003366' }}>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Unidade Consumidora</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>Titular</th>
                            <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #e2e8f0' }}>Valor (R$)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {consolidatedDetails.map((inv, idx) => (
                            <tr key={idx}>
                                <td style={{ padding: '12px', borderBottom: '1px solid #e2e8f0' }}>{inv.consumer_units?.numero_uc}</td>
                                <td style={{ padding: '12px', borderBottom: '1px solid #e2e8f0' }}>{inv.consumer_units?.titular_conta}</td>
                                <td style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inv.valor_a_pagar)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr style={{ fontWeight: 'bold', background: '#f8fafc' }}>
                            <td colSpan="2" style={{ padding: '15px', textAlign: 'right', fontSize: '18px' }}>VALOR TOTAL</td>
                            <td style={{ padding: '15px', textAlign: 'right', fontSize: '18px', color: '#003366' }}>
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValue)}
                            </td>
                        </tr>
                    </tfoot>
                </table>

                <div style={{ marginTop: '50px', paddingTop: '20px', borderTop: '1px solid #e2e8f0', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                    Documento gerado automaticamente pelo portal do assinante {branding?.company_name || 'B2W Energia'}.
                </div>
            </div>
        );
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="header-content">
                    <div className="title-wrapper">
                        <h1>Olá, {subscriberName || 'Assinante'}</h1>
                        {subscriberStatus && (
                            <span className={`subscriber-status-badge ${subscriberStatus.toLowerCase()}`}>
                                {subscriberStatus}
                            </span>
                        )}
                    </div>
                    <p>Bem-vindo ao seu painel de energia.</p>
                </div>

                <div className="header-actions">
                    <div className="billing-info-badge">
                        <span className="info-label">Opção de faturamento:</span>
                        <span className={`info-value ${billingMode}`}>
                            {billingMode === 'consolidada' ? 'Consolidada' : 'Individualizada'}
                        </span>
                    </div>

                    {billingMode === 'consolidada' && consolidatedInvoice && (
                        <button
                            className="btn-consolidated"
                            onClick={handleDownloadConsolidated}
                            disabled={isGenerating}
                        >
                            <FileText size={18} />
                            Emitir Fatura Consolidada
                        </button>
                    )}
                </div>
            </header>

            {
                loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Carregando seus dados...</p>
                    </div>
                ) : error ? (
                    <div className="error-state">
                        <p>Por enquanto nenhuma conta ativa, se você já é nosso cliente aguarde 24 horas para a atualização ou entre em contato com o nosso suporte</p>
                    </div>
                ) : (
                    <div className="dashboard-content">
                        {/* section: UC Cards */}
                        <section className="ucs-section">
                            <h2>Suas Unidades Consumidoras</h2>
                            <div className="ucs-grid">
                                {ucs.length > 0 ? (
                                    ucs.map(uc => (
                                        <UCCard
                                            key={uc.id}
                                            ucNumber={uc.numero_uc || uc.consumer_unit_number || 'N/A'}
                                            identification={uc.identification}
                                            concessionaire={uc.concessionaria || uc.distributor}
                                            ucStatus={uc.status}
                                            invoiceStatus={uc.invoiceStatus}
                                            lastConsumption={uc.lastConsumption}
                                            compensatedConsumption={uc.compensatedConsumption}
                                            invoiceDueDate={uc.invoiceDueDate}
                                            amountToPay={uc.amountToPay}
                                            paymentUrl={uc.paymentUrl}
                                            onViewInvoices={() => handleOpenModal(uc)}
                                        />
                                    ))
                                ) : (
                                    <p className="no-data">Nenhuma UC encontrada para este perfil.</p>
                                )}
                            </div>
                        </section>

                        {/* section: Charts */}
                        {chartData.length > 0 && (
                            <>
                                <section className="charts-section">
                                    <SavingsChart data={chartData} />
                                </section>

                                <section className="charts-section">
                                    <ConsumptionChart data={chartData} />
                                </section>
                            </>
                        )}
                    </div>
                )
            }

            {/* Invoices Modal */}
            <InvoicesModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                ucData={selectedUC}
                invoices={selectedVCInvoices}
                branding={branding}
            />

            <footer className="dashboard-footer">
                <button className="btn-logout" onClick={handleLogout}>
                    <LogOut size={18} />
                    Sair da Conta
                </button>
                <p>&copy; {new Date().getFullYear()} {branding?.company_name || 'B2W Energia'} - Todos os direitos reservados</p>
            </footer>

            {/* Hidden area for capture */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                <div ref={hiddenConsolidatedRef} style={{ display: 'none' }}>
                    {renderHiddenConsolidatedDetail()}
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
                            <h4 className="mt-3 mb-1">Processando Fatura</h4>
                            <motion.p
                                key={loadingStep}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-muted small"
                            >
                                {loadingStep}
                            </motion.p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
};

export default SubscriberDashboard;
