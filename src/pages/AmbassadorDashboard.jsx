import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import KPICard from '../components/KPICard';
import LeadsTable from '../components/LeadsTable';
import { Users, DollarSign, TrendingUp } from 'lucide-react';
import './AmbassadorDashboard.css';

const AmbassadorDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [originatorName, setOriginatorName] = useState('');
    const [leads, setLeads] = useState([]);
    const [stats, setStats] = useState({
        totalLeads: 0,
        totalValue: 0,
        revenue: 0 // Mocked
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

            // 4. Calculate Stats
            const totalLeads = leadsData.length;

            // Calculate Total Estimated Value (Monthly Bill)
            // Logic: if estimated_bill_value exists (not in inspected schema?), derive from consumption.
            // Schema had: consumo_kwh, tarifa_concessionaria.
            // Value = consumo_kwh * tarifa_concessionaria (if available) OR consumo_kwh * 0.85 (avg)

            let totalValue = 0;
            const processedLeads = leadsData.map(lead => {
                const consumption = lead.consumo_kwh || 0;
                const tariff = lead.tarifa_concessionaria || 0.85; // Default fallback rate
                const estimatedValue = consumption * tariff;

                totalValue += estimatedValue;

                return {
                    ...lead,
                    estimated_bill_value: estimatedValue
                };
            });

            setLeads(processedLeads);
            setStats({
                totalLeads,
                totalValue,
                revenue: 0 // Mocked as 0 for now
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
                            trend={12} // Mock trend
                        />
                        <KPICard
                            title="Valor Total Indicado (Mensal)"
                            value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalValue)}
                            icon={TrendingUp}
                        />
                        <KPICard
                            title="Receita Recente (Último Mês)"
                            value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.revenue)}
                            icon={DollarSign}
                            trend={0}
                        />
                    </div>

                    {/* Leads Table */}
                    <section className="leads-section">
                        <h2>Seus Indicados</h2>
                        <LeadsTable
                            leads={leads}
                            onAddLead={handleAddLead}
                            onEditLead={handleEditLead}
                            onDeleteLead={handleDeleteLead}
                            onToggleFavorite={handleToggleFavorite}
                        />
                    </section>
                </div>
            )}
        </div>
    );
};

export default AmbassadorDashboard;
