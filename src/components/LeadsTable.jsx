import React, { useState } from 'react';
import { Edit2, Trash2, Heart, Search, Filter, Plus } from 'lucide-react';
import './LeadsTable.css';

const LeadsTable = ({ leads, onAddLead, onEditLead, onDeleteLead, onToggleFavorite }) => {
    const [activeTab, setActiveTab] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Tabs configuration
    const tabs = [
        { id: 'all', label: 'Todos' },
        { id: 'simulation', label: 'Simulação' },
        { id: 'indicated', label: 'Indicado' },
        { id: 'negotiation', label: 'Em negociação' },
        { id: 'lost', label: 'Negocio Perdido' },
        { id: 'active', label: 'Ativo' }, // Converted/Subscriber
        { id: 'paid', label: 'Pago' },
    ];

    // Filter Logic
    const filteredLeads = leads.filter(lead => {
        const s = lead.status?.toLowerCase() || '';

        // Status Filter Logic (Mapping UI tabs to DB statuses)
        const statusMatch = activeTab === 'all' ||
            (activeTab === 'simulation' && (s.includes('simul') || s.includes('new'))) ||
            (activeTab === 'indicated' && (s.includes('indic') || s.includes('lead'))) ||
            (activeTab === 'negotiation' && (s.includes('negoc') || s.includes('analy'))) ||
            (activeTab === 'lost' && (s.includes('lost') || s.includes('perdido'))) ||
            (activeTab === 'active' && (s.includes('active') || s.includes('ativo') || s.includes('won'))) ||
            (activeTab === 'paid' && (s.includes('paid') || s.includes('pago')));

        // Search Filter
        const searchMatch = lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            lead.email?.toLowerCase().includes(searchTerm.toLowerCase());

        return statusMatch && searchMatch;
    });

    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

    const getStatusBadge = (status) => {
        let colorClass = 'gray';
        const s = status?.toLowerCase() || '';
        if (s.includes('won') || s.includes('ativo') || s.includes('active')) colorClass = 'green';
        else if (s.includes('pago') || s.includes('paid')) colorClass = 'emerald';
        else if (s.includes('lost') || s.includes('perdido')) colorClass = 'red';
        else if (s.includes('negocia') || s.includes('negotiation')) colorClass = 'blue';
        else if (s.includes('simul') || s.includes('new') || s.includes('convite')) colorClass = 'orange';

        return <span className={`lead-status ${colorClass}`}>{status || 'Novo'}</span>;
    };

    return (
        <div className="leads-table-container">
            {/* Toolbar */}
            <div className="table-toolbar">
                <div className="tabs-list">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="actions-row">
                    <div className="search-box">
                        <Search size={18} color="#95a5a6" />
                        <input
                            type="text"
                            placeholder="Buscar leads..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {/* Add Lead Button could go here or floating above */}
                    <button className="add-lead-btn" onClick={onAddLead}>
                        <Plus size={18} />
                        <span>Novo Lead</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Email</th>
                            <th>Telefone</th>
                            <th>Valor a Receber (Est.)</th>
                            <th>Status. Lead</th>
                            <th align="right">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLeads.length > 0 ? (
                            filteredLeads.map(lead => (
                                <tr key={lead.id}>
                                    <td>
                                        <div className="lead-name-cell">
                                            {/* Avatar Placeholder */}
                                            <div className="avatar-circle">{lead.name ? lead.name.charAt(0) : '?'}</div>
                                            <span>{lead.name}</span>
                                        </div>
                                    </td>
                                    <td>{lead.email}</td>
                                    <td>{lead.phone}</td>
                                    <td className="value-cell">{formatCurrency(lead.estimated_bill_value)}</td>
                                    <td>{getStatusBadge(lead.status)}</td>
                                    <td>
                                        <div className="row-actions">
                                            <button className="icon-action" title="Favoritar" onClick={() => onToggleFavorite(lead.id)}>
                                                <Heart size={16} color={lead.isFavorite ? 'red' : '#95a5a6'} fill={lead.isFavorite ? 'red' : 'none'} />
                                            </button>
                                            <button className="icon-action" title="Editar" onClick={() => onEditLead(lead)}>
                                                <Edit2 size={16} />
                                            </button>
                                            <button className="icon-action delete" title="Excluir" onClick={() => onDeleteLead(lead.id)}>
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" className="empty-row">Lead não encontrado.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default LeadsTable;
