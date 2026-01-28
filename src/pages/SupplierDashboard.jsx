import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import KPICard from '../components/KPICard';
import PlantCard from '../components/PlantCard';
import PlantInvoicesModal from '../components/PlantInvoicesModal';
import PlantAnalyticsModal from '../components/PlantAnalyticsModal';
import { Factory, Zap, Users } from 'lucide-react';
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
        totalGeneration: 0
    });

    // Modal States
    const [invoicesModalOpen, setInvoicesModalOpen] = useState(false);
    const [performanceModalOpen, setPerformanceModalOpen] = useState(false);
    const [selectedUsina, setSelectedUsina] = useState(null);

    // Active Tab (Status Filter)
    const [activeTab, setActiveTab] = useState('all');

    useEffect(() => {
        if (!authLoading && user) {
            fetchSupplierData();
        }
    }, [user, authLoading]);

    const fetchSupplierData = async () => {
        setLoading(true);
        try {
            if (!user?.email) return;

            // 2. Fetch Supplier
            const { data: supplier, error: suppError } = await supabase
                .from('suppliers')
                .select('id, name')
                .eq('email', user.email)
                .single();

            if (suppError) throw suppError;
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

            setUsinas(usinasWithStats);
            setStats({ totalUsinas, totalUCs, totalGeneration });

        } catch (err) {
            console.error("Error fetching supplier data:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenInvoices = (usina) => {
        setSelectedUsina(usina);
        setInvoicesModalOpen(true);
    };

    const handleOpenPerformance = (usina) => {
        setSelectedUsina(usina);
        setPerformanceModalOpen(true);
    };

    // Filter Logic
    const filteredUsinas = activeTab === 'all'
        ? usinas
        : usinas.filter(u => u.status?.toLowerCase().includes(activeTab.toLowerCase()));

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
                        <KPICard title="Total de Usinas" value={stats.totalUsinas} icon={Factory} />
                        <KPICard title="Total de UCs" value={stats.totalUCs} icon={Users} />
                        <KPICard title="Geração (Último Mês)" value={`${new Intl.NumberFormat('pt-BR').format(stats.totalGeneration)} kWh`} icon={Zap} />
                    </div>

                    {/* Filters & Grid */}
                    <section className="usinas-section">
                        <div className="section-header-row">
                            <h2>Suas Usinas</h2>
                            <div className="status-tabs">
                                {['All', 'Active', 'Maintenance'].map(tab => (
                                    <button
                                        key={tab}
                                        className={`tab-pill ${activeTab === tab.toLowerCase() ? 'active' : ''}`}
                                        onClick={() => setActiveTab(tab.toLowerCase())}
                                    >
                                        {tab === 'All' ? 'Todas' : tab === 'Active' ? 'Ativas' : 'Manutenção'}
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
                isOpen={invoicesModalOpen}
                onClose={() => setInvoicesModalOpen(false)}
                usina={selectedUsina}
            />

            <PlantAnalyticsModal
                isOpen={performanceModalOpen}
                onClose={() => setPerformanceModalOpen(false)}
                usina={selectedUsina}
            />
        </div>
    );
};

export default SupplierDashboard;
