import React, { useState, useEffect } from 'react';
import { X, Search, Filter, FileText, Zap, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './SupplierUCsModal.css';

const SupplierUCsModal = ({ isOpen, onClose, usinaIds }) => {
    const [ucs, setUcs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        if (isOpen && usinaIds?.length > 0) {
            fetchUCs();
        }
    }, [isOpen, usinaIds]);

    const fetchUCs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('consumer_units')
                .select(`
                    *,
                    usinas (name),
                    subscribers (name, email)
                `)
                .in('usina_id', usinaIds);

            if (error) throw error;
            setUcs(data || []);
        } catch (error) {
            console.error("Error fetching supplier UCs:", error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const filteredUcs = ucs.filter(uc => {
        const matchesSearch =
            uc.numero_uc?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            uc.subscribers?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

                <div className="table-container">
                    {loading ? (
                        <div className="modal-loading">
                            <div className="spinner"></div>
                            <p>Carregando unidades...</p>
                        </div>
                    ) : (
                        <table className="ucs-table">
                            <thead>
                                <tr>
                                    <th><User size={16} /> CLIENTE</th>
                                    <th><Zap size={16} /> UC / USINA</th>
                                    <th>STATUS</th>
                                    <th>AÇÕES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUcs.length > 0 ? (
                                    filteredUcs.map(uc => (
                                        <tr key={uc.id}>
                                            <td>
                                                <div className="client-info">
                                                    <span className="client-name">{uc.subscribers?.name || uc.titular_conta}</span>
                                                    <span className="client-email">{uc.subscribers?.email || 'Sem e-mail'}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="uc-details">
                                                    <span className="uc-num">UC: {uc.numero_uc}</span>
                                                    <span className="usina-name">{uc.usinas?.name || 'Não vinculada'}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`status-pill ${uc.status}`}>
                                                    {uc.status?.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td>
                                                <button className="action-icon-btn" title="Ver Detalhes">
                                                    <FileText size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="empty-table">
                                            Nenhuma unidade consumidora encontrada.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SupplierUCsModal;
