import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';

const LeadCreateModal = ({ isOpen, onClose, originatorId, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        consumo_kwh: '',
        status: 'Novo'
    });

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase
                .from('leads')
                .insert([{
                    ...formData,
                    originator_id: originatorId,
                    consumo_kwh: Number(formData.consumo_kwh),
                    status: 'Simulação' // Default status based on new tabs
                }]);

            if (error) throw error;

            alert('Lead criado com sucesso!');
            onSuccess();
            onClose();
            setFormData({ name: '', email: '', phone: '', consumo_kwh: '', status: 'Novo' });
        } catch (error) {
            console.error('Error creating lead:', error);
            alert('Erro ao criar lead: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <h3>Novo Lead</h3>
                    <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.field}>
                        <label>Nome Completo</label>
                        <input
                            required
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            style={styles.input}
                        />
                    </div>
                    <div style={styles.field}>
                        <label>E-mail</label>
                        <input
                            required
                            type="email"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            style={styles.input}
                        />
                    </div>
                    <div style={styles.field}>
                        <label>Telefone</label>
                        <input
                            required
                            type="tel"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            style={styles.input}
                        />
                    </div>
                    <div style={styles.field}>
                        <label>Consumo Médio (kWh)</label>
                        <input
                            required
                            type="number"
                            value={formData.consumo_kwh}
                            onChange={e => setFormData({ ...formData, consumo_kwh: e.target.value })}
                            style={styles.input}
                        />
                    </div>
                    <button type="submit" disabled={loading} style={styles.submitBtn}>
                        {loading ? 'Salvando...' : 'Cadastrar Lead'}
                    </button>
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
        width: '90%', maxWidth: '500px',
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
        cursor: 'pointer'
    }
};

export default LeadCreateModal;
