import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // Using WS2 lib/supabase.js if available, or adapting
// Wait, previous file used '../services/supabaseClient'. I should be consistent.
// However, the pasted code from WS1 uses '../lib/supabase'.
// PROBABLY WS2 also has '../lib/supabase.js'? I saw it in list_dir!
// Let's stick with '../lib/supabase' if it works, OR change to '../services/supabaseClient' if that's the "official" one for WS2.
// In api.js I used '../services/supabaseClient'.
// I'll check `src/lib/supabase.js` content quickly in my mind...
// Actually, `Login.jsx` (WS2) used `import { supabase } from '../lib/supabase'`.
// So `../lib/supabase` is valid in WS2.
// I will use `../lib/supabase` to match WS1 code structure as much as possible.

import { fetchAddressByCep, fetchOfferData } from '../lib/api';
import { useUI } from '../contexts/UIContext';

export default function ConsumerUnitModal({ consumerUnit, onClose, onSave, onDelete }) {
    const { showAlert, showConfirm } = useUI();
    const [subscribers, setSubscribers] = useState([]);
    const [usinas, setUsinas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchingCep, setSearchingCep] = useState(false);

    // Helpers for Currency/Numbers
    const formatCurrency = (val) => {
        if (!val && val !== 0) return '';
        const number = Number(val);
        if (isNaN(number)) return '';
        return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 });
    };

    const parseCurrency = (str) => {
        if (!str || typeof str !== 'string') return 0;
        const digits = str.replace(/\D/g, '');
        return Number(digits) / 10000; // 4 decimals for tariff
    };

    const handleCurrencyChange = (field, value) => {
        const digits = value.replace(/\D/g, '');
        const number = Number(digits) / 10000;
        const formatted = number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 });
        setFormData(prev => ({ ...prev, [field]: formatted }));
    };

    // Helper for CEP Mask
    const maskCEP = (val) => {
        return val.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9);
    };

    // Status Options
    const statusOptions = [
        { value: 'em_ativacao', label: 'Em Ativação' },
        { value: 'aguardando_conexao', label: 'Aguardando Conexão' },
        { value: 'ativo', label: 'Ativo' },
        { value: 'sem_geracao', label: 'Sem Geração' },
        { value: 'em_atraso', label: 'Em Atraso' },
        { value: 'cancelado', label: 'Cancelado' },
        { value: 'cancelado_inadimplente', label: 'Cancelado (Inadimplente)' }
    ];

    const modalidadeOptions = [
        { value: 'auto_consumo_remoto', label: 'Auto Consumo Remoto' },
        { value: 'geracao_compartilhada', label: 'Geração Compartilhada' }
    ];

    const tipoLigacaoOptions = [
        { value: 'monofasico', label: 'Monofásico' },
        { value: 'bifasico', label: 'Bifásico' },
        { value: 'trifasico', label: 'Trifásico' }
    ];

    const vencimentoOptions = [1, 5, 10, 15, 20, 25, 30];

    const [formData, setFormData] = useState({
        subscriber_id: '',
        usina_id: '',
        status: 'em_ativacao',
        numero_uc: '',
        titular_conta: '',
        modalidade: 'geracao_compartilhada',
        concessionaria: '',
        tipo_ligacao: 'trifasico',
        franquia: '', // kWh
        tarifa_concessionaria: '', // String masked
        te: '', // New
        tusd: '', // New
        fio_b: '', // New
        tarifa_minima: '', // Calculated/Displayed
        desconto_assinante: '',
        dia_vencimento: 10,
        cep: '',
        rua: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        uf: ''
    });

    useEffect(() => {
        fetchSubscribers();
        fetchUsinas();
        if (consumerUnit) {
            setFormData({
                subscriber_id: consumerUnit.subscriber_id || '',
                usina_id: consumerUnit.usina_id || '',
                status: consumerUnit.status || 'em_ativacao',
                numero_uc: consumerUnit.numero_uc || '',
                titular_conta: consumerUnit.titular_conta || '',
                modalidade: consumerUnit.modalidade || 'geracao_compartilhada',
                concessionaria: consumerUnit.concessionaria || '',
                tipo_ligacao: consumerUnit.tipo_ligacao || 'trifasico',
                franquia: consumerUnit.franquia || '',
                tarifa_concessionaria: formatCurrency(consumerUnit.tarifa_concessionaria),
                te: formatCurrency(consumerUnit.te),
                tusd: formatCurrency(consumerUnit.tusd),
                fio_b: formatCurrency(consumerUnit.fio_b),
                tarifa_minima: '', // Recalculated on render
                desconto_assinante: consumerUnit.desconto_assinante || '',
                dia_vencimento: consumerUnit.dia_vencimento || 10,
                cep: maskCEP(consumerUnit.address?.cep || ''),
                rua: consumerUnit.address?.rua || '',
                numero: consumerUnit.address?.numero || '',
                complemento: consumerUnit.address?.complemento || '',
                bairro: consumerUnit.address?.bairro || '',
                cidade: consumerUnit.address?.cidade || '',
                uf: consumerUnit.address?.uf || ''
            });
        }
    }, [consumerUnit]);

    // Calculate Tarifa Minima automatically
    useEffect(() => {
        const tariff = parseCurrency(formData.tarifa_concessionaria);
        let multiplier = 30; // Monofasico default
        if (formData.tipo_ligacao === 'trifasico') multiplier = 100;
        else if (formData.tipo_ligacao === 'bifasico') multiplier = 50;

        const minTariff = tariff * multiplier;
        // Fix: Display with 2 decimal places as requested (R$ XX,XX)
        const formattedMin = minTariff.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });

        setFormData(prev => ({
            ...prev,
            tarifa_minima: formattedMin
        }));
    }, [formData.tarifa_concessionaria, formData.tipo_ligacao]);

    const fetchSubscribers = async () => {
        const { data } = await supabase.from('subscribers').select('id, name, cpf_cnpj').order('name');
        setSubscribers(data || []);
    };

    const fetchUsinas = async () => {
        const { data } = await supabase.from('usinas').select('id, name').order('name');
        setUsinas(data || []);
    };

    const handleCepChange = (e) => {
        const masked = maskCEP(e.target.value);
        setFormData(prev => ({ ...prev, cep: masked }));
    };

    const handleCepBlur = async () => {
        const rawCep = formData.cep.replace(/\D/g, '');
        if (rawCep.length === 8) {
            setSearchingCep(true);
            try {
                const addr = await fetchAddressByCep(rawCep);
                setFormData(prev => ({
                    ...prev,
                    rua: addr.rua || '',
                    bairro: addr.bairro || '',
                    cidade: addr.cidade || '',
                    uf: addr.uf || '',
                    concessionaria: prev.concessionaria || ''
                }));

                // Fetch Offers based on IBGE
                if (addr.ibge) {
                    const offer = await fetchOfferData(addr.ibge);
                    if (offer) {
                        let discountVal = offer['Desconto Assinante'] || 0;
                        if (discountVal > 1) {
                            // Already percentage (e.g. 20)
                        } else {
                            // Decimal (e.g. 0.2)
                            discountVal = discountVal * 100;
                        }

                        setFormData(prev => ({
                            ...prev,
                            rua: addr.rua || '',
                            bairro: addr.bairro || '',
                            cidade: addr.cidade || '',
                            uf: addr.uf || '',
                            concessionaria: offer.Concessionaria || prev.concessionaria,
                            tarifa_concessionaria: offer['Tarifa Concessionaria'] ? formatCurrency(offer['Tarifa Concessionaria']) : prev.tarifa_concessionaria,
                            te: offer['TE'] ? formatCurrency(offer['TE']) : prev.te,
                            tusd: offer['TUSD'] ? formatCurrency(offer['TUSD']) : prev.tusd,
                            fio_b: offer['Fio B'] ? formatCurrency(offer['Fio B']) : prev.fio_b,
                            desconto_assinante: discountVal.toFixed(2)
                        }));
                    }
                }

            } catch (error) {
                console.error('Erro CEP', error);
                showAlert('Erro ao buscar CEP/Ofertas: ' + (error.message || 'Não encontrado'), 'error');
            } finally {
                setSearchingCep(false);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                subscriber_id: formData.subscriber_id || null,
                usina_id: formData.usina_id || null,
                status: formData.status,
                numero_uc: formData.numero_uc,
                titular_conta: formData.titular_conta,
                modalidade: formData.modalidade,
                concessionaria: formData.concessionaria,
                tipo_ligacao: formData.tipo_ligacao,
                franquia: Number(formData.franquia),
                tarifa_concessionaria: parseCurrency(formData.tarifa_concessionaria),
                te: parseCurrency(formData.te),
                tusd: parseCurrency(formData.tusd),
                fio_b: parseCurrency(formData.fio_b),
                desconto_assinante: Number(formData.desconto_assinante),
                dia_vencimento: Number(formData.dia_vencimento),
                address: {
                    cep: formData.cep.replace(/\D/g, ''),
                    rua: formData.rua,
                    numero: formData.numero,
                    complemento: formData.complemento,
                    bairro: formData.bairro,
                    cidade: formData.cidade,
                    uf: formData.uf
                }
            };

            if (!payload.subscriber_id) throw new Error('Assinante é obrigatório.');

            let result;
            if (consumerUnit?.id) {
                result = await supabase.from('consumer_units').update(payload).eq('id', consumerUnit.id).select().single();
            } else {
                result = await supabase.from('consumer_units').insert(payload).select().single();
            }

            if (result.error) throw result.error;
            onSave(result.data);
            onClose();
        } catch (error) {
            showAlert('Erro ao salvar UC: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        const confirm = await showConfirm('Excluir esta Unidade Consumidora?');
        if (!confirm) return;
        setLoading(true);
        try {
            const { error } = await supabase.from('consumer_units').delete().eq('id', consumerUnit.id);
            if (error) throw error;
            if (onDelete) onDelete(consumerUnit.id);
            onClose();
        } catch (error) {
            showAlert('Erro ao excluir: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
            <div style={{
                background: 'white', padding: '2rem', borderRadius: '8px',
                width: '90%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
                    <h3 style={{ margin: 0 }}>{consumerUnit ? 'Editar UC' : 'Nova Unidade Consumidora'}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    {/* Simplified inline styles for the form to ensure it renders decently without specific global CSS */}

                    <div style={{ gridColumn: '1 / -1', background: '#f8fafc', padding: '1rem', borderRadius: '4px' }}>
                        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.3rem' }}>Status da Unidade</label>
                        <select
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
                        >
                            {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>

                    {/* ... Rest of the form inputs with inline styles applied ... */}
                    {/* Truncated for brevity but the logic remains the same as WS1 */}
                    {/* I will assume the user wants the full form. I'll paste the full form content from WS1 with adapted styles because WS1 had 'label' and 'input' classes which might be missing. */}

                    <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
                        <h4 style={{ borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Vínculos</h4>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Assinante *</label>
                        <select
                            required
                            value={formData.subscriber_id}
                            onChange={e => setFormData({ ...formData, subscriber_id: e.target.value })}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                        >
                            <option value="">Selecione...</option>
                            {subscribers.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.cpf_cnpj})</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Usina (Opcional)</label>
                        <select
                            value={formData.usina_id}
                            onChange={e => setFormData({ ...formData, usina_id: e.target.value })}
                            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                        >
                            <option value="">Selecione...</option>
                            {usinas.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Address Fields */}
                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem' }}>
                        <div style={{ width: '150px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>CEP</label>
                            <input
                                value={formData.cep}
                                onChange={handleCepChange}
                                onBlur={handleCepBlur}
                                placeholder="00000-000"
                                maxLength={9}
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Concessionária</label>
                            <input
                                value={formData.concessionaria}
                                readOnly
                                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', background: '#f0f0f0' }}
                            />
                        </div>
                    </div>

                    {/* Other fields... mapping them with inline styles to be safe */}
                    <div style={{ gridColumn: '1 / -1' }}><h4 style={{ borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Dados da Unidade</h4></div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Número da UC *</label>
                        <input required value={formData.numero_uc} onChange={e => setFormData({ ...formData, numero_uc: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Titular da Conta</label>
                        <input required value={formData.titular_conta} onChange={e => setFormData({ ...formData, titular_conta: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                    </div>

                    {/* Address details */}
                    <div style={{ gridColumn: '1 / -1' }}><h4 style={{ borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Endereço de Instalação</h4></div>

                    <div style={{ display: 'flex', gap: '1rem', gridColumn: '1 / -1' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Rua</label>
                            <input value={formData.rua} onChange={e => setFormData({ ...formData, rua: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                        </div>
                        <div style={{ width: '100px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Número</label>
                            <input value={formData.numero} onChange={e => setFormData({ ...formData, numero: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Bairro</label>
                        <input value={formData.bairro} onChange={e => setFormData({ ...formData, bairro: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Complemento</label>
                        <input value={formData.complemento} onChange={e => setFormData({ ...formData, complemento: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Cidade</label>
                        <input value={formData.cidade} onChange={e => setFormData({ ...formData, cidade: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>UF</label>
                        <input value={formData.uf} onChange={e => setFormData({ ...formData, uf: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                    </div>

                    {/* Technical */}
                    <div style={{ gridColumn: '1 / -1' }}><h4 style={{ borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Dados Técnicos e Comerciais</h4></div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Tipo de Ligação</label>
                        <select value={formData.tipo_ligacao} onChange={e => setFormData({ ...formData, tipo_ligacao: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                            {tipoLigacaoOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Modalidade</label>
                        <select value={formData.modalidade} onChange={e => setFormData({ ...formData, modalidade: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                            {modalidadeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>

                    <div style={{ gridColumn: '1 / -1', background: '#e0f2fe', padding: '1rem', borderRadius: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem' }}>Tarifa Concessionária (R$)</label>
                            <input value={formData.tarifa_concessionaria} onChange={e => handleCurrencyChange('tarifa_concessionaria', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #90cdf4' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem' }}>TE (R$)</label>
                            <input value={formData.te} onChange={e => handleCurrencyChange('te', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #90cdf4' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem' }}>TUSD (R$)</label>
                            <input value={formData.tusd} onChange={e => handleCurrencyChange('tusd', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #90cdf4' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.8rem' }}>Fio B (R$)</label>
                            <input value={formData.fio_b} onChange={e => handleCurrencyChange('fio_b', e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #90cdf4' }} />
                        </div>
                        <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                            <strong>Tarifa Mínima Estimada: </strong> {formData.tarifa_minima || 'R$ 0,00'}
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Desconto Assinante (%)</label>
                        <input type="number" step="0.01" value={formData.desconto_assinante} onChange={e => setFormData({ ...formData, desconto_assinante: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Franquia (kWh)</label>
                        <input type="number" value={formData.franquia} onChange={e => setFormData({ ...formData, franquia: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Dia Vencimento</label>
                        <select value={formData.dia_vencimento} onChange={e => setFormData({ ...formData, dia_vencimento: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                            {vencimentoOptions.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>

                    {/* Footer */}
                    <div style={{ gridColumn: '1 / -1', marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        {consumerUnit && onDelete && (
                            <button type="button" onClick={handleDelete} style={{ marginRight: 'auto', background: '#fee2e2', color: '#dc2626', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}>Excluir UC</button>
                        )}
                        <button type="button" onClick={onClose} style={{ background: '#ccc', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
                        <button type="submit" disabled={loading} style={{ background: '#003366', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}>
                            {loading ? 'Salvando...' : 'Salvar UC'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
