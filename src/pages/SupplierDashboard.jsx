import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ledgerService } from '../services/ledgerService'; // [NEW] Ledger Service
import KPICard from '../components/KPICard';
import PlantCard from '../components/PlantCard';
import PlantInvoicesModal from '../components/PlantInvoicesModal';
import PlantAnalyticsModal from '../components/PlantAnalyticsModal';
import SupplierPlantsModal from '../components/SupplierPlantsModal';
import SupplierUCsModal from '../components/SupplierUCsModal';
import { Factory, Zap, Users, Coins } from 'lucide-react';
import './SupplierDashboard.css';

import { useAuth } from '../contexts/AuthContext';

const SupplierDashboard = () => {
    const { user, loading: authLoading } = useAuth();
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

                // Fetch Consumption of linked UCs (Optional for "Consumo das UCs vinculadas")
                // Mocking or Summing 'consumo' from UCs if available
                const { data: ucs } = await supabase
                    .from('consumer_units')
                    .select('consumo_kwh') // Assuming column
                    .eq('usina_id', usina.id);

                const kwhConsumption = ucs?.reduce((acc, curr) => acc + (Number(curr.consumo_kwh) || 0), 0) || 0;

                return {
                    ...usina,
                    ucCount: ucCount || 0,
                    generation: Number(generation),
                    kwhConsumption
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
            <header className="dashboard-header">
                <div className="header-content">
                    <h1>Olá, {supplierName || 'Parceiro'}!</h1>
                    <p>Visão geral de suas usinas e geração.</p>
                </div>
            </header>

            {loading ? (
                <div className="loading-state">
                    <div className="spinner"></div>
                </div>
            ) : (
                <div className="dashboard-content">
                    {/* KPIs */}
                    <div className="kpi-grid">
                        <KPICard
                            title="Total a Receber"
                            value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalReceivable)}
                            icon={Coins}
                        />
                        <KPICard
                            title="Total de Usinas"
                            value={stats.totalUsinas}
                            icon={Factory}
                            onClick={() => setShowPlantsModal(true)}
                        />
                        <KPICard
                            title="Total de UCs"
                            value={stats.totalUCs}
                            icon={Users}
                            onClick={() => setShowUCsModal(true)}
                        />
                        <KPICard
                            title="Geração (Último Mês)"
                            value={`${new Intl.NumberFormat('pt-BR').format(stats.totalGeneration)} kWh`}
                            icon={Zap}
                        />
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

                        <div className="usinas-grid">
                            {filteredUsinas.length > 0 ? (
                                filteredUsinas.map(usina => (
                                    <PlantCard
                                        key={usina.id}
                                        usina={usina}
                                        onOpenGraphs={handleOpenPerformance}
                                        onOpenInvoices={handleOpenInvoices}
                                    />
                                ))
                            ) : (
                                <p className="no-data">Nenhuma usina encontrada com este status.</p>
                            )}
                        </div>
                    </section>
                </div>
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
                usinaIds={usinas.map(u => u.id)}
            />
        </div>
    );
};

export default SupplierDashboard;
