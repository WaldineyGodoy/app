import React, { useState, useEffect } from 'react';
import { X, Search, Filter, Eye, Zap, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ConsumerUnitModal from './ConsumerUnitModal';
import './SupplierUCsModal.css';

const SupplierUCsModal = ({ isOpen, onClose, usinaIds }) => {
    const [ucs, setUcs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedUcDetails, setSelectedUcDetails] = useState(null);

    const formatNumber = (val) => {
        if (!val && val !== 0) return '0';
        return Number(val).toLocaleString('pt-BR');
    };

    useEffect(() => {
        if (isOpen && usinaIds?.length > 0) {
            fetchUCs();
        }
    }, [isOpen, usinaIds]);

    const fetchUCs = async () => {
        if (!usinaIds || usinaIds.length === 0) {
            setUcs([]);
            return;
        }

        setLoading(true);
        try {
            // Simplify query to avoid join errors if relationship names differ
            const { data, error } = await supabase
                .from('consumer_units')
                .select(`
                    *,
                    usina:usina_id (name, geracao_estimada_kwh),
                    subscriber:subscriber_id (name, email, cpf_cnpj)
                `)
                .in('usina_id', usinaIds)
                .order('prioridade', { ascending: true });

            if (error) {
                console.warn("Retrying fetch with fallback relationship names...");
                // Fallback attempt with standard plural names if first one fails
                const { data: retryData, error: retryError } = await supabase
                    .from('consumer_units')
                    .select(`
                        *,
                        usinas (name, geracao_estimada_kwh),
                        subscribers (name, email, cpf_cnpj)
                    `)
                    .in('usina_id', usinaIds)
                    .order('prioridade', { ascending: true });

                if (retryError) throw retryError;
                setUcs(retryData || []);
            } else {
                setUcs(data || []);
            }
        } catch (error) {
            console.error("Error fetching supplier UCs:", error);
            // Last resort: fetch just the records without joins
            try {
                const { data: simpleData } = await supabase
                    .from('consumer_units')
                    .select('*')
                    .in('usina_id', usinaIds);
                setUcs(simpleData || []);
            } catch (inner) {
                setUcs([]);
            }
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const filteredUcs = ucs.filter(uc => {
        const subscriber = uc.subscriber || uc.subscribers;
        const matchesSearch =
            uc.numero_uc?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            subscriber?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            uc.titular_conta?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || uc.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content ucs-list-modal" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    <X size={24} />
                </button>

                <header className="modal-header">
                    <div className="header-title">
                        <h2>Unidades Consumidoras</h2>
                        <span className="count-badge">{ucs.length} totais</span>
                    </div>

                    <div className="header-actions">
                        <div className="search-bar">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Buscar por nome, UC ou titular..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="filter-select">
                            <Filter size={18} />
                            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                                <option value="all">Todos os Status</option>
                                <option value="ativo">Ativas</option>
                                <option value="em_ativacao">Em Ativação</option>
                                <option value="aguardando_conexao">Aguardando Conexão</option>
                                <option value="em_atraso">Em Atraso</option>
                                <option value="cancelado">Canceladas</option>
                            </select>
                        </div>
                    </div>
                </header>

                <div className="ucs-list">
                    {loading ? (
                        <div className="modal-loading">
                            <div className="spinner-border text-primary"></div>
                            <p>Carregando unidades...</p>
                        </div>
                    ) : filteredUcs.length > 0 ? (
                        filteredUcs.map((uc, index) => {
                            const usinaData = uc.usina || uc.usinas;
                            const generation = usinaData?.geracao_referencia || 1000; // Fallback
                            const percent = generation > 0 ? ((Number(uc.franquia) / generation) * 100).toFixed(2) : 0;

                            return (
                                <div key={uc.id} className="uc-item-card d-flex align-items-center mb-3 p-3 border rounded shadow-sm">
                                    <div className="uc-index-circle me-3">
                                        <span>{index + 1}</span>
                                    </div>
                                    <div className="flex-grow-1">
                                        <div className="d-flex justify-content-between align-items-start">
                                            <div>
                                                <h4 className="h6 mb-1 fw-bold">
                                                    {uc.numero_uc}
                                                    <span className={`badge ${uc.tipo_unidade === 'geradora' ? 'bg-warning text-dark' : 'bg-info text-dark'} small ms-2`} style={{ fontSize: '0.65rem', textTransform: 'capitalize' }}>
                                                        {uc.tipo_unidade || 'Beneficiária'}
                                                    </span>
                                                </h4>
                                                <div className="small text-muted mb-1">{(uc.usina || uc.usinas)?.name}</div>
                                                <div className="small fw-semibold mt-1">Titular: <span className="text-dark">{uc.titular_conta || (uc.subscriber || uc.subscribers)?.name}</span></div>
                                                <div className="small text-muted">CPF/CNPJ: {(uc.subscriber || uc.subscribers)?.cpf_cnpj || uc.cpf_cnpj_fatura || '---'}</div>
                                            </div>
                                            <div className="text-end">
                                                <div className="small text-muted">{uc.concessionaria || 'Neoenergia Cosern'}</div>
                                                <div className="h5 mb-0 fw-bold text-success">{formatNumber(uc.franquia)} kWh</div>
                                                <div className="small fw-bold text-success">{generation > 0 ? ((Number(uc.franquia) / generation) * 100).toFixed(2) : '0.00'}%</div>
                                                <div className="small text-muted" style={{ fontSize: '0.7rem' }}>Saldo R.: {uc.saldo_remanescente ? 'Sim' : 'Não'}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        className="action-icon-btn ms-3"
                                        title="Ver Detalhes"
                                        onClick={() => setSelectedUcDetails(uc)}
                                    >
                                        <Eye size={20} />
                                    </button>
                                </div>
                            );
                        })
                    ) : (
                        <div className="empty-state text-center py-5 text-muted">
                            <p>Nenhuma unidade consumidora encontrada.</p>
                        </div>
                    )}
                </div>
            </div>

            {selectedUcDetails && (
                <ConsumerUnitModal
                    consumerUnit={selectedUcDetails}
                    onClose={() => setSelectedUcDetails(null)}
                    onSave={() => {
                        fetchUCs();
                        setSelectedUcDetails(null);
                    }}
                />
            )}
        </div>
    );
};

export default SupplierUCsModal;
