import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Login() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            if (data?.user) {
                // Determine redirect based on role or default
                // Fetch profile to see role
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', data.user.id)
                    .single();

                const role = profile?.role || 'visitor';

                switch (role) {
                    case 'subscriber':
                        navigate('/assinantes');
                        break;
                    case 'originator':
                        navigate('/originadores');
                        break;
                    case 'supplier':
                        navigate('/fornecedores');
                        break;
                    default:
                        navigate('/'); // Fallback to Role Selection
                }
            }
        } catch (error) {
            console.error('Error logging in:', error);
            alert(error.message || 'Erro ao realizar login.');
        } finally {
            setLoading(false);
        }
    };

    const colors = {
        primary: '#003366',
        accent: '#FF6600',
    };

    const styles = {
        container: {
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '1rem'
        },
        card: {
            backgroundColor: 'white', padding: '2rem', borderRadius: '1rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            width: '100%', maxWidth: '28rem'
        },
        header: {
            textAlign: 'center', marginBottom: '2rem'
        },
        title: {
            fontSize: '1.5rem', fontWeight: 'bold', color: colors.primary, marginBottom: '0.5rem'
        },
        subtitle: {
            color: '#6b7280', fontSize: '0.875rem'
        },
        form: {
            display: 'flex', flexDirection: 'column', gap: '1.25rem'
        },
        label: {
            display: 'block', fontSize: '0.875rem', fontWeight: '500',
            color: '#374151', marginBottom: '0.5rem'
        },
        input: {
            width: '100%', padding: '0.75rem', borderRadius: '0.5rem',
            border: '1px solid #d1d5db', outline: 'none', transition: 'border-color 0.2s'
        },
        button: {
            width: '100%', padding: '0.75rem', borderRadius: '0.5rem',
            backgroundColor: colors.accent, color: 'white', fontWeight: '600',
            border: 'none', cursor: 'pointer', transition: 'opacity 0.2s',
            marginTop: '1rem'
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.header}>
                    <h1 style={styles.title}>Acesse sua Conta</h1>
                    <p style={styles.subtitle}>B2W Energia</p>
                </div>

                <form onSubmit={handleLogin} style={styles.form}>
                    <div>
                        <label style={styles.label}>E-mail</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={styles.input}
                            placeholder="seu@email.com"
                        />
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={styles.label}>Senha</label>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (!email) {
                                        alert('Digite seu email para recuperar a senha.');
                                        return;
                                    }
                                    setLoading(true);
                                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                                        redirectTo: window.location.origin + '/dashboard?reset=true',
                                    });
                                    setLoading(false);
                                    if (error) {
                                        alert('Erro ao enviar email: ' + error.message);
                                    } else {
                                        alert('Email de recuperação enviado! Verifique sua caixa de entrada.');
                                    }
                                }}
                                style={{ background: 'none', border: 'none', color: colors.primary, fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
                            >
                                Esqueci minha senha
                            </button>
                        </div>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={styles.input}
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
                    >
                        {loading ? 'Entrando...' : 'Entrar'}
                    </button>

                    <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                        <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Não tem uma conta? </span>
                        <button
                            type="button"
                            onClick={() => window.location.href = 'https://app.b2wenergia.com.br/cadastro-parceiro'}
                            style={{ background: 'none', border: 'none', color: colors.primary, fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', padding: 0 }}
                        >
                            Criar conta
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
