import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { maskPhone } from '../lib/validators';
import { Eye, EyeOff, X, CheckCircle } from 'lucide-react';

export default function Login() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Recovery
    const [resetSent, setResetSent] = useState(false);
    const [showResetForm, setShowResetForm] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');

    useEffect(() => {
        // Listen for recovery event
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                setShowResetForm(true);
            }
        });

        // Also check URL for safety (sometimes redirect lands before event triggers handle)
        if (window.location.search.includes('reset=true')) {
            setShowResetForm(true);
        }

        return () => subscription.unsubscribe();
    }, []);

    // Signup Modal State
    const [showSignupModal, setShowSignupModal] = useState(false);
    const [signupData, setSignupData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: ''
    });
    const [signupLoading, setSignupLoading] = useState(false);
    const [showVerificationModal, setShowVerificationModal] = useState(false);

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
                        // Special case: If they just signed up, they might be visitors
                        // Redirect to Role Selection to finish profile
                        navigate('/cadastro-parceiro');
                }
            }
        } catch (error) {
            console.error('Error logging in:', error);
            alert(error.message || 'Erro ao realizar login.');
        } finally {
            setLoading(false);
        }
    };

    const handleSignup = async (e) => {
        e.preventDefault();

        if (signupData.password !== signupData.confirmPassword) {
            alert('As senhas não coincidem!');
            return;
        }

        if (signupData.password.length < 6) {
            alert('A senha deve ter pelo menos 6 caracteres.');
            return;
        }

        setSignupLoading(true);

        try {
            const { data, error } = await supabase.auth.signUp({
                email: signupData.email,
                password: signupData.password,
                options: {
                    data: {
                        name: signupData.name,
                        phone: signupData.phone
                    }
                }
            });

            if (error) throw error;

            if (data?.user) {
                setShowSignupModal(false);
                setShowVerificationModal(true);
            }

        } catch (error) {
            console.error('Signup error:', error);
            alert('Erro no cadastro: ' + (error.message || 'Tente novamente.'));
        } finally {
            setSignupLoading(false);
        }
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmNewPassword) {
            alert('As senhas não coincidem!');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });
            if (error) throw error;
            alert('Senha atualizada com sucesso! Agora você pode fazer login.');
            setShowResetForm(false);
            setNewPassword('');
            setConfirmNewPassword('');
            navigate('/login');
        } catch (error) {
            alert('Erro ao atualizar senha: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!email) {
            alert('Digite seu email para recuperar a senha.');
            return;
        }
        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/login?reset=true',
        });
        setLoading(false);
        if (error) {
            alert('Erro ao enviar email: ' + error.message);
        } else {
            setResetSent(true);
            alert('Email de recuperação enviado! Verifique sua caixa de entrada.');
        }
    };

    const colors = {
        primary: '#003366',
        accent: '#FF6600',
    };

    const styles = {
        container: {
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: '100vh', backgroundColor: '#f3f4f6', padding: '1rem',
            fontFamily: 'Inter, sans-serif'
        },
        card: {
            backgroundColor: 'white', padding: '2rem', borderRadius: '1rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            width: '100%', maxWidth: '28rem', position: 'relative'
        },
        header: { textAlign: 'center', marginBottom: '2rem' },
        title: { fontSize: '1.5rem', fontWeight: 'bold', color: colors.primary, marginBottom: '0.5rem' },
        subtitle: { color: '#6b7280', fontSize: '0.875rem' },
        form: { display: 'flex', flexDirection: 'column', gap: '1.25rem' },
        label: { display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' },
        input: {
            width: '100%', padding: '0.75rem', borderRadius: '0.5rem',
            border: '1px solid #d1d5db', outline: 'none', transition: 'border-color 0.2s', fontSize: '1rem'
        },
        button: {
            width: '100%', padding: '0.75rem', borderRadius: '0.5rem',
            backgroundColor: colors.accent, color: 'white', fontWeight: '600',
            border: 'none', cursor: 'pointer', transition: 'opacity 0.2s',
            marginTop: '1rem', fontSize: '1rem'
        },
        secondaryButton: {
            background: 'none', border: 'none', color: colors.primary,
            fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', padding: 0
        },
        modalOverlay: {
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        },
        modalContent: {
            backgroundColor: 'white', padding: '2rem', borderRadius: '1rem',
            width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', position: 'relative'
        },
        closeButton: {
            position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af'
        }
    };

    return (
        <div style={styles.container}>
            {showResetForm ? (
                <div style={styles.card}>
                    <div style={styles.header}>
                        <h1 style={styles.title}>Nova Senha</h1>
                        <p style={styles.subtitle}>Crie uma nova senha para sua conta</p>
                    </div>

                    <form onSubmit={handleUpdatePassword} style={styles.form}>
                        <div>
                            <label style={styles.label}>Nova Senha</label>
                            <input
                                type="password"
                                required
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                style={styles.input}
                                placeholder="••••••••"
                                minLength={6}
                            />
                        </div>

                        <div>
                            <label style={styles.label}>Confirmar Nova Senha</label>
                            <input
                                type="password"
                                required
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                style={styles.input}
                                placeholder="••••••••"
                                minLength={6}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
                        >
                            {loading ? 'Atualizando...' : 'Definir Nova Senha'}
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowResetForm(false)}
                            style={{ ...styles.secondaryButton, marginTop: '1rem', width: '100%' }}
                        >
                            Cancelar
                        </button>
                    </form>
                </div>
            ) : (
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
                                    onClick={handleResetPassword}
                                    style={{ ...styles.secondaryButton, fontWeight: 'normal', fontSize: '0.8rem' }}
                                >
                                    {resetSent ? 'Email enviado!' : 'Esqueci minha senha'}
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
                                onClick={() => setShowSignupModal(true)}
                                style={styles.secondaryButton}
                            >
                                Criar conta
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Signup Modal */}
            {showSignupModal && (
                <div style={styles.modalOverlay}>
                    <div style={styles.modalContent}>
                        <button onClick={() => setShowSignupModal(false)} style={styles.closeButton}>
                            <X size={24} />
                        </button>
                        <h2 style={{ ...styles.title, textAlign: 'center', marginBottom: '1.5rem' }}>Criar Nova Conta</h2>

                        <form onSubmit={handleSignup} style={styles.form}>
                            <div>
                                <label style={styles.label}>Nome Completo</label>
                                <input
                                    required
                                    value={signupData.name}
                                    onChange={e => setSignupData({ ...signupData, name: e.target.value })}
                                    style={styles.input}
                                />
                            </div>
                            <div>
                                <label style={styles.label}>WhatsApp</label>
                                <input
                                    required
                                    value={signupData.phone}
                                    onChange={e => setSignupData({ ...signupData, phone: maskPhone(e.target.value) })}
                                    style={styles.input}
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                            <div>
                                <label style={styles.label}>E-mail</label>
                                <input
                                    type="email"
                                    required
                                    value={signupData.email}
                                    onChange={e => setSignupData({ ...signupData, email: e.target.value })}
                                    style={styles.input}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={styles.label}>Senha</label>
                                    <input
                                        type="password"
                                        required
                                        value={signupData.password}
                                        onChange={e => setSignupData({ ...signupData, password: e.target.value })}
                                        style={styles.input}
                                        minLength={6}
                                        placeholder="Min. 6 caracteres"
                                    />
                                </div>
                                <div>
                                    <label style={styles.label}>Confirmar Senha</label>
                                    <input
                                        type="password"
                                        required
                                        value={signupData.confirmPassword}
                                        onChange={e => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                                        style={styles.input}
                                        minLength={6}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={signupLoading}
                                style={{ ...styles.button, backgroundColor: '#10b981' }}
                            >
                                {signupLoading ? 'Criando Conta...' : 'Cadastrar'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Verification Modal */}
            {showVerificationModal && (
                <div style={styles.modalOverlay}>
                    <div style={{ ...styles.modalContent, textAlign: 'center', maxWidth: '400px' }}>
                        <div style={{ margin: '0 auto 1.5rem', color: '#10b981' }}>
                            <CheckCircle size={64} />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
                            Verifique seu E-mail
                        </h2>
                        <p style={{ color: '#6b7280', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                            Enviamos um link de confirmação para <strong>{signupData.email}</strong>.<br />
                            Por favor, confirme seu e-mail para ativar sua conta.
                        </p>
                        <button
                            onClick={() => {
                                setShowVerificationModal(false);
                                // Optional: auto fill email in login
                                setEmail(signupData.email);
                            }}
                            style={styles.button}
                        >
                            Voltar para Login
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
