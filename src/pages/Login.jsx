import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { maskPhone } from '../lib/validators';
import { Eye, EyeOff, X, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import './Login.css';

const BRAND_LOGO = 'https://abbysvxnnhwvvzhftoms.supabase.co/storage/v1/object/public/branding/logos/logo_1772342503927.png';

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
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                setShowResetForm(true);
            }
        });

        if (window.location.search.includes('reset=true')) {
            setShowResetForm(true);
        }

        return () => subscription.unsubscribe();
    }, []);

    // Signup Modal State
    const [showSignupModal, setShowSignupModal] = useState(false);
    const [signupData, setSignupData] = useState({
        name: '', email: '', phone: '', password: '', confirmPassword: ''
    });
    const [signupLoading, setSignupLoading] = useState(false);
    const [showVerificationModal, setShowVerificationModal] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            if (data?.user) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
                const role = profile?.role || 'visitor';
                switch (role) {
                    case 'subscriber': navigate('/assinantes'); break;
                    case 'originator': navigate('/originadores'); break;
                    case 'supplier': navigate('/fornecedores'); break;
                    default: navigate('/cadastro-parceiro');
                }
            }
        } catch (error) {
            console.error('Error logging in:', error);
            alert(error.message || 'Erro ao realizar login.');
        } finally { setLoading(false); }
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        if (signupData.password !== signupData.confirmPassword) { alert('As senhas não coincidem!'); return; }
        if (signupData.password.length < 6) { alert('A senha deve ter pelo menos 6 caracteres.'); return; }
        setSignupLoading(true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email: signupData.email,
                password: signupData.password,
                options: { data: { name: signupData.name, phone: signupData.phone } }
            });
            if (error) throw error;
            if (data?.user) { setShowSignupModal(false); setShowVerificationModal(true); }
        } catch (error) {
            console.error('Signup error:', error);
            alert('Erro no cadastro: ' + (error.message || 'Tente novamente.'));
        } finally { setSignupLoading(false); }
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmNewPassword) { alert('As senhas não coincidem!'); return; }
        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            alert('Senha atualizada com sucesso! Agora você pode fazer login.');
            setShowResetForm(false);
            setNewPassword('');
            setConfirmNewPassword('');
            navigate('/login');
        } catch (error) { alert('Erro ao atualizar senha: ' + error.message); }
        finally { setLoading(false); }
    };

    const handleResetPassword = async () => {
        if (!email) { alert('Digite seu email para recuperar a senha.'); return; }
        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/login?reset=true',
        });
        setLoading(false);
        if (error) { alert('Erro ao enviar email: ' + error.message); }
        else { setResetSent(true); alert('Email de recuperação enviado! Verifique sua caixa de entrada.'); }
    };

    return (
        <div className="login-container">
            <div className="login-content">
                <motion.div
                    className="login-logo-wrapper"
                    initial={{ opacity: 0.5, scale: 0.8 }}
                    animate={{
                        opacity: 1,
                        scale: [1, 1.05, 1]
                    }}
                    transition={{
                        opacity: { duration: 0.8 },
                        scale: { repeat: Infinity, duration: 4, ease: "easeInOut" }
                    }}
                >
                    <img src={BRAND_LOGO} alt="B2W Energia" className="brand-logo-login" />
                </motion.div>

                <motion.div
                    className="login-card"
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                >
                    {showResetForm ? (
                        <>
                            <div className="login-header">
                                <h1>Nova Senha</h1>
                                <p>Crie uma nova senha para sua conta</p>
                            </div>
                            <form onSubmit={handleUpdatePassword} className="login-form">
                                <div className="form-group">
                                    <label className="form-label">Nova Senha</label>
                                    <input
                                        type="password"
                                        required
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="login-input"
                                        placeholder="••••••••"
                                        minLength={6}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Confirmar Nova Senha</label>
                                    <input
                                        type="password"
                                        required
                                        value={confirmNewPassword}
                                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                                        className="login-input"
                                        placeholder="••••••••"
                                        minLength={6}
                                    />
                                </div>
                                <button type="submit" disabled={loading} className="btn-primary-b2w">
                                    {loading ? 'Atualizando...' : 'Definir Nova Senha'}
                                </button>
                                <div className="signup-prompt">
                                    <button type="button" onClick={() => setShowResetForm(false)} className="signup-link">
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        </>
                    ) : (
                        <>
                            <div className="login-header">
                                <h1>Acesse sua Conta</h1>
                                <p>B2W Energia Solar</p>
                            </div>

                            <form onSubmit={handleLogin} className="login-form">
                                <div className="form-group">
                                    <label className="form-label">E-mail</label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="login-input"
                                        placeholder="seu@email.com"
                                    />
                                </div>

                                <div className="form-group">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <label className="form-label" style={{ marginBottom: 0 }}>Senha</label>
                                        <button
                                            type="button"
                                            onClick={handleResetPassword}
                                            className="forgot-password"
                                        >
                                            {resetSent ? 'Email enviado!' : 'Esqueci minha senha'}
                                        </button>
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="login-input"
                                        placeholder="••••••••"
                                    />
                                </div>

                                <motion.button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-primary-b2w"
                                    whileTap={{ scale: 0.98 }}
                                >
                                    {loading ? 'Entrando...' : 'Entrar no Portal'}
                                </motion.button>

                                <div className="signup-prompt">
                                    <span>Não tem uma conta? </span>
                                    <button
                                        type="button"
                                        onClick={() => setShowSignupModal(true)}
                                        className="signup-link"
                                    >
                                        Criar conta agora
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </motion.div>
            </div>

            {/* Signup Modal */}
            {showSignupModal && (
                <div style={signupModalStyles.modalOverlay}>
                    <motion.div
                        style={signupModalStyles.modalContent}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                    >
                        <button onClick={() => setShowSignupModal(false)} style={signupModalStyles.closeButton}>
                            <X size={24} />
                        </button>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#003366', textAlign: 'center', marginBottom: '1.5rem' }}>Criar Nova Conta</h2>

                        <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label className="form-label">Nome Completo</label>
                                <input
                                    required
                                    value={signupData.name}
                                    onChange={e => setSignupData({ ...signupData, name: e.target.value })}
                                    className="login-input"
                                />
                            </div>
                            <div>
                                <label className="form-label">WhatsApp</label>
                                <input
                                    required
                                    value={signupData.phone}
                                    onChange={e => setSignupData({ ...signupData, phone: maskPhone(e.target.value) })}
                                    className="login-input"
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                            <div>
                                <label className="form-label">E-mail</label>
                                <input
                                    type="email"
                                    required
                                    value={signupData.email}
                                    onChange={e => setSignupData({ ...signupData, email: e.target.value })}
                                    className="login-input"
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="form-label">Senha</label>
                                    <input
                                        type="password"
                                        required
                                        value={signupData.password}
                                        onChange={e => setSignupData({ ...signupData, password: e.target.value })}
                                        className="login-input"
                                        minLength={6}
                                        placeholder="Min. 6"
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Confirmar</label>
                                    <input
                                        type="password"
                                        required
                                        value={signupData.confirmPassword}
                                        onChange={e => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                                        className="login-input"
                                        minLength={6}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={signupLoading}
                                className="btn-primary-b2w"
                                style={{ marginTop: '0.5rem' }}
                            >
                                {signupLoading ? 'Criando Conta...' : 'Cadastrar'}
                            </button>
                        </form>
                    </motion.div>
                </div>
            )}

            {/* Verification Modal */}
            {showVerificationModal && (
                <div style={signupModalStyles.modalOverlay}>
                    <motion.div
                        style={{ ...signupModalStyles.modalContent, textAlign: 'center', maxWidth: '400px' }}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                    >
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
                                setEmail(signupData.email);
                            }}
                            className="btn-primary-b2w"
                        >
                            Voltar para Login
                        </button>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

const signupModalStyles = {
    modalOverlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    },
    modalContent: {
        backgroundColor: 'white', padding: '2rem', borderRadius: '24px',
        width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', position: 'relative'
    },
    closeButton: {
        position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af'
    }
};
