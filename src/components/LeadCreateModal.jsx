import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Send } from 'lucide-react';
import { sendWhatsapp } from '../lib/api';
import { maskPhone, validatePhone, cleanDigits } from '../lib/validators';

const LeadCreateModal = ({ isOpen, onClose, originatorId, originatorName, companyName, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [inviteMediaUrl, setInviteMediaUrl] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        status: 'convite_enviado'
    });

    useEffect(() => {
        if (isOpen) {
            fetchConfig();
        }
    }, [isOpen]);

    const fetchConfig = async () => {
        try {
            const { data } = await supabase
                .from('integrations_config')
                .select('variables')
                .eq('service_name', 'evolution_api')
                .maybeSingle();

            if (data?.variables?.invite_media_url) {
                setInviteMediaUrl(data.variables.invite_media_url);
            }
        } catch (err) {
            console.error("Error fetching config:", err);
        }
    };

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!validatePhone(formData.phone)) {
            alert("Telefone inválido. Digite DDD + 9 dígitos.");
            return;
        }

        setLoading(true);
        try {
            // 1. Create Lead
            // Remove email if empty string to avoid unique constraint issues if any (though usually nullable)
            const leadPayload = {
                ...formData,
                email: formData.email || null, // Ensure null if empty
                phone: cleanDigits(formData.phone),
                originator_id: originatorId,
                status: 'convite_enviado',
                consumo_kwh: 0 // Optional or 0
            };

            const { error } = await supabase
                .from('leads')
                .insert([leadPayload]);

            if (error) throw error;

            // 2. Prepare WhatsApp Message
            const inviteLink = `https://b2wenergia.com.br/convite?name=${encodeURIComponent(originatorName || '')}&id=${originatorId}`;
            const message = `Oi ${formData.name}. O ${originatorName} da ${companyName || 'B2W Energia'} em consideração especial aos seus amigos e clientes te enviou um super bonus de presente. Um super desconto todo mês na sua conta de energia.

Para começar a receber o desconto bastar concluir o seu cadastro no link: ${inviteLink}`;

            // 3. Send WhatsApp
            // Ensure DDI 55
            let whatsappPhone = cleanDigits(formData.phone);
            if (whatsappPhone.length === 11) { // 11 digits = DDD + 9 digits (no DDI)
                whatsappPhone = '55' + whatsappPhone;
            } else if (whatsappPhone.length === 10) { // 10 digits = DDD + 8 digits (no DDI) - unlikely for mobile but possible
                whatsappPhone = '55' + whatsappPhone;
            }

            await sendWhatsapp(whatsappPhone, message, inviteMediaUrl);

            alert('Convite enviado com sucesso!');
            onSuccess();
            onClose();
            setFormData({ name: '', email: '', phone: '', status: 'convite_enviado' });

        } catch (error) {
            console.error('Error processing invite:', error);
            alert('Erro ao enviar convite: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h3>Enviar Convite</h3>
                    <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.field}>
                        <label>Nome do Lead</label>
                        <input
                            required
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            style={styles.input}
                            placeholder="Nome Completo"
                        />
                    </div>

                    <div style={styles.field}>
                        <label>Celular (WhatsApp)</label>
                        <input
                            required
                            type="tel"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: maskPhone(e.target.value) })}
                            style={styles.input}
                            placeholder="(99) 99999-9999"
                            maxLength={15}
                        />
                    </div>

                    <div style={styles.field}>
                        <label>E-mail (Opcional)</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            style={styles.input}
                            placeholder="exemplo@email.com"
                        />
                    </div>

                    <button type="submit" disabled={loading} style={styles.submitBtn}>
                        {loading ? 'Enviando...' : <><Send size={18} /> Enviar Convite</>}
                    </button>

                    {inviteMediaUrl && (
                        <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem', textAlign: 'center' }}>
                            * Uma imagem personalizada será enviada junto com o convite.
                        </p>
                    )}
                </form>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000
    },
    modal: {
        background: 'white',
        borderRadius: '12px',
        width: '90%', maxWidth: '400px',
        padding: '2rem',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
    },
    header: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1rem'
    },
    closeBtn: {
        background: 'none', border: 'none', cursor: 'pointer', color: '#666'
    },
    form: {
        display: 'flex', flexDirection: 'column', gap: '1rem'
    },
    field: {
        display: 'flex', flexDirection: 'column', gap: '0.5rem'
    },
    input: {
        padding: '0.75rem', borderRadius: '6px', border: '1px solid #ddd',
        fontSize: '1rem'
    },
    submitBtn: {
        marginTop: '1rem',
        padding: '1rem',
        background: '#FF6600',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '1rem',
        fontWeight: 'bold',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
    }
};

export default LeadCreateModal;
