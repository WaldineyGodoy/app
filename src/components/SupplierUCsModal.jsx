import React, { useState, useEffect } from 'react';
import { X, Search, Filter, Eye, Zap, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import UCDetailsModal from './UCDetailsModal';
import './SupplierUCsModal.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

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
                            const generation = usinaData?.geracao_estimada_kwh || 1000; // Correct field name
                            const percent = generation > 0 ? ((Number(uc.franquia) / generation) * 100).toFixed(2) : 0;

                            const statusMap = {
                                ativo: { label: 'Ativa', class: 'bg-success' },
                                em_ativacao: { label: 'Em Ativação', class: 'bg-info text-dark' },
                                aguardando_conexao: { label: 'Aguardando Conexão', class: 'bg-warning text-dark' },
                                em_atraso: { label: 'Em Atraso', class: 'bg-danger' },
                                cancelado: { label: 'Cancelada', class: 'bg-secondary' }
                            };
                            const statusInfo = statusMap[uc.status] || { label: uc.status, class: 'bg-light text-dark' };

                            return (
                                <div key={uc.id} className="uc-item-card">
                                    <div className="uc-index-circle">
                                        <span>{index + 1}</span>
                                    </div>
                                    <div className="uc-card-content">
                                        <div className="uc-card-main">
                                            <div className="uc-info-primary">
                                                <h4 className="uc-number">
                                                    {uc.numero_uc}
                                                    <span className={`uc-badge type-${uc.tipo_unidade === 'geradora' ? 'generator' : 'beneficiary'}`}>
                                                        {uc.tipo_unidade || 'Beneficiária'}
                                                    </span>
                                                    <span className={`uc-badge status-${uc.status}`}>
                                                        {statusInfo.label}
                                                    </span>
                                                </h4>
                                                <div className="uc-usina-name">{(uc.usina || uc.usinas)?.name}</div>
                                                <div className="uc-titular">
                                                    <User size={14} />
                                                    <span>{uc.titular_conta || (uc.subscriber || uc.subscribers)?.name}</span>
                                                </div>
                                                <div className="uc-document">{(uc.subscriber || uc.subscribers)?.cpf_cnpj || uc.cpf_cnpj_fatura || '---'}</div>
                                            </div>
                                            <div className="uc-stats-secondary">
                                                <div className="stat-block">
                                                    <span className="stat-label">Concessionária</span>
                                                    <span className="stat-value">{uc.concessionaria || 'Neoenergia'}</span>
                                                </div>
                                                <div className="stat-block">
                                                    <span className="stat-label">Franquia</span>
                                                    <span className="stat-value">{formatNumber(uc.franquia)} kWh</span>
                                                </div>
                                                <div className="stat-block">
                                                    <span className="stat-label">Participação</span>
                                                    <span className="stat-value">{generation > 0 ? ((Number(uc.franquia) / generation) * 100).toFixed(2) : '0.00'}%</span>
                                                </div>
                                                <div className="stat-block">
                                                    <span className="stat-label">Saldo Rem.</span>
                                                    <span className="stat-value">{uc.saldo_remanescente ? 'Sim' : 'Não'}</span>
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                    <button
                                        className="uc-view-btn"
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
                <UCDetailsModal
                    uc={selectedUcDetails}
                    onClose={() => setSelectedUcDetails(null)}
                />
            )}
        </div>
    );
};

export default SupplierUCsModal;
