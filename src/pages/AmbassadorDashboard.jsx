import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import KPICard from '../components/KPICard';
import LeadsTable from '../components/LeadsTable';
import { Users, DollarSign, TrendingUp } from 'lucide-react';
import LeadCreateModal from '../components/LeadCreateModal';
import './AmbassadorDashboard.css';

const AmbassadorDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [originatorName, setOriginatorName] = useState('');
    const [originatorId, setOriginatorId] = useState(null);
    const [isLeadModalOpen, setIsLeadModalOpen] = useState(false); // [NEW]
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
                setLoading(false);
                return;
            }

            // 2. Fetch Originator Profile
            let { data: originator, error: orgError } = await supabase
                .from('originators_v2')
                .select('id, name, split_commission')
                .eq('email', email)
                .maybeSingle(); // Use maybeSingle to avoid throw on 0 rows

            // [FIX] Handling Admin/Dev Access:
            // If logged in user is NOT in originators table, check if they are admin/dev via profiles
            // For now, if no originator found, fetch the FIRST one just to show the dashboard (Simulation Mode)
            if (!originator) {
                console.warn("User not found in originators_v2. Trying fallback (Admin Mode).");
                const { data: fallbackOriginator } = await supabase
                    .from('originators_v2')
                    .select('id, name, split_commission')
                    .limit(1)
                    .single();

                if (fallbackOriginator) {
                    originator = fallbackOriginator;
                } else {
                    console.warn("Fallback failed. Using static mock.");
                    originator = {
                        id: 'mock-originator-id',
                        name: 'Embaixador Teste',
                        split_commission: 12
                    };
                }
            }

            if (orgError) throw orgError;
            setOriginatorName(originator.name);
            setOriginatorId(originator.id); // Set ID state

            // Store commission percentage (default 12 if null)
            // Handle both number and object {start: X, recurrent: Y}
            let commission = 12;
            const rawCommission = originator.split_commission;

            if (rawCommission) {
                if (typeof rawCommission === 'object') {
                    // Prefer recurrent, then start, then default
                    commission = rawCommission.recurrent || rawCommission.start || 12;
                } else {
                    commission = rawCommission;
                }
            }

            // ... (fetch leads/commissions) ...

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
            }

            setCommissions(commissionsData || []);

            // 5. Calculate Stats
            const totalLeads = leadsData ? leadsData.length : 0;

            let totalValue = 0;
            const processedLeads = (leadsData || []).map(lead => {
                const consumption = lead.consumo_kwh || 0;
                const tariff = lead.tarifa_concessionaria || 0.85;
                const estimatedValue = consumption * tariff;
                totalValue += estimatedValue;
                return { ...lead, estimated_bill_value: estimatedValue };
            });

            const totalRevenue = (commissionsData || []).reduce((acc, curr) => acc + (Number(curr.total_value) || 0), 0);

            setLeads(processedLeads);
            setStats({
                totalLeads,
                totalValue,
                revenue: totalRevenue,
                commissionRate: commission // Add to stats
            });

        } catch (err) {
            console.error("Error fetching ambassador data:", err);
            setError(err.message || "Erro ao carregar dados.");
        } finally {
            setLoading(false);
        }
    };

    // Actions Handlers
    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = '/';
    };

    const handleAddLead = () => {
        setIsLeadModalOpen(true);
    };

    const handleLeadCreated = () => {
        fetchDashboardData();
    };

    const handleEditLead = (lead) => {
        console.log("Edit", lead);
    };

    const handleDeleteLead = (id) => {
        if (window.confirm("Tem certeza que deseja excluir este lead?")) {
            console.log("Delete", id);
        }
    };

    const handleToggleFavorite = (id) => {
        console.log("Toggle Fav", id);
    };

    return (
        <div className="ambassador-dashboard">
            {loading ? (
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Carregando dados...</p>
                </div>
            ) : error ? (
                <div className="error-state">
                    <p>{error}</p>
                    <button className="action-btn primary" onClick={fetchDashboardData}>Tentar Novamente</button>
                    <button className="action-btn" onClick={handleLogout} style={{ marginTop: '1rem', color: '#666' }}>Sair</button>
                </div>
            ) : (
                <>
                    {/* 1. Top Bar: Welcome + Stats */}
                    <div className="top-bar">
                        <div className="welcome-text">
                            <h1>Bem-vindo, {originatorName || 'Embaixador'}!</h1>
                            <p>Você tem {stats.totalLeads} indicados e {leads.filter(l => l.isNew).length} novas atualizações.</p>
                        </div>

                        <div className="top-stats">
                            <div className="stat-item">
                                <span className="stat-value">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.revenue)}
                                    <span className="stat-trend" style={{ color: '#2ecc71' }}>▲ {stats.commissionRate}%</span>
                                </span>
                                <span className="stat-label">Comissões (Total)</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-value">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalValue)}
                                    <span className="stat-trend" style={{ color: '#0ea5e9' }}>• Est.</span>
                                </span>
                                <span className="stat-label">Valor em Contas</span>
                            </div>
                        </div>
                    </div>

                    {/* 2. Main Profile Card */}
                    <div className="profile-card-container">
                        <div className="profile-header">
                            <div className="profile-info">
                                <div className="profile-avatar">
                                    {/* Could use an actual image here if available in profile */}
                                    <div className="profile-avatar-placeholder">
                                        {originatorName ? originatorName.charAt(0) : 'E'}
                                    </div>
                                </div>
                                <div className="profile-details">
                                    <h2>{originatorName || 'Embaixador'}</h2>
                                    {/* Link de Indicação */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', background: '#f8fafc', padding: '0.5rem', borderRadius: '6px' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Link de Indicação:</span>
                                        <a
                                            href={`https://b2wenergia.com.br/convite?name=${encodeURIComponent(originatorName || '')}&id=${originatorId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ fontSize: '0.85rem', color: '#0ea5e9', fontWeight: '500', textDecoration: 'none' }}
                                        >
                                            b2wenergia.com.br/convite?name={originatorName}&id={originatorId}
                                        </a>
                                    </div>
                                </div>
                            </div>
                            <div className="header-actions">
                                <button className="action-btn primary" onClick={handleAddLead}>
                                    + Novo Lead
                                </button>
                                <button className="action-btn" onClick={handleLogout} title="Sair do Sistema">
                                    <span style={{ color: '#e74c3c' }}>Sair</span>
                                </button>
                            </div>
                        </div>

                        {/* 3. Content: Leads Table (Tabs are inside LeadsTable for now) */}
                        <div className="dashboard-content-wrapper">
                            <LeadsTable
                                leads={leads}
                                onAddLead={handleAddLead}
                                onEditLead={handleEditLead}
                                onDeleteLead={handleDeleteLead}
                                onToggleFavorite={handleToggleFavorite}
                            />
                        </div>
                    </div>

                    {/* Lead Creation Modal */}
                    <LeadCreateModal
                        isOpen={isLeadModalOpen}
                        onClose={() => setIsLeadModalOpen(false)}
                        originatorId={originatorId}
                        onSuccess={handleLeadCreated}
                    />

                </>
            )}
        </div>
    );
};

export default AmbassadorDashboard;
