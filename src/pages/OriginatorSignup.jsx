import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchAddressByCep } from '../lib/api';
import { useUI } from '../contexts/UIContext';
import { useNavigate } from 'react-router-dom';

import { Eye, EyeOff, CheckCircle2, UserPlus, MapPin, Briefcase, CreditCard } from 'lucide-react';
import './OriginatorSignup.css';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-boundary-container">
                    <h2>Algo deu errado.</h2>
                    <details style={{ whiteSpace: 'pre-wrap' }}>
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </details>
                </div>
            );
        }

        return this.props.children;
    }
}

function OriginatorSignupContent() {
    const { showAlert } = useUI();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1: SignUp, 2: Profile, 3: Success
    const [userId, setUserId] = useState(null);

    React.useEffect(() => {
        console.log("DEBUG: OriginatorSignupContent Mounted v1.2 (App Repo)");
    }, []);

    const [form, setForm] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        cep: '',
        uf: '',
        city: '',
        neighborhood: '',
        street: '',
        number: '',
        complement: '',
        profession: '',
        cpf: '',
        pix_key: '',
        pix_key_type: 'cpf'
    });

    const [showPassword, setShowPassword] = useState(false);

    const handleCepBlur = async () => {
        const rawCep = form.cep.replace(/\D/g, '');
        if (rawCep.length === 8) {
            setLoading(true);
            try {
                const addr = await fetchAddressByCep(rawCep);
                setForm(prev => ({
                    ...prev,
                    street: addr.rua,
                    neighborhood: addr.bairro,
                    city: addr.cidade,
                    uf: addr.uf
                }));
            } catch (error) {
                console.error('Error fetching CEP:', error);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signUp({
                email: form.email,
                password: form.password,
                options: {
                    data: {
                        name: form.name,
                        phone: form.phone,
                        role: 'originator'
                    }
                }
            });

            if (error) throw error;

            if (data?.user) {
                setUserId(data.user.id);
                setStep(2);
            }

        } catch (error) {
            console.error('Error signing up:', error);
            showAlert(error.message || 'Erro ao realizar cadastro.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                id: userId,
                name: form.name,
                email: form.email,
                phone: form.phone,
                cpf_cnpj: form.cpf,
                pix_key: form.pix_key,
                pix_key_type: form.pix_key_type,
                profession: form.profession,
                address: {
                    cep: form.cep,
                    street: form.street,
                    number: form.number,
                    neighborhood: form.neighborhood,
                    city: form.city,
                    uf: form.uf,
                    complement: form.complement
                }
            };

            const { error } = await supabase.from('originators_v2').insert(payload);
            if (error) throw error;
            setStep(3);
        } catch (error) {
            console.error('Error saving profile:', error);
            showAlert(error.message || 'Erro ao salvar perfil.', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (step === 1) {
        return (
            <div className="signup-page-container">
                <div className="signup-wrapper">
                    <h2 className="signup-header">Seja um Parceiro B2W</h2>
                    <form onSubmit={handleSignUp} className="signup-form-space">
                        <div>
                            <label className="signup-label">Nome Completo</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                className="signup-input"
                                required
                                placeholder="Seu nome completo"
                            />
                        </div>
                        <div className="signup-grid">
                            <div>
                                <label className="signup-label">E-mail</label>
                                <input
                                    type="email"
                                    value={form.email}
                                    onChange={e => setForm({ ...form, email: e.target.value })}
                                    className="signup-input"
                                    required
                                    placeholder="seu@email.com"
                                />
                            </div>
                            <div>
                                <label className="signup-label">WhatsApp</label>
                                <input
                                    type="tel"
                                    maxLength="15"
                                    value={form.phone}
                                    onChange={e => {
                                        let v = e.target.value.replace(/\D/g, '');
                                        v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
                                        v = v.replace(/(\d)(\d{4})$/, '$1-$2');
                                        setForm({ ...form, phone: v });
                                    }}
                                    className="signup-input"
                                    required
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <label className="signup-label">Senha</label>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={form.password}
                                onChange={e => setForm({ ...form, password: e.target.value })}
                                className="signup-input"
                                style={{ paddingRight: '3.5rem' }}
                                required
                                minLength={6}
                                placeholder="No mínimo 6 caracteres"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '1.25rem',
                                    top: '2.4rem',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--text-muted)',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        <button type="submit" disabled={loading} className="signup-button">
                            {loading ? 'Cadastrando...' : 'Quero ser Parceiro'}
                        </button>
                        <div className="signup-footer">
                            <span>Já tem conta?</span>
                            <a href="/login">Fazer Login</a>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="signup-page-container">
            <div className="signup-wrapper">
                {step === 2 && (
                    <form onSubmit={handleProfileSubmit} className="signup-form-space">
                        <h3 className="signup-header" style={{ marginBottom: '1.5rem', fontSize: '1.5rem', textAlign: 'left' }}>Complete seu Perfil</h3>

                        <div className="signup-grid">
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label className="signup-label">CEP</label>
                                <input
                                    type="text"
                                    maxLength="9"
                                    value={form.cep}
                                    onChange={e => {
                                        let v = e.target.value.replace(/\D/g, '');
                                        if (v.length > 5) v = v.replace(/^(\d{5})(\d)/, '$1-$2');
                                        setForm({ ...form, cep: v });
                                    }}
                                    onBlur={handleCepBlur}
                                    className="signup-input"
                                    required
                                    placeholder="00000-000"
                                />
                            </div>
                        </div>

                        <div className="signup-grid">
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label className="signup-label">Rua</label>
                                <input value={form.street} className="signup-input" readOnly />
                            </div>

                            <div>
                                <label className="signup-label">Bairro</label>
                                <input value={form.neighborhood} className="signup-input" readOnly />
                            </div>

                            <div>
                                <label className="signup-label">Cidade / UF</label>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <input value={form.city} className="signup-input" style={{ flex: 2 }} readOnly />
                                    <input value={form.uf} className="signup-input" style={{ flex: 1 }} readOnly />
                                </div>
                            </div>

                            <div>
                                <label className="signup-label">Número</label>
                                <input
                                    value={form.number}
                                    onChange={e => setForm({ ...form, number: e.target.value })}
                                    className="signup-input"
                                    required
                                    placeholder="123"
                                />
                            </div>
                            <div>
                                <label className="signup-label">Complemento</label>
                                <input
                                    value={form.complement}
                                    onChange={e => setForm({ ...form, complement: e.target.value })}
                                    className="signup-input"
                                    placeholder="Ap 101, Bloco B"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="signup-label">Profissão</label>
                            <input
                                type="text"
                                value={form.profession}
                                onChange={e => setForm({ ...form, profession: e.target.value })}
                                className="signup-input"
                                required
                                placeholder="Ex: Corretor de Seguros, Contador..."
                            />
                        </div>

                        <div className="signup-grid">
                            <div>
                                <label className="signup-label">CPF (Chave PIX)</label>
                                <input
                                    type="text"
                                    value={form.cpf}
                                    onChange={e => {
                                        let v = e.target.value.replace(/\D/g, '');
                                        if (v.length > 11) v = v.substring(0, 11);
                                        v = v.replace(/(\d{3})(\d)/, '$1.$2');
                                        v = v.replace(/(\d{3})(\d)/, '$1.$2');
                                        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');

                                        setForm(prev => ({
                                            ...prev,
                                            cpf: v,
                                            pix_key: prev.pix_key_type === 'cpf' ? v : prev.pix_key
                                        }));
                                    }}
                                    className="signup-input"
                                    required
                                    placeholder="000.000.000-00"
                                />
                            </div>
                            <div>
                                <label className="signup-label">Tipo Chave PIX</label>
                                <select
                                    value={form.pix_key_type}
                                    onChange={e => {
                                        const newType = e.target.value;
                                        setForm(prev => ({
                                            ...prev,
                                            pix_key_type: newType,
                                            pix_key: newType === 'cpf' ? prev.cpf : ''
                                        }));
                                    }}
                                    className="signup-input"
                                >
                                    <option value="cpf">CPF</option>
                                    <option value="email">E-mail</option>
                                    <option value="phone">Telefone</option>
                                    <option value="random">Aleatória</option>
                                </select>
                            </div>
                        </div>

                        {form.pix_key_type !== 'cpf' && (
                            <div>
                                <label className="signup-label">Chave PIX</label>
                                <input
                                    value={form.pix_key}
                                    onChange={e => setForm({ ...form, pix_key: e.target.value })}
                                    className="signup-input"
                                    required
                                    placeholder="Sua chave PIX"
                                />
                            </div>
                        )}

                        <button type="submit" disabled={loading} className="signup-button">
                            {loading ? 'Salvando...' : 'Finalizar Cadastro'}
                        </button>
                    </form>
                )}

                {step === 3 && (
                    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                        <div className="signup-success-icon">
                            <CheckCircle2 size={48} />
                        </div>
                        <h3 className="signup-header" style={{ marginBottom: '1rem' }}>Cadastro Realizado!</h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', fontWeight: 500 }}>
                            Seu cadastro foi realizado com sucesso. Agora você já pode acessar sua conta.
                        </p>
                        <button
                            onClick={() => navigate('/login')}
                            className="signup-button"
                        >
                            Ir para Login
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function OriginatorSignup() {
    return (
        <ErrorBoundary>
            <OriginatorSignupContent />
        </ErrorBoundary>
    );
}
