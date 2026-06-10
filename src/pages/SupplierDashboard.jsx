import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ledgerService } from '../services/ledgerService'; // [NEW] Ledger Service
import KPICard from '../components/KPICard';
import PlantCard from '../components/PlantCard';
import PlantInvoicesModal from '../components/PlantInvoicesModal';
import PlantAnalyticsModal from '../components/PlantAnalyticsModal';
import SupplierPlantsModal from '../components/SupplierPlantsModal';
import SupplierUCsModal from '../components/SupplierUCsModal';
import SupplierProfileModal from '../components/SupplierProfileModal';
import ThemeToggle from '../components/ThemeToggle';
import PlantLedgerModal from '../components/PlantLedgerModal';
import { Factory, Zap, Users, Coins, LogOut, ChevronRight, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './SupplierDashboard.css';

import { useAuth } from '../contexts/AuthContext';

const SupplierDashboard = () => {
    const { user, signOut, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [supplierData, setSupplierData] = useState(null);
    const [usinas, setUsinas] = useState([]);
    const [stats, setStats] = useState({
        totalUsinas: 0,
        totalUCs: 0,
        totalGeneration: 0,
        totalReceivable: 0 // [NEW] KPI
    });

    // Modal States
    const [selectedUsina, setSelectedUsina] = useState(null);
    const [showInvoicesModal, setShowInvoicesModal] = useState(false);
    const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
    const [showPlantsModal, setShowPlantsModal] = useState(false);
    const [showUCsModal, setShowUCsModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showLedgerModal, setShowLedgerModal] = useState(false);

    // Active Tab (Status Filter)
    const [activeTab, setActiveTab] = useState('all');

    const lastFetchRef = React.useRef(0);
    const FETCH_COOLDOWN = 5 * 60 * 1000; // 5 minutos

    useEffect(() => {
        if (user) {
            const now = Date.now();
            if (now - lastFetchRef.current > FETCH_COOLDOWN) {
                fetchSupplierData();
            }
        }
    }, [user]);

    const fetchSupplierData = async (force = false) => {
        const now = Date.now();
        if (!force && now - lastFetchRef.current < FETCH_COOLDOWN && usinas.length > 0) {
            return;
        }

        setLoading(true);
        try {
            if (!user) return;
            lastFetchRef.current = now;

            // 1. Fetch Supplier - Try user_id first (safer), then email
            let { data: supplier, error: suppError } = await supabase
                .from('suppliers')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (!supplier && user.email) {
                // Fallback to email search
                const { data: byEmail, error: emailError } = await supabase
                    .from('suppliers')
                    .select('*')
                    .eq('email', user.email)
                    .limit(1)
                    .maybeSingle();

                if (byEmail) {
                    supplier = byEmail;
                    // Auto-link if user_id is missing
                    if (!byEmail.user_id) {
                        await supabase
                            .from('suppliers')
                            .update({ user_id: user.id })
                            .eq('id', byEmail.id);
                    }
                }
            }

            if (!supplier) {
                console.warn("Supplier record not found for user:", user.email);
                setLoading(false);
                return;
            }

            setSupplierData(supplier);

            // 3. Fetch Usinas linked to Supplier
            const { data: usinasData, error: usinasError } = await supabase
                .from('usinas')
                .select('*')
                .eq('supplier_id', supplier.id);

            if (usinasError) throw usinasError;

            // 4. For each Usina, fetch stats (UCs count, Generation)
            // This could be heavy, optimized with JOINs or counters later.
            const usinasWithStats = await Promise.all(usinasData.map(async (usina) => {
                // Count UCs
                const { count: ucCount } = await supabase
                    .from('consumer_units')
                    .select('*', { count: 'exact', head: true })
                    .eq('usina_id', usina.id);

                // Fetch Generation (Last Month explicitly)
                const today = new Date();
                const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

                const { data: genData } = await supabase
                    .from('generation_production')
                    .select('geracao_mensal_kwh, saldo_receber, mes_referencia')
                    .eq('usina_id', usina.id)
                    .gte('mes_referencia', lastMonthStart.toISOString().split('T')[0])
                    .lte('mes_referencia', lastMonthEnd.toISOString().split('T')[0])
                    .order('mes_referencia', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                // 2. Fetch UCs for this usina (Select all for robustness)
                const { data: ucs } = await supabase
                    .from('consumer_units')
                    .select('*')
                    .eq('usina_id', usina.id);

                const committedCapacity = ucs
                    ?.filter(uc => uc.status !== 'desconectado' && uc.status !== 'cancelado')
                    ?.reduce((acc, curr) => acc + (Number(curr.franquia) || 0), 0) || 0;

                const mainUG = ucs?.find(u => u.numero_uc === usina.unidade_geradora);

                let generation = Number(genData?.geracao_mensal_kwh) || 0;
                if (generation === 0 && mainUG) {
                    const { data: ugInvoice } = await supabase
                        .from('invoices')
                        .select('energia_injetada')
                        .eq('uc_id', mainUG.id)
                        .eq('mes_referencia', lastMonthStart.toISOString().split('T')[0])
                        .neq('status', 'cancelado')
                        .maybeSingle();
                    
                    if (ugInvoice?.energia_injetada) {
                        generation = Number(ugInvoice.energia_injetada);
                    }
                }

                const revenue = Number(genData?.saldo_receber) || 0;

                const ucIds = ucs?.map(u => u.id) || [];
                let consumption = 0;
                if (ucIds.length > 0) {
                    const { data: invData } = await supabase
                        .from('invoices')
                        .select('consumo_compensado')
                        .in('uc_id', ucIds)
                        .eq('mes_referencia', lastMonthStart.toISOString().split('T')[0])
                        .neq('status', 'cancelado');
                    
                    consumption = invData?.reduce((acc, inv) => acc + (Number(inv.consumo_compensado) || 0), 0) || 0;
                }

                // [UPDATED] Use Supplier Balance for consistency across dashboard cards
                const usinaLedger = await ledgerService.getSupplierBalance(supplier.id);
                const plantReceivable = usinaLedger.balance || 0;

                // Calculate Percentages based on ESTIMATED generation, matching PowerPlantModal.jsx
                const estimatedGen = Number(usina.geracao_estimada_kwh) || 0;
                const occupation = estimatedGen > 0 ? (committedCapacity / estimatedGen) * 100 : 0;
                const vacancy = Math.max(0, 100 - occupation);

                const diaLeitura = mainUG?.dia_leitura;
                let cycleString = 'Último Mês';
                
                const refMonthStr = genData?.mes_referencia || lastMonthStart.toISOString().split('T')[0];
                if (diaLeitura && refMonthStr) {
                    const [year, month] = refMonthStr.split('-').map(Number);
                    const day = parseInt(diaLeitura);
                    const endD = new Date(year, month - 1, day);
                    const startD = new Date(year, month - 2, day + 1);
                    cycleString = `${startD.toLocaleDateString('pt-BR')} a ${endD.toLocaleDateString('pt-BR')}`;
                }

                return {
                    ...usina,
                    ucCount: ucs?.length || 0,
                    generation,
                    estimatedGen,
                    consumption,
                    committedCapacity,
                    plantReceivable,
                    occupation,
                    vacancy,
                    cycleString
                };
            }));

            // 5. Aggregate Global Stats
            const totalUsinas = usinasWithStats.length;
            const totalUCs = usinasWithStats.reduce((acc, curr) => acc + curr.ucCount, 0);
            const totalGeneration = usinasWithStats.reduce((acc, curr) => acc + curr.generation, 0);

            // [NEW] Fetch Ledger Balance (Receivable)
            const ledgerAccount = await ledgerService.getSupplierBalance(supplier.id);
            const totalReceivable = ledgerAccount.balance || 0;

            setUsinas(usinasWithStats);
            setStats({ totalUsinas, totalUCs, totalGeneration, totalReceivable });

        } catch (err) {
            console.error("Error fetching supplier data:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenInvoices = (usina) => {
        setSelectedUsina(usina);
        setShowInvoicesModal(true);
    };

    const handleOpenPerformance = (usina) => {
        setSelectedUsina(usina);
        setShowAnalyticsModal(true);
    };

    const handleOpenUCs = (usina) => { // [NEW]
        setSelectedUsina(usina);
        setShowUCsModal(true);
    };

    const handleOpenLedger = (usina) => {
        setSelectedUsina(usina);
        setShowLedgerModal(true);
    };

    const handleLogout = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    // Filter Logic
    const filteredUsinas = activeTab === 'all'
        ? usinas
        : usinas.filter(u => {
            const s = u.status?.toLowerCase() || '';
            if (activeTab === 'active') return s.includes('ativa') || s.includes('ativo') || s.includes('operacao');
            if (activeTab === 'generating') return s.includes('gerando');
            if (activeTab === 'maintenance') return s.includes('manuten');
            return false;
        });

    return (
        <div className="supplier-dashboard">
            <div className="dashboard-container">
                <div className="profile-header">
                    <div className="profile-info">
                        <div className="profile-avatar">
                            <Factory size={32} />
                        </div>
                        <div className="profile-details">
                            <h1>Olá, {supplierData?.name || 'Parceiro'}!</h1>
                            <p>Visão geral de suas usinas e geração de energia.</p>
                        </div>
                    </div>
                    <div className="header-actions-main">
                        <button className="profile-btn" onClick={() => setShowProfileModal(true)}>
                            <User size={18} />
                            <span>Meu Perfil</span>
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Carregando dados da usina...</p>
                    </div>
                ) : (
                    <motion.div
                        className="dashboard-content"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                    >
                        {/* KPIs */}
                        <div className="kpi-grid">
                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <KPICard
                                    title="Total a Receber"
                                    value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalReceivable)}
                                    icon={Coins}
                                    onClick={() => {
                                        setSelectedUsina(null);
                                        setShowLedgerModal(true);
                                    }}
                                />
                            </motion.div>
                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <KPICard
                                    title="Total de Usinas"
                                    value={stats.totalUsinas}
                                    icon={Factory}
                                    onClick={() => setShowPlantsModal(true)}
                                />
                            </motion.div>
                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <KPICard
                                    title="Total de UCs"
                                    value={stats.totalUCs}
                                    icon={Users}
                                    onClick={() => {
                                        setSelectedUsina(null);
                                        setShowUCsModal(true);
                                    }}
                                />
                            </motion.div>
                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <KPICard
                                    title="Geração (Último Mês)"
                                    value={`${new Intl.NumberFormat('pt-BR').format(stats.totalGeneration)} kWh`}
                                    icon={Zap}
                                />
                            </motion.div>
                        </div>

                        {/* Filters & Grid */}
                        <section className="usinas-section">
                            <div className="section-header-row">
                                <h2>Suas Usinas</h2>
                                <div className="status-tabs">
                                    {[
                                        { id: 'all', label: 'Todas' },
                                        { id: 'active', label: 'Ativas' },
                                        { id: 'generating', label: 'Gerando' },
                                        { id: 'maintenance', label: 'Manutenção' }
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            className={`tab-pill ${activeTab === tab.id ? 'active' : ''}`}
                                            onClick={() => setActiveTab(tab.id)}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    className="plants-grid"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {filteredUsinas.length > 0 ? (
                                        filteredUsinas.map(usina => (
                                            <motion.div key={usina.id} whileHover={{ y: -5 }}>
                                                <PlantCard
                                                    usina={usina}
                                                    onOpenGraphs={handleOpenPerformance}
                                                    onOpenInvoices={handleOpenInvoices}
                                                    onOpenUCs={() => handleOpenUCs(usina)}
                                                    onOpenLedger={handleOpenLedger}
                                                />
                                            </motion.div>
                                        ))
                                    ) : (
                                        <div className="no-data-full">
                                            <p>Nenhuma usina encontrada com este status.</p>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </section>
                    </motion.div>
                )}
            </div>

            <ThemeToggle />

            {/* Modals */}
            <PlantInvoicesModal
                isOpen={showInvoicesModal}
                onClose={() => setShowInvoicesModal(false)}
                usina={selectedUsina}
            />

            <PlantAnalyticsModal
                isOpen={showAnalyticsModal}
                onClose={() => setShowAnalyticsModal(false)}
                usina={selectedUsina}
            />

            <SupplierPlantsModal
                isOpen={showPlantsModal}
                onClose={() => setShowPlantsModal(false)}
                usinas={usinas}
            />

            <SupplierUCsModal
                isOpen={showUCsModal}
                onClose={() => setShowUCsModal(false)}
                usinaIds={selectedUsina ? [selectedUsina.id] : (usinas || []).map(u => u.id)}
            />

            <SupplierProfileModal
                isOpen={showProfileModal}
                onClose={() => setShowProfileModal(false)}
                supplier={supplierData}
            />

            <PlantLedgerModal 
                isOpen={showLedgerModal}
                onClose={() => setShowLedgerModal(false)}
                usina={selectedUsina}
                supplier={supplierData}
            />

            <button className="logout-btn" onClick={handleLogout} title="Sair do Sistema">
                <LogOut size={20} />
                <span>Sair</span>
            </button>
        </div>
    );
};

export default SupplierDashboard;
