import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import KPICard from '../components/KPICard';
import LeadsTable from '../components/LeadsTable';
import { Users, DollarSign, TrendingUp, Copy, Check, MessageCircle, Send } from 'lucide-react';
import LeadCreateModal from '../components/LeadCreateModal';
import { sendWhatsapp } from '../lib/api'; // [NEW] Import API
import './AmbassadorDashboard.css';

const AmbassadorDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [originatorName, setOriginatorName] = useState('');
    const [originatorCompany, setOriginatorCompany] = useState(''); // [NEW]
    const [originatorId, setOriginatorId] = useState(null);
    const [isLeadModalOpen, setIsLeadModalOpen] = useState(false); // [NEW]
    const [leads, setLeads] = useState([]);
    const [commissions, setCommissions] = useState([]); // [NEW] Shared state for commissions
    const [stats, setStats] = useState({
        totalLeads: 0,
        totalValue: 0,
        revenue: 0
    });

    // [NEW] Share States
    const [copied, setCopied] = useState(false);
    const [showWaInput, setShowWaInput] = useState(false);
    const [waPhone, setWaPhone] = useState('');
    const [sendingWa, setSendingWa] = useState(false);

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
                .select('id, name, split_commission, company_name') // [NEW] Fetch company_name
                .eq('email', email)
                .maybeSingle();

            // [FIX] Handling Admin/Dev Access:
            // If logged in user is NOT in originators table, check if they are admin/dev via profiles
            // For now, if no originator found, fetch the FIRST one just to show the dashboard (Simulation Mode)
            if (!originator) {
                console.warn("User not found in originators_v2. Trying fallback (Admin Mode).");
                const { data: fallbackOriginator } = await supabase
                    .from('originators_v2')
                    .select('id, name, split_commission, company_name')
                    .limit(1)
                    .single();

                if (fallbackOriginator) {
                    originator = fallbackOriginator;
                } else {
                    console.warn("Fallback failed. Using static mock.");
                    originator = {
                        id: 'mock-originator-id',
                        name: 'Embaixador Teste',
                        split_commission: 12,
                        company_name: 'B2W Energia'
                    };
                }
            }

            if (orgError) throw orgError;
            setOriginatorName(originator.name);
            setOriginatorCompany(originator.company_name || 'B2W Energia'); // [NEW] Set company name (default if null)
            setOriginatorId(originator.id);


            let commission = 0;
            const rawCommission = originator.split_commission;

            if (rawCommission) {
                if (typeof rawCommission === 'object') {
                    // Prefer recurrent, then start, then default 0
                    commission = rawCommission.recurrent || rawCommission.start || 0;
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

            let totalValue = 0;      // Total Estimated Value (All Leads)
            let activeSum = 0;       // Sum for 'ativo' leads
            let paidSum = 0;         // Sum for 'pago' leads

            const processedLeads = (leadsData || []).map(lead => {
                const consumption = lead.consumo_kwh || 0;
                const tariff = lead.tarifa_concessionaria || 0.85;
                const discount = lead.calculated_discount || 0; // Use discount from DB or 0
                const status = lead.status ? lead.status.toLowerCase() : '';

                // Formula: ((Consumption * Tariff) - Discount) * Commission%
                // Commission is percentage 0-100, so divide by 100
                const commissionVal = Number(commission) || 0;
                const baseValue = (consumption * tariff) - discount;
                const estimatedCommission = baseValue * (commissionVal / 100);

                totalValue += estimatedCommission;

                // Sum based on status
                if (status === 'ativo') {
                    activeSum += estimatedCommission;
                }
                if (status === 'pago') {
                    paidSum += estimatedCommission;
                }

                // We'll update estimated_bill_value to hold the COMMISSION value for the table
                return { ...lead, estimated_bill_value: estimatedCommission };
            });

            // "Comissões (Total)" Display = (Historical Payouts) + (Active Leads Value)
            // As per user request: "Valores a receber com status [Ativo] devem ser somado na exibição comissões total"
            const historicalRevenue = (commissionsData || []).reduce((acc, curr) => acc + (Number(curr.total_value) || 0), 0);
            const displayTotalCommission = historicalRevenue + activeSum;

            setLeads(processedLeads);
            setStats({
                totalLeads,
                totalValue, // Comissões Estimadas (Geral)
                revenue: displayTotalCommission, // Comissões (Total)
                paid: paidSum, // New Stat: Comissões Pagas
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

    // [NEW] Check if link logic is correct
    // Link format: https://b2wenergia.com.br/convite?name=NAME&id=ID
    const inviteLink = `https://b2wenergia.com.br/convite?name=${encodeURIComponent(originatorName || '')}&id=${originatorId}`;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSendWhatsappInvite = async () => {
        if (!waPhone || waPhone.length < 10) {
            alert("Digite um número de telefone válido (DDD + Número).");
            return;
        }

        setSendingWa(true);
        try {
            const message = `Olá! Sou ${originatorName}. Venha simular sua economia de energia solar com a B2W Energia de forma gratuita: ${inviteLink}`;

            await sendWhatsapp(waPhone, message);

            alert("Convite enviado com sucesso!");
            setWaPhone('');
            setShowWaInput(false);
        } catch (err) {
            console.error(err);
            alert("Erro ao enviar WhatsApp: " + (err.message || 'Erro desconhecido'));
        } finally {
            setSendingWa(false);
        }
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

                            {/* [NEW] Comissões Pagas */}
                            <div className="stat-item">
                                <span className="stat-value">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.paid)}
                                    <span className="stat-trend" style={{ color: '#10b981' }}>✔</span>
                                </span>
                                <span className="stat-label">Comissões Pagas</span>
                            </div>

                            <div className="stat-item">
                                <span className="stat-value">
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalValue)}
                                    <span className="stat-trend" style={{ color: '#0ea5e9' }}>• Est.</span>
                                </span>
                                <span className="stat-label">Comissões Estimadas</span>
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

                                    {/* Link de Indicação UI Area */}
                                </div>
                            </div>
                        </div>
                        <div className="header-actions">
                            <button className="action-btn" style={{ background: '#16a34a', color: 'white', border: 'none' }} onClick={handleAddLead}>
                                Enviar Convite
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

            <LeadCreateModal
                isOpen={isLeadModalOpen}
                onClose={() => setIsLeadModalOpen(false)}
                originatorId={originatorId}
                originatorName={originatorName}
                companyName={originatorCompany}
                onSuccess={handleLeadCreated}
            />

        </>
    )
}
        </div >
    );
};

export default AmbassadorDashboard;
