import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Send } from 'lucide-react';
import { sendWhatsapp } from '../lib/api';
import { maskPhone, validatePhone, cleanDigits } from '../lib/validators';

const LeadCreateModal = ({ isOpen, onClose, originatorId, originatorName, companyName, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [inviteMediaUrl, setInviteMediaUrl] = useState(null);

    const [success, setSuccess] = useState(false); // [NEW] Success State

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        status: 'convite_enviado'
    });

    // ... (fetchConfig logic remains) ...

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
            const leadPayload = {
                ...formData,
                email: formData.email || null,
                phone: cleanDigits(formData.phone),
                originator_id: originatorId,
                status: 'convite_enviado',
                consumo_kwh: 0
            };

            const { error } = await supabase
                .from('leads')
                .insert([leadPayload]);

            if (error) throw error;

            // 2. Prepare WhatsApp Message
            const inviteLink = `https://b2wenergia.com.br/convite?name=${encodeURIComponent(originatorName || '')}&id=${originatorId}`;

            // [UPDATED] Message Template
            const message = `🌟 Olá ${formData.name}, tudo bem?

🎁 Tenho um presente especial para você!

O ${originatorName} da *${companyName || 'B2W Energia'}* selecionou você para receber um *Super Desconto* na sua conta de energia todos os meses! 📉⚡

É simples, rápido e gratuito. Não perca essa oportunidade de economizar! 💸

👇 *Clique no link abaixo para ativar seu desconto agora:*
${inviteLink}

🚀 *Vem economizar com a gente!*`;

            // 3. Send WhatsApp
            let whatsappPhone = cleanDigits(formData.phone);
            if (whatsappPhone.length === 11) whatsappPhone = '55' + whatsappPhone;
            else if (whatsappPhone.length === 10) whatsappPhone = '55' + whatsappPhone;

            await sendWhatsapp(whatsappPhone, message, inviteMediaUrl);

            setSuccess(true); // Show Success View
            onSuccess();
            // Don't close immediately

        } catch (error) {
            console.error('Error processing invite:', error);
            alert('Erro ao enviar convite: ' + (error.message || 'Erro desconhecido'));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    // [NEW] Visual Success Popup
    if (success) {
        return (
            <div style={styles.overlay}>
                <div style={styles.modal}>
                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                        <div style={{
                            width: '60px', height: '60px', borderRadius: '50%', background: '#dcfce7',
                            color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            margin: '0 auto 1.5rem auto'
                        }}>
                            <Send size={32} />
                        </div>
                        <h3 style={{ color: '#1f2937', marginBottom: '1rem' }}>Convite Enviado!</h3>
                        <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
                            O convite foi enviado com sucesso pelo WhatsApp para <strong>{formData.name}</strong>.
                        </p>
                        <button
                            onClick={() => {
                                setSuccess(false);
                                setFormData({ name: '', email: '', phone: '', status: 'convite_enviado' });
                                onClose();
                            }}
                            style={{ ...styles.submitBtn, background: '#16a34a', width: '100%', marginTop: 0 }}
                        >
                            Concluir
                        </button>
                    </div>
                </div>
            </div>
        );
    }

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
