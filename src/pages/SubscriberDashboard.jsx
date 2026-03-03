import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import UCCard from '../components/UCCard';
import { SavingsChart, ConsumptionChart } from '../components/DashboardCharts';
import InvoicesModal from '../components/InvoicesModal';
import './SubscriberDashboard.css';

const SubscriberDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [subscriberName, setSubscriberName] = useState('');
    const [ucs, setUcs] = useState([]);
    const [allInvoices, setAllInvoices] = useState([]); // Store all raw invoices
    const [chartData, setChartData] = useState([]);
    const [error, setError] = useState(null);

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

            // 2. Fetch Subscriber Profile
            const { data: subscriber, error: subError } = await supabase
                .from('subscribers')
                .select('id, name')
                .eq('email', email)
                .single();

            if (subError) throw subError;
            setSubscriberName(subscriber.name);

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
                        lastConsumption: latestInvoice?.consumo_kwh || 0,
                        amountToPay: latestInvoice?.valor_a_pagar || 0,
                        invoiceStatus: latestInvoice?.status || 'Sem Faturas' // Renamed to avoid overriding uc.status
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
        // Filter invoices for this UC
        const filtered = allInvoices.filter(inv => inv.uc_id === uc.id);
        setSelectedVCInvoices(filtered);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedUC(null);
        setSelectedVCInvoices([]);
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="header-content">
                    <h1>Olá, {subscriberName || 'Assinante'}</h1>
                    <p>Bem-vindo ao seu painel de energia.</p>
                </div>
                {/* Add User Menu/Logout eventually */}
            </header>

            {loading ? (
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
                                        concessionaire={uc.concessionaria || uc.distributor}
                                        status={uc.invoiceStatus || uc.status}
                                        lastConsumption={uc.lastConsumption}
                                        amountToPay={uc.amountToPay}
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
            )}

            {/* Invoices Modal */}
            <InvoicesModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                ucData={selectedUC}
                invoices={selectedVCInvoices}
            />
        </div>
    );
};

export default SubscriberDashboard;
