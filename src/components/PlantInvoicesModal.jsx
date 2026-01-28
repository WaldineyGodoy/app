
import React, { useState, useEffect } from 'react';
import { X, FileText, Download } from 'lucide-react';
import './PlantInvoicesModal.css';
import { supabase } from '../lib/supabase'; // Assuming supabase client is configured here

const PlantInvoicesModal = ({ isOpen, onClose, usina }) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && usina) {
            fetchInvoices();
        }
    }, [isOpen, usina, selectedMonth]);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            // 1. Get UCs linked to this Usina
            const { data: ucs, error: ucsError } = await supabase
                .from('consumer_units')
                .select('id, numero_uc, subscriber_id')
                .eq('usina_id', usina.id);

            if (ucsError) throw ucsError;

            const ucIds = ucs.map(uc => uc.id);

            if (ucIds.length === 0) {
                setInvoices([]);
                setLoading(false);
                return;
            }

            // 2. Fetch Invoices for these UCs in the selected Month
            // Assuming 'mes_referencia' is YYYY-MM-DD
            const startOfMonth = `${selectedMonth}-01`;
            const endOfMonth = `${selectedMonth} -31`; // Loose match is fine for YYYY-MM filter usually, or use start/end logic

            const { data: invData, error: invError } = await supabase
                .from('invoices')
                .select('*, consumer_units(numero_uc, subscribers(name))') // JOIN to get UC Number and Client Name
                .in('uc_id', ucIds)
                .gte('mes_referencia', startOfMonth)
                .lte('mes_referencia', endOfMonth);

            if (invError) throw invError;

            setInvoices(invData || []);

        } catch (error) {
            console.error("Error fetching plant invoices:", error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !usina) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content invoices-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>
                    <X size={24} />
                </button>

                <header className="invoices-header">
                    <div>
                        <h2>Faturamento</h2>
                        <p>Usina: {usina.name}</p>
                    </div>

                    <div className="month-selector">
                        <label>Mês de Referência:</label>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        />
                    </div>
                </header>

                <div className="invoices-list-container">
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center' }}>Carregando...</div>
                    ) : (
                        <table className="invoices-table">
                            <thead>
                                <tr>
                                    <th>UC</th>
                                    <th>Cliente</th>
                                    <th>Valor</th>
                                    <th>Status</th>
                                    <th align="right">Ação</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoices.length > 0 ? (
                                    invoices.map(inv => (
                                        <tr key={inv.id}>
                                            <td>{inv.consumer_units?.numero_uc || 'N/A'}</td>
                                            <td>{inv.consumer_units?.subscribers?.name || 'Cliente'}</td>
                                            <td className="value-col">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inv.valor_a_pagar)}
                                            </td>
                                            <td>
                                                <span className={`status - badge ${inv.status === 'paid' ? 'green' : 'yellow'} `}>
                                                    {inv.status || 'Pendente'}
                                                </span>
                                            </td>
                                            <td align="right">
                                                {inv.asaas_boleto_url ? (
                                                    <a href={inv.asaas_boleto_url} target="_blank" rel="noopener noreferrer" className="download-btn" title="Baixar Fatura">
                                                        <Download size={16} />
                                                    </a>
                                                ) : (
                                                    <span style={{ color: '#ccc' }}>-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>Nenhuma fatura encontrada.</td>
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

export default PlantInvoicesModal;
