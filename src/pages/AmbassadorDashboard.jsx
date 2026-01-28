import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import KPICard from '../components/KPICard';
import LeadsTable from '../components/LeadsTable';
import { Users, DollarSign, TrendingUp } from 'lucide-react';
import './AmbassadorDashboard.css';

const AmbassadorDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [originatorName, setOriginatorName] = useState('');
    const [leads, setLeads] = useState([]);
    const [commissions, setCommissions] = useState([]); // [NEW] Shared state for commissions
    const [stats, setStats] = useState({
        totalLeads: 0,
        totalValue: 0,
        revenue: 0
    });

    const [error, setError] = useState(null);

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
                console.log("No session found.");
                // Fallback for debug flow if needed, similar to Subscriber dashboard
            }

            if (!email) {
                setLoading(false);
                return;
            }

            // 2. Fetch Originator Profile
            const { data: originator, error: orgError } = await supabase
                .from('originators_v2')
                .select('id, name')
                .eq('email', email)
                .single();

            if (orgError) throw orgError;
            setOriginatorName(originator.name);

            // 3. Fetch Leads
            const { data: leadsData, error: leadsError } = await supabase
                .from('leads')
                .select('*')
                .eq('originator_id', originator.id)
                .order('created_at', { ascending: false });

            if (leadsError) throw leadsError;

            // 4. Fetch Commissions
            const { data: commissionsData, error: commError } = await supabase
                .from('commissions')
                .select('*')
                .eq('originator_id', originator.id)
                .order('reference_month', { ascending: false });

            if (commError) {
                console.warn("Commissions fetch warning:", commError);
                // Non-critical, just empty
            }

            setCommissions(commissionsData || []);

            // 5. Calculate Stats
            const totalLeads = leadsData.length;

            // Calculate Total Estimated Value (Monthly Bill)
            let totalValue = 0;
            const processedLeads = leadsData.map(lead => {
                const consumption = lead.consumo_kwh || 0;
                const tariff = lead.tarifa_concessionaria || 0.85;
                const estimatedValue = consumption * tariff;
                totalValue += estimatedValue;
                return { ...lead, estimated_bill_value: estimatedValue };
            });

            // Calculate Revenue (Total Paid Commissions or All Commissions?)
            // Usually 'Revenue' for dashboard is what they earned (Pending + Paid or just Paid).
            // Let's sum all commissions for now.
            const totalRevenue = (commissionsData || []).reduce((acc, curr) => acc + (Number(curr.total_value) || 0), 0);

            setLeads(processedLeads);
            setStats({
                totalLeads,
                totalValue,
                revenue: totalRevenue
            });

        } catch (err) {
            console.error("Error fetching ambassador data:", err);
            setError("Erro ao carregar dados.");
        } finally {
            setLoading(false);
        }
    };

    // Actions Handlers (Placeholders)
    const handleAddLead = () => {
        alert("Funcionalidade de Adicionar Lead em breve!");
    };

    const handleEditLead = (lead) => {
        console.log("Edit", lead);
    };

    const handleDeleteLead = (id) => {
        if (window.confirm("Tem certeza que deseja excluir este lead?")) {
            // Implement delete logic here
            console.log("Delete", id);
        }
    };

    const handleToggleFavorite = (id) => {
        console.log("Toggle Fav", id);
    };

    return (
        <div className="ambassador-dashboard">
            <header className="dashboard-header">
                <div className="header-content">
                    <h1>Bem-vindo, {originatorName || 'Embaixador'}!</h1>
                    <p>Acompanhe seus leads e comissões.</p>
                </div>
            </header>

            {loading ? (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Carregando dados...</p>
                </div>
            ) : error ? (
                <div className="error-state">
                    <p>{error}</p>
                </div>
            ) : (
                <div className="dashboard-content">
                    {/* KPI Cards */}
                    <div className="kpi-grid">
                        <KPICard
                            title="Total de Leads"
                            value={stats.totalLeads}
                            icon={Users}
                            trend={0}
                        />
                        <KPICard
                            title="Valor Estimado Contas (Mensal)"
                            value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalValue)}
                            icon={TrendingUp}
                        />
                        <KPICard
                            title="Comissões Acumuladas"
                            value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.revenue)}
                            icon={DollarSign}
                            trend={0}
                        />
                    </div>

                    {/* Leads Table */}
                    <section className="leads-section" style={{ marginBottom: '2rem' }}>
                        <h2>Seus Indicados</h2>
                        <LeadsTable
                            leads={leads}
                            onAddLead={handleAddLead}
                            onEditLead={handleEditLead}
                            onDeleteLead={handleDeleteLead}
                            onToggleFavorite={handleToggleFavorite}
                        />
                    </section>

                    {/* Commissions Table */}
                    <section className="commissions-section">
                        <h2>Extrato de Comissões</h2>
                        <div className="table-responsive" style={{ background: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #eee', textAlign: 'left', color: '#666' }}>
                                        <th style={{ padding: '1rem' }}>Mês Ref.</th>
                                        <th style={{ padding: '1rem' }}>Qtd. Faturas</th>
                                        <th style={{ padding: '1rem' }}>Valor</th>
                                        <th style={{ padding: '1rem' }}>Status</th>
                                        <th style={{ padding: '1rem' }}>Data Pagamento</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {commissions.length > 0 ? (
                                        commissions.map(c => (
                                            <tr key={c.id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                                                <td style={{ padding: '1rem' }}>{new Date(c.reference_month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</td>
                                                <td style={{ padding: '1rem' }}>{c.total_invoices}</td>
                                                <td style={{ padding: '1rem', color: 'green', fontWeight: 'bold' }}>
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.total_value)}
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <span style={{
                                                        padding: '0.25rem 0.75rem',
                                                        borderRadius: '999px',
                                                        fontSize: '0.85rem',
                                                        backgroundColor: c.status === 'paid' ? '#dcfce7' : '#fef3c7',
                                                        color: c.status === 'paid' ? '#166534' : '#92400e'
                                                    }}>
                                                        {c.status === 'paid' ? 'Pago' : 'Pendente'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem' }}>{c.payment_date ? new Date(c.payment_date).toLocaleDateString() : '-'}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Nenhuma comissão registrada.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default AmbassadorDashboard;
