import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { 
    Wallet, X, Search, ArrowUpDown, ArrowUpRight, ArrowDownLeft, Copy, Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PlantLedgerModal({ isOpen, onClose, usina, supplier }) {
    const { profile } = useAuth();
    const { showAlert, showConfirm } = useUI();
    const [ledgerEntries, setLedgerEntries] = useState([]);
    const [ledgerLoading, setLedgerLoading] = useState(false);
    const [expandedTx, setExpandedTx] = useState(null);
    const [txDetails, setTxDetails] = useState([]);
    const [txLoading, setTxLoading] = useState(false);
    const [paying, setPaying] = useState(false);
    
    // Payment Modal states
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState(0);
    const [isPartial, setIsPartial] = useState(false);

    useEffect(() => {
        if (isOpen && usina?.id) {
            fetchLedgerStatement();
        }
    }, [isOpen, usina]);

    const fetchLedgerStatement = async () => {
        if (!supplier?.id) return;
        setLedgerLoading(true);
        try {
            // [UPDATED] Use reference_id (supplier_id) and account 2.1.1 to match CRM logic
            const { data, error } = await supabase
                .from('view_ledger_enriched')
                .select('*')
                .eq('reference_id', supplier.id)
                .eq('account_code', '2.1.1')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLedgerEntries(data || []);
        } catch (err) {
            console.error('Erro ao buscar extrato:', err);
        } finally {
            setLedgerLoading(false);
        }
    };

    const fetchTransactionDetails = async (txId) => {
        if (expandedTx === txId) {
            setExpandedTx(null);
            return;
        }
        setExpandedTx(txId);
        setTxLoading(true);
        try {
            const { data, error } = await supabase
                .from('view_ledger_enriched')
                .select('*')
                .eq('transaction_id', txId);

            if (error) throw error;
            setTxDetails(data || []);
        } catch (err) {
            console.error('Erro ao buscar detalhes:', err);
        } finally {
            setTxLoading(false);
        }
    };

    const formatCurrency = (val) => {
        return Math.abs(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const ledgerBalance = ledgerEntries.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    const handlePayPix = async () => {
        if (!supplier?.id) return;
        
        const canPay = ['superadmin', 'admin', 'gerente'].includes(profile?.role);
        // Note: For the investor app, we might allow them to request rescue even if not admin of CRM,
        // but let's stick to the requested rule or allow 'supplier' role too.
        // If it's the Supplier App, the user is likely role='supplier'.
        
        if (ledgerBalance >= 0) {
            showAlert('Não há saldo disponível para resgate.', 'info');
            return;
        }

        if (!supplier.pix_key || !supplier.pix_key_type) {
            showAlert('Sua chave PIX não está cadastrada. Por favor, atualize seu perfil.', 'warning');
            return;
        }

        const absBalance = Math.abs(ledgerBalance);
        setPaymentAmount(absBalance);
        setIsPartial(false);
        setShowPaymentModal(true);
    };

    const confirmPixPayment = async () => {
        const amountToPay = Number(paymentAmount);
        const absBalance = Math.abs(ledgerBalance);

        if (amountToPay <= 0 || amountToPay > absBalance) {
            showAlert('Valor inválido.', 'warning');
            return;
        }

        setPaying(true);
        setShowPaymentModal(false);
        
        try {
            const { data, error } = await supabase.functions.invoke('transfer-asaas-pix', {
                body: {
                    value: amountToPay,
                    pix_key: supplier.pix_key,
                    pix_key_type: supplier.pix_key_type,
                    description: `Resgate Fornecedor: ${supplier.name} - Usina: ${usina.name}`,
                    operationType: 'PIX'
                }
            });

            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error);

            showAlert('Solicitação de resgate enviada com sucesso!', 'success');
            fetchLedgerStatement();
        } catch (err) {
            showAlert('Erro ao processar resgate: ' + err.message, 'error');
        } finally {
            setPaying(false);
        }
    };

    const translateEntity = (name) => {
        if (!name) return '';
        const map = {
            'SUPPLIER': 'Fornecedor',
            'INVOICE': 'Fatura',
            'MANAGEMENT': 'Gestão',
            'MAINTENANCE': 'Manutenção',
            'RENT': 'Aluguel',
            'TAX': 'Taxa',
            'SUBSCRIPTION': 'Assinatura',
            'ADJUSTMENT': 'Ajuste',
            'SUBSCRIBER': 'Assinante',
            'PLANT': 'Usina',
            'POWERPLANT': 'Usina'
        };
        return map[name.toUpperCase()] || name;
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
        }}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                style={{ 
                    background: '#f8fafc', 
                    borderRadius: '30px', 
                    width: '95%', 
                    maxWidth: '850px', 
                    maxHeight: '90vh', 
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }}
            >
                {/* Header */}
                <div style={{ 
                    padding: '1.5rem 2rem', 
                    background: 'white', 
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.5rem', fontWeight: 800 }}>Extrato Financeiro</h2>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>{usina.name}</p>
                    </div>
                    <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', padding: '0.5rem', borderRadius: '12px', cursor: 'pointer', color: '#64748b' }}>
                        <X size={24} />
                    </button>
                </div>

                <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
                    {/* Balance Card */}
                    <div style={{ 
                        background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)', 
                        padding: '2rem',
                        borderRadius: '24px',
                        color: 'white',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '2.5rem',
                        boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)'
                    }}>
                        <div>
                            <div style={{ fontSize: '0.9rem', opacity: 0.9, fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Coins size={16} /> Saldo Disponível
                            </div>
                            <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>{formatCurrency(ledgerBalance)}</div>
                        </div>
                        <button 
                            type="button"
                            onClick={handlePayPix}
                            disabled={paying || ledgerBalance >= 0}
                            style={{ 
                                background: 'white', 
                                padding: '1rem 2rem', 
                                borderRadius: '20px',
                                border: 'none',
                                color: '#1d4ed8',
                                fontWeight: '800',
                                fontSize: '1rem',
                                cursor: (paying || ledgerBalance >= 0) ? 'not-allowed' : 'pointer',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                opacity: (paying || ledgerBalance >= 0) ? 0.7 : 1,
                                transition: 'transform 0.2s'
                            }}
                        >
                            <Wallet size={20} />
                            {paying ? 'Processando...' : 'Resgatar Agora'}
                        </button>
                    </div>

                    {/* Transactions List */}
                    <div style={{ background: 'white', borderRadius: '24px', padding: '2rem', border: '1px solid #e2e8f0' }}>
                        <h4 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b' }}>
                            <Search size={20} color="#3b82f6" /> Lançamentos Recentes
                        </h4>
                        
                        {ledgerLoading ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Carregando extrato...</div>
                        ) : ledgerEntries.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', border: '1px dashed #e2e8f0', borderRadius: '16px' }}>
                                Nenhum lançamento encontrado para esta usina.
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #f1f5f9', textAlign: 'left' }}>
                                            <th style={{ padding: '1rem 0.5rem', color: '#64748b' }}>Data</th>
                                            <th style={{ padding: '1rem 0.5rem', color: '#64748b' }}>Entidade</th>
                                            <th style={{ padding: '1rem 0.5rem', color: '#64748b' }}>Descrição</th>
                                            <th style={{ padding: '1rem 0.5rem', color: '#64748b', textAlign: 'right' }}>Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ledgerEntries.map(entry => {
                                            const isRevenue = entry.amount < 0;
                                            return (
                                                <React.Fragment key={entry.id}>
                                                    <tr 
                                                        onClick={() => fetchTransactionDetails(entry.transaction_id)}
                                                        style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                                                    >
                                                        <td style={{ padding: '1.25rem 0.5rem', whiteSpace: 'nowrap' }}>
                                                            <div style={{ color: '#64748b' }}>{formatDate(entry.created_at)}</div>
                                                        </td>
                                                        <td style={{ padding: '1.25rem 0.5rem' }}>
                                                            <div style={{ fontWeight: '600', color: '#475569' }}>
                                                                {translateEntity(entry.entity_name || 'Sistema')}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '1.25rem 0.5rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                                <div style={{
                                                                    width: '32px', height: '32px', borderRadius: '10px',
                                                                    background: isRevenue ? '#f0fdf4' : '#fef2f2',
                                                                    color: isRevenue ? '#10b981' : '#ef4444',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                }}>
                                                                    {isRevenue ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontWeight: '700', color: '#1e293b' }}>{entry.description}</div>
                                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                                        {isRevenue ? 'Crédito / Receita' : 'Débito / Desconto'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '1.25rem 0.5rem', textAlign: 'right' }}>
                                                            <div style={{ fontWeight: '800', fontSize: '1.05rem', color: isRevenue ? '#10b981' : '#ef4444' }}>
                                                                {isRevenue ? '+' : '-'}{formatCurrency(entry.amount)}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    
                                                    {expandedTx === entry.transaction_id && (
                                                        <tr>
                                                            <td colSpan={4} style={{ padding: '0 0.5rem 1rem 0.5rem' }}>
                                                                <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
                                                                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem' }}>
                                                                        Composição do Lançamento
                                                                    </div>
                                                                    {txLoading ? (
                                                                        <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Carregando detalhes...</div>
                                                                    ) : (
                                                                        (() => {
                                                                            const filtered = txDetails.filter(d => d.account_code !== '2.1.1');
                                                                            const grouped = filtered.reduce((acc, curr) => {
                                                                                const key = `${curr.description}-${curr.entity_name}`;
                                                                                if (!acc[key]) {
                                                                                    acc[key] = { ...curr };
                                                                                    acc[key].amount = -curr.amount;
                                                                                } else {
                                                                                    acc[key].amount -= curr.amount;
                                                                                }
                                                                                return acc;
                                                                            }, {});
                                                                            const finalDetails = Object.values(grouped);
                                                                            return (
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                                                    {finalDetails.map((detail, idx) => (
                                                                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px dashed #e2e8f0' }}>
                                                                                            <div>
                                                                                                <div style={{ fontWeight: '600', color: '#334155', fontSize: '0.85rem' }}>{translateEntity(detail.entity_name || detail.account_name)}</div>
                                                                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{detail.description}</div>
                                                                                            </div>
                                                                                            <div style={{ fontWeight: '700', color: detail.amount < 0 ? '#10b981' : '#ef4444' }}>
                                                                                                {detail.amount < 0 ? '+' : '-'}{formatCurrency(detail.amount)}
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            );
                                                                        })()
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* Custom Payment Modal (Rescue) */}
            {showPaymentModal && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)',
                    zIndex: 2100, display: 'flex', justifyContent: 'center', alignItems: 'center'
                }}>
                    <div style={{
                        background: 'white', borderRadius: '24px', width: '90%', maxWidth: '400px',
                        padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                        textAlign: 'center'
                    }}>
                        <div style={{ 
                            width: '64px', height: '64px', borderRadius: '50%', background: '#eff6ff', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem',
                            color: '#3b82f6'
                        }}>
                            <Wallet size={32} />
                        </div>
                        <h4 style={{ margin: '0 0 1rem', fontSize: '1.25rem', color: '#1e293b', fontWeight: 800 }}>Solicitar Resgate</h4>
                        
                        {!isPartial ? (
                            <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '2rem' }}>
                                Deseja realizar o resgate total de <strong style={{ color: '#1e293b' }}>{formatCurrency(paymentAmount)}</strong> via PIX?
                            </p>
                        ) : (
                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'block', textAlign: 'left', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold' }}>Valor do Resgate Parcial</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 'bold', color: '#64748b' }}>R$</span>
                                    <input 
                                        type="number"
                                        style={{ width: '100%', padding: '0.8rem 0.8rem 0.8rem 3rem', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: '800', color: '#1e293b' }}
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>
                        )}

                        <div style={{ 
                            background: '#f8fafc', 
                            padding: '1rem', 
                            borderRadius: '16px', 
                            border: '1px solid #e2e8f0',
                            marginBottom: '1.5rem',
                            textAlign: 'left'
                        }}>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                                Destino (Chave PIX Cadastrada)
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: '700', wordBreak: 'break-all' }}>
                                {supplier?.pix_key} ({supplier?.pix_key_type?.toUpperCase()})
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <button 
                                onClick={confirmPixPayment}
                                style={{
                                    padding: '0.8rem', background: '#1e293b', color: 'white', borderRadius: '12px',
                                    border: 'none', fontWeight: '700', cursor: 'pointer'
                                }}
                            >
                                Confirmar Resgate
                            </button>
                            
                            {!isPartial && (
                                <button 
                                    onClick={() => setIsPartial(true)}
                                    style={{
                                        padding: '0.8rem', background: '#f1f5f9', color: '#475569', borderRadius: '12px',
                                        border: 'none', fontWeight: '700', cursor: 'pointer'
                                    }}
                                >
                                    Outro Valor
                                </button>
                            )}

                            <button 
                                onClick={() => setShowPaymentModal(false)}
                                style={{
                                    padding: '0.8rem', background: 'white', color: '#94a3b8', borderRadius: '12px',
                                    border: '1px solid #e2e8f0', fontWeight: '600', cursor: 'pointer'
                                }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
