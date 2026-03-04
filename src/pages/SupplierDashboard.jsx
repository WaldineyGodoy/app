import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ledgerService } from '../services/ledgerService'; // [NEW] Ledger Service
import KPICard from '../components/KPICard';
import PlantCard from '../components/PlantCard';
import PlantInvoicesModal from '../components/PlantInvoicesModal';
import PlantAnalyticsModal from '../components/PlantAnalyticsModal';
import SupplierPlantsModal from '../components/SupplierPlantsModal';
import SupplierUCsModal from '../components/SupplierUCsModal';
import { Factory, Zap, Users, Coins, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './SupplierDashboard.css';

import { useAuth } from '../contexts/AuthContext';

const SupplierDashboard = () => {
    const { user, signOut, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [supplierName, setSupplierName] = useState('');
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

    // Active Tab (Status Filter)
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        if (user) {
            fetchSupplierData();
        }
    }, [user]);

    const fetchSupplierData = async () => {
        setLoading(true);
        try {
            if (!user) return;

            // 1. Fetch Supplier - Try user_id first (safer), then email
            let { data: supplier, error: suppError } = await supabase
                .from('suppliers')
                .select('id, name, user_id')
                .eq('user_id', user.id)
                .maybeSingle();

            if (!supplier && user.email) {
                // Fallback to email search
                const { data: byEmail, error: emailError } = await supabase
                    .from('suppliers')
                    .select('id, name, user_id')
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

            setSupplierName(supplier.name);

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

                // Fetch Generation (Latest)
                // Assuming 'generation_production' has 'usina_id' and 'geracao_mensal_kwh'
                const { data: genData } = await supabase
                    .from('generation_production')
                    .select('geracao_mensal_kwh')
                    .eq('usina_id', usina.id)
                    .order('fechamento', { ascending: false }) // Assuming date column
                    .limit(1)
                    .maybeSingle();

                const generation = genData?.geracao_mensal_kwh || 0;

                // 2. Fetch Invoices for this month to calculate "Valor a Receber"
                const now = new Date();
                const startOfMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`;
                const endOfMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-31`;

                const { data: ucs, error: ucsError } = await supabase
                    .from('consumer_units')
                    .select('id, consumo_kwh, franquia')
                    .eq('usina_id', usina.id);

                const ucIds = ucs?.map(uc => uc.id) || [];
                let plantReceivable = 0;

                if (ucIds.length > 0) {
                    const { data: invData } = await supabase
                        .from('invoices')
                        .select('valor_a_pagar')
                        .in('uc_id', ucIds)
                        .gte('mes_referencia', startOfMonth)
                        .lte('mes_referencia', endOfMonth);

                    plantReceivable = invData?.reduce((acc, curr) => acc + (Number(curr.valor_a_pagar) || 0), 0) || 0;
                }

                const kwhConsumption = ucs?.reduce((acc, curr) => acc + (Number(curr.consumo_kwh) || 0), 0) || 0;
                const committedCapacity = ucs?.reduce((acc, curr) => acc + (Number(curr.franquia) || 0), 0) || 0;

                // Calculate Percentages
                const estimatedGen = Number(usina.geracao_estimada_kwh) || 12461; // Fallback or use real field
                const occupation = estimatedGen > 0 ? (committedCapacity / estimatedGen) * 100 : 0;
                const vacancy = 100 - occupation;

                return {
                    ...usina,
                    ucCount: ucCount || 0,
                    generation: Number(generation),
                    kwhConsumption,
                    committedCapacity,
                    plantReceivable,
                    occupation,
                    vacancy
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
            <motion.header
                className="dashboard-header"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <div className="header-content container">
                    <h1>Olá, {supplierName || 'Parceiro'}!</h1>
                    <p>Visão geral de suas usinas e geração.</p>
                </div>
            </motion.header>

            {loading ? (
                <div className="loading-state">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Carregando...</span>
                    </div>
                </div>
            ) : (
                <motion.div
                    className="dashboard-content container"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    {/* KPIs */}
                    <div className="row g-4 mb-5">
                        <div className="col-12 col-md-6 col-lg-3">
                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <KPICard
                                    title="Total a Receber"
                                    value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalReceivable)}
                                    icon={Coins}
                                />
                            </motion.div>
                        </div>
                        <div className="col-12 col-md-6 col-lg-3">
                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <KPICard
                                    title="Total de Usinas"
                                    value={stats.totalUsinas}
                                    icon={Factory}
                                    onClick={() => setShowPlantsModal(true)}
                                />
                            </motion.div>
                        </div>
                        <div className="col-12 col-md-6 col-lg-3">
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
                        </div>
                        <div className="col-12 col-md-6 col-lg-3">
                            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <KPICard
                                    title="Geração (Último Mês)"
                                    value={`${new Intl.NumberFormat('pt-BR').format(stats.totalGeneration)} kWh`}
                                    icon={Zap}
                                />
                            </motion.div>
                        </div>
                    </div>

                    {/* Filters & Grid */}
                    <section className="usinas-section">
                        <div className="section-header-row mb-4">
                            <h2>Suas Usinas</h2>
                            <div className="status-tabs btn-group" role="group">
                                {[
                                    { id: 'all', label: 'Todas' },
                                    { id: 'active', label: 'Ativas' },
                                    { id: 'generating', label: 'Gerando' },
                                    { id: 'maintenance', label: 'Manutenção' }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        className={`btn btn-outline-primary ${activeTab === tab.id ? 'active' : ''}`}
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
                                className="row g-4"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                            >
                                {filteredUsinas.length > 0 ? (
                                    filteredUsinas.map(usina => (
                                        <div key={usina.id} className="col-12 col-md-6 col-lg-4">
                                            <motion.div whileHover={{ y: -5 }}>
                                                <PlantCard
                                                    usina={usina}
                                                    onOpenGraphs={handleOpenPerformance}
                                                    onOpenInvoices={handleOpenInvoices}
                                                    onOpenUCs={() => handleOpenUCs(usina)} // [NEW]
                                                />
                                            </motion.div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-12">
                                        <p className="no-data alert alert-info text-center">Nenhuma usina encontrada com este status.</p>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </section>
                </motion.div>
            )}

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

            <button className="logout-btn" onClick={handleLogout} title="Sair do Sistema">
                <LogOut size={20} />
                <span>Sair</span>
            </button>
        </div>
    );
};

export default SupplierDashboard;
