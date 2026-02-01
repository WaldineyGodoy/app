import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchAddressByCep, fetchOfferData } from '../lib/api';
import { supabase } from '../services/supabaseClient';

export default function LandingPage() {
    const [searchParams] = useSearchParams();
    const embaixadorParams = searchParams.get('embaixador') || 'Embaixador';
    const ambassadorId = searchParams.get('ID') || '';

    // Form States
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        cep: '',
        concessionaria: '',
        gasto_medio: 500,
        originator_id: ambassadorId
    });

    const [address, setAddress] = useState(null);
    const [offer, setOffer] = useState(null);
    const [loadingCep, setLoadingCep] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    // Initial message based on ambassador
    const headline = `${embaixadorParams} amigos e clientes são muitos especiais para nós. Como forma de reconhecimento você receberá um desconto em sua conta de energia ao se cadastrar.`;

    const handleCepBlur = async () => {
        const rawCep = formData.cep.replace(/\D/g, '');
        if (rawCep.length >= 8) {
            setLoadingCep(true);
            try {
                const addr = await fetchAddressByCep(rawCep);
                setAddress(addr);

                // If we have IBGE, try to fetch offer
                if (addr && addr.ibge) {
                    const offerData = await fetchOfferData(addr.ibge);
                    if (offerData) {
                        setOffer(offerData);
                        setFormData(prev => ({
                            ...prev,
                            concessionaria: offerData.Concessionaria || ''
                        }));
                    }
                }
            } catch (error) {
                console.error('Erro ao buscar CEP:', error);
                alert('Erro ao buscar CEP: ' + error.message);
            } finally {
                setLoadingCep(false);
            }
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            // Normalize phone for search
            const cleanPhone = formData.phone.replace(/\D/g, '');

            // 1. Check if lead exists
            const { data: existingLead } = await supabase
                .from('leads')
                .select('id, status, originator_id')
                .eq('phone', cleanPhone)
                .maybeSingle();

            // Prepare data for Supabase
            const leadData = {
                name: formData.name,
                email: formData.email,
                phone: cleanPhone, // Use clean phone
                cep: formData.cep,
                rua: address?.rua || '',
                bairro: address?.bairro || '',
                cidade: address?.cidade || '',
                uf: address?.uf || '',
                concessionaria: formData.concessionaria,
                consumo_kwh: Math.round(formData.gasto_medio / (offer?.['Tarifa Concessionaria'] || 0.85)), // Estimate kWh
                gasto_medio: formData.gasto_medio,
                originator_id: formData.originator_id || existingLead?.originator_id, // Keep existing if valid
                status: 'simulacao',
                tarifa_concessionaria: offer?.['Tarifa Concessionaria'],
                desconto_assinante: offer?.['Desconto Assinante']
            };

            let finalLeadId = existingLead?.id;

            if (existingLead) {
                // UPDATE
                const { error } = await supabase
                    .from('leads')
                    .update(leadData)
                    .eq('id', existingLead.id);
                if (error) throw error;
            } else {
                // INSERT
                const { data: newLead, error } = await supabase
                    .from('leads')
                    .insert([leadData])
                    .select()
                    .single();
                if (error) throw error;
                finalLeadId = newLead.id;
            }

            // 2. Notification Logic (If converting from Invite)
            if (existingLead && existingLead.status === 'convite_enviado' && leadData.originator_id) {
                // Fetch Originator Phone
                const { data: originator } = await supabase
                    .from('originators_v2')
                    .select('phone, name')
                    .eq('id', leadData.originator_id)
                    .single();

                if (originator && originator.phone) {
                    const msg = `${formData.name} recebeu seu convite e simulou o desconto.\nAgora é hora de reforçar a adesão.`;
                    // Send to Originator (using imported sendWhatsapp? Need to import it if not present)
                    // We assume sendWhatsapp is available or we import it. 
                    // Wait, LandingPage imports fetchAddressByCep... I need to add sendWhatsapp to imports first.
                    // Doing dynamic import or assuming I added it. 
                    // I will need to update Imports in a separate block or use global if available (unlikely).
                    // I WILL UPDATE IMPORTS IN NEXT STEP TO BE SAFE.
                    // effectively: await sendWhatsapp(originator.phone, msg);
                    await import('../lib/api').then(mod => mod.sendWhatsapp(originator.phone, msg));
                }
            }

            setSuccess(true);
            alert('Cadastro realizado com sucesso! Entraremos em contato.');
        } catch (error) {
            console.error('Erro ao salvar lead:', error);
            alert('Erro ao salvar lead: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="bg-background-light text-slate-900 font-display">
            {/* Nav */}
            <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
                                <span className="material-symbols-outlined text-white text-2xl">solar_power</span>
                            </div>
                            <span className="text-2xl font-extrabold tracking-tight text-secondary">B2W <span className="text-primary font-normal">ENERGIA</span></span>
                        </div>
                        <div className="hidden md:flex items-center space-x-8">
                            <a className="text-sm font-semibold text-secondary hover:text-primary transition-colors" href="#como-funciona">Como Funciona</a>
                            <a className="text-sm font-semibold text-secondary hover:text-primary transition-colors" href="#vantagens">Vantagens</a>
                            <a className="text-sm font-semibold text-secondary hover:text-primary transition-colors" href="#faq">Dúvidas</a>
                            <button className="bg-primary hover:bg-orange-600 text-white px-6 py-2.5 rounded-full font-bold text-sm transition-all shadow-lg shadow-orange-500/20 active:scale-95">
                                SIMULAR AGORA
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative py-16 lg:py-24 overflow-hidden bg-white">
                <div className="absolute inset-0 opacity-5 pointer-events-none">
                    <img alt="Solar Farm background" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD1ZR90QSwA-5AOqcTc32C5Wwzu291cxNUqo8Nzw8Xp_roCv2Sc8eguUyvRZE92QlTbA_xK5raBVnqd7t-9YC3aRDIsc__Co-n9VqbuCGbOP8_GyqV5CCfK72bibx4JiLO1Z14hJaFqIeGChlWfHtU3Me_tMl6jFkiILIX9YfYQ8U4KOJw85b8mz3-D-YxI7jZKVjHultkwvlj9D_OkjUa86IaulKxmXJ93-sO1fBSwkRvg3zB0KU0apNH2Z2-owiPiRLMO2jQYiirb" />
                </div>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 bg-orange-50 text-primary border border-orange-100 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider mb-6">
                                <span className="material-symbols-outlined text-sm">verified</span> CONVITE EXCLUSIVO
                            </div>
                            <h1 className="text-4xl lg:text-5xl font-extrabold text-secondary leading-tight mb-6">
                                <span className="text-primary">{embaixadorParams}</span> acredita que você merece economizar.
                            </h1>
                            <p className="text-xl text-slate-600 mb-8 max-w-xl leading-relaxed">
                                {headline}
                            </p>
                            <div className="flex flex-wrap gap-4 mb-10">
                                <div className="flex items-center gap-2 text-slate-700">
                                    <span className="material-symbols-outlined text-primary">check_circle</span>
                                    <span className="text-sm font-semibold">Sem Custo de Adesão</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-700">
                                    <span className="material-symbols-outlined text-primary">check_circle</span>
                                    <span className="text-sm font-semibold">Sem Fidelidade</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-700">
                                    <span className="material-symbols-outlined text-primary">check_circle</span>
                                    <span className="text-sm font-semibold">Desconto Garantido</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-3xl p-8 shadow-[0_32px_64px_-16px_rgba(0,51,102,0.12)] border border-slate-100">
                            <h3 className="text-2xl font-bold mb-6 text-center text-secondary">Simule sua Economia</h3>
                            <form className="space-y-4" onSubmit={handleSubmit}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Seu CEP</label>
                                        <input
                                            name="cep"
                                            value={formData.cep}
                                            onChange={handleInputChange}
                                            onBlur={handleCepBlur}
                                            className="w-full px-4 py-3 rounded-xl border-slate-200 bg-slate-50 focus:ring-primary focus:border-primary transition-all"
                                            placeholder="00000-000"
                                            type="text"
                                        />
                                        {loadingCep && <span className="text-xs text-primary">Buscando...</span>}
                                        {address && <span className="text-xs text-green-600 block">{address.cidade}-{address.uf}</span>}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Sua Concessionária</label>
                                        <select
                                            name="concessionaria"
                                            value={formData.concessionaria}
                                            onChange={handleInputChange}
                                            className="w-full px-4 py-3 rounded-xl border-slate-200 bg-slate-50 focus:ring-primary focus:border-primary transition-all"
                                        >
                                            <option value="">Selecione...</option>
                                            {offer ? (
                                                <option value={offer.Concessionaria}>{offer.Concessionaria}</option>
                                            ) : (
                                                <>
                                                    <option>CPFL</option>
                                                    <option>Enel</option>
                                                    <option>Cemig</option>
                                                    <option>Energisa</option>
                                                </>
                                            )}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Nome Completo</label>
                                    <input
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border-slate-200 bg-slate-50 focus:ring-primary focus:border-primary transition-all"
                                        placeholder="Como devemos te chamar?"
                                        type="text"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">E-mail</label>
                                    <input
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border-slate-200 bg-slate-50 focus:ring-primary focus:border-primary transition-all"
                                        placeholder="exemplo@email.com"
                                        type="email"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Telefone</label>
                                    <input
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        className="w-full px-4 py-3 rounded-xl border-slate-200 bg-slate-50 focus:ring-primary focus:border-primary transition-all"
                                        placeholder="(00) 00000-0000"
                                        type="tel"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1 flex justify-between">
                                        <span>Gasto médio mensal</span>
                                        <span className="text-primary font-bold">
                                            {Number(formData.gasto_medio).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                    </label>
                                    <input
                                        name="gasto_medio"
                                        type="range"
                                        min="150"
                                        max="5000"
                                        step="50"
                                        value={formData.gasto_medio}
                                        onChange={handleInputChange}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
                                    />
                                    <div className="flex justify-between text-[10px] text-slate-400 mt-1 uppercase font-bold">
                                        <span>R$ 150</span>
                                        <span>R$ 5.000+</span>
                                    </div>
                                </div>

                                {offer && (
                                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                                        <p className="text-green-800 font-bold mb-1">🎉 Oferta Disponível!</p>
                                        <p className="text-sm text-green-700">
                                            Desconto estimado de <span className="font-bold">{(offer['Desconto Assinante'] * 100).toFixed(0)}%</span> na sua fatura.
                                        </p>
                                    </div>
                                )}

                                <button
                                    className="w-full bg-primary hover:bg-orange-600 text-white font-extrabold py-4 rounded-xl transition-all shadow-xl shadow-orange-500/30 text-lg uppercase tracking-wider relative disabled:opacity-70"
                                    type="submit"
                                    disabled={submitting}
                                >
                                    {submitting ? 'Enviando...' : 'Ver Desconto Agora'}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </section>

            {/* ... Rest of sections (kept as static HTML converted to JSX) ... */}
            <section className="py-24 bg-slate-50 overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div className="order-2 lg:order-1 relative flex justify-center">
                            <div className="relative w-[280px] h-[580px] bg-white rounded-[3rem] border-[10px] border-secondary shadow-2xl phone-mockup-shadow overflow-hidden">
                                <div className="h-full w-full bg-white text-slate-900 p-6 pt-12">
                                    <div className="flex justify-between items-center mb-8">
                                        <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                                            <span className="material-symbols-outlined text-white text-sm">solar_power</span>
                                        </div>
                                        <span className="material-symbols-outlined text-slate-400">notifications</span>
                                    </div>
                                    <div className="mb-8">
                                        <p className="text-xs text-slate-400 mb-1">Olá, {formData.name || 'João'}!</p>
                                        <h4 className="text-xl font-bold text-secondary">Sua economia este mês</h4>
                                        <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Total Economizado</p>
                                            <p className="text-3xl font-extrabold text-primary">R$ {((formData.gasto_medio || 500) * (offer ? offer['Desconto Assinante'] : 0.15)).toFixed(2).replace('.', ',')}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ações rápidas</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                                                <span className="material-symbols-outlined text-primary mb-2">analytics</span>
                                                <p className="text-[10px] font-bold text-secondary">Consumo</p>
                                            </div>
                                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                                                <span className="material-symbols-outlined text-primary mb-2">receipt_long</span>
                                                <p className="text-[10px] font-bold text-secondary">Faturas</p>
                                            </div>
                                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                                                <span className="material-symbols-outlined text-primary mb-2">support_agent</span>
                                                <p className="text-[10px] font-bold text-secondary">Suporte</p>
                                            </div>
                                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                                                <span className="material-symbols-outlined text-primary mb-2">share</span>
                                                <p className="text-[10px] font-bold text-secondary">Indicar</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-8">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Em Tempo Real</p>
                                        <div className="flex items-end gap-2 h-16">
                                            <div className="flex-1 bg-slate-100 rounded-t h-[40%]"></div>
                                            <div className="flex-1 bg-slate-100 rounded-t h-[60%]"></div>
                                            <div className="flex-1 bg-primary rounded-t h-[90%]"></div>
                                            <div className="flex-1 bg-slate-100 rounded-t h-[50%]"></div>
                                            <div className="flex-1 bg-slate-100 rounded-t h-[75%]"></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-secondary rounded-b-2xl"></div>
                            </div>
                        </div>
                        <div className="order-1 lg:order-2">
                            <h2 className="text-4xl lg:text-5xl font-extrabold text-secondary mb-8 leading-tight">
                                Tudo 100% Digital no seu <span className="text-primary">Super App</span>
                            </h2>
                            <p className="text-xl text-slate-600 mb-12 leading-relaxed">
                                Gerencie sua energia com a mesma facilidade que você cuida das suas finanças. Uma experiência intuitiva e transparente na palma da sua mão.
                            </p>
                            <ul className="space-y-8">
                                <li className="flex items-start gap-5">
                                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center border border-orange-100">
                                        <span className="material-symbols-outlined text-primary text-2xl">monitoring</span>
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-secondary mb-2">Acompanhe seu consumo em tempo real</h4>
                                        <p className="text-slate-500">Tenha visibilidade total de quanto você está consumindo e economizando a cada minuto.</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-5">
                                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center border border-orange-100">
                                        <span className="material-symbols-outlined text-primary text-2xl">history_edu</span>
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-secondary mb-2">Faturas digitais e histórico completo</h4>
                                        <p className="text-slate-500">Acesse todas as suas contas, comprovantes e histórico de pagamentos de forma organizada.</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-5">
                                    <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center border border-orange-100">
                                        <span className="material-symbols-outlined text-primary text-2xl">chat</span>
                                    </div>
                                    <div>
                                        <h4 className="text-xl font-bold text-secondary mb-2">Atendimento rápido e digital</h4>
                                        <p className="text-slate-500">Suporte especializado para resolver qualquer questão sem filas ou burocracia, direto pelo chat.</p>
                                    </div>
                                </li>
                            </ul>
                            <div className="mt-12 flex flex-wrap gap-4">
                                <img alt="App Store" className="h-10 hover:scale-105 transition-transform cursor-pointer" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCebZgz8nMQO512hGFV17qeZow_l5ND11G5NPnlqal816ADi1b6MvZ2HgSRBDK9DFrgeRbb0HeUOJj1hdHVLyZHxxFlbhrK3-BZml-CeVNn4Zhhd4r6YHLAGKUVOeAp_f5LmdUVlpKTG9yN4JjXxKREECx0tpM4bW0lFwytOpKcK8pL5Oe5gakNQHc6M2GdY_X6DYGSHIpmWQsdwzxyuivrTF_gc9bGA_SpLhZmiptGaCCAn1W-seVUOf8nZd0mXGAst7amoq7ROq9p" />
                                <img alt="Google Play" className="h-10 hover:scale-105 transition-transform cursor-pointer" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCxB5xl2ZoO7hqXAQ-OAFODFtaKzXAVM34k1WOrik9G-VFzHTNr4GMatDVwnLHrXbyHi1lhrWgySFxwWDEcfwOqs1VbmLOotFrjbeEOpu-IrDjfi9usGdiEoe8PwRDtccsz4pmQfgwzFzKZNk_ZKYzX8XavvNEL4Hc2TKchVmislx1dVfvxGWPUI0WtFiqXoTzYfjAX1EGXWEfaeeyxd4PihsO2IytqHAiqsUX_kbbSsVvMpvPcPVUuy5zywp26kn7gbYe8tLim8GRu" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-20 bg-white" id="como-funciona">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <p className="text-primary font-bold uppercase tracking-widest text-sm mb-2">Simples e Transparente</p>
                        <h2 className="text-3xl lg:text-4xl font-extrabold text-secondary">Como funciona a Energia por Assinatura?</h2>
                    </div>
                    <div className="grid md:grid-cols-3 gap-12">
                        <div className="text-center group">
                            <div className="w-20 h-20 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-primary group-hover:scale-110 transition-all">
                                <span className="material-symbols-outlined text-4xl text-primary group-hover:text-white">person_add</span>
                            </div>
                            <h3 className="text-xl font-bold mb-4 text-secondary">1. Assinatura Digital</h3>
                            <p className="text-slate-500 leading-relaxed">Faça seu cadastro 100% online. Sem obras, sem custo de adesão e consultando seu CEP para verificar a concessionária.</p>
                        </div>
                        <div className="text-center group">
                            <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-secondary group-hover:scale-110 transition-all">
                                <span className="material-symbols-outlined text-4xl text-secondary group-hover:text-white">solar_power</span>
                            </div>
                            <h3 className="text-xl font-bold mb-4 text-secondary">2. Geração de Energia</h3>
                            <p className="text-slate-500 leading-relaxed">Nossas usinas solares geram energia limpa e injetam na rede da sua distribuidora em seu nome.</p>
                        </div>
                        <div className="text-center group">
                            <div className="w-20 h-20 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:bg-green-600 group-hover:scale-110 transition-all">
                                <span className="material-symbols-outlined text-4xl text-green-600 group-hover:text-white">receipt_long</span>
                            </div>
                            <h3 className="text-xl font-bold mb-4 text-secondary">3. Duas Faturas</h3>
                            <p className="text-slate-500 leading-relaxed">Você recebe a conta da distribuidora (taxa mínima) e a fatura B2W com a energia injetada e seu desconto garantido.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-20 bg-slate-50" id="vantagens">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <h2 className="text-3xl lg:text-5xl font-extrabold text-secondary mb-6 leading-tight">Por que escolher a <span className="text-primary">B2W Energia?</span></h2>
                            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                                Democratizamos o acesso à energia solar. Atendemos em múltiplos estados com descontos agressivos que reduzem custos operacionais de empresas e despesas familiares.
                            </p>
                            <div className="space-y-6">
                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                                        <span className="material-symbols-outlined text-primary">description</span>
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-secondary">Transparência nas Faturas</h4>
                                        <p className="text-slate-500">Você paga a taxa mínima para a concessionária e a energia consumida para a B2W com desconto.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                                        <span className="material-symbols-outlined text-primary">construction</span>
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-secondary">Zero Investimento</h4>
                                        <p className="text-slate-500">Zero custo de instalação ou manutenção. A responsabilidade técnica é toda nossa.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                                        <span className="material-symbols-outlined text-primary">eco</span>
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-secondary">Energia 100% Limpa</h4>
                                        <p className="text-slate-500">Contribua para o meio ambiente reduzindo a pegada de carbono consumindo de fontes renováveis.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-3xl p-4 lg:p-8 shadow-xl border border-slate-100 overflow-hidden">
                            <h3 className="text-2xl font-bold text-center mb-8 text-secondary">Comparativo Decisivo</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100">
                                            <th className="py-4 text-left font-bold text-slate-400 uppercase tracking-wider">Item</th>
                                            <th className="py-4 text-center font-bold text-slate-400 uppercase tracking-wider">Tradicional</th>
                                            <th className="py-4 text-center font-bold text-primary uppercase tracking-wider">B2W Energia</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <tr>
                                            <td className="py-4 font-medium">Desconto Real</td>
                                            <td className="py-4 text-center"><span className="material-symbols-outlined text-red-500 text-base">close</span></td>
                                            <td className="py-4 text-center"><span className="material-symbols-outlined text-green-500 font-bold text-base">check</span></td>
                                        </tr>
                                        <tr>
                                            <td className="py-4 font-medium">Energia Renovável</td>
                                            <td className="py-4 text-center"><span className="material-symbols-outlined text-red-500 text-base">close</span></td>
                                            <td className="py-4 text-center"><span className="material-symbols-outlined text-green-500 font-bold text-base">check</span></td>
                                        </tr>
                                        <tr>
                                            <td className="py-4 font-medium">Sem Obras/Placas</td>
                                            <td className="py-4 text-center"><span className="material-symbols-outlined text-slate-300 text-base">remove</span></td>
                                            <td className="py-4 text-center"><span className="material-symbols-outlined text-green-500 font-bold text-base">check</span></td>
                                        </tr>
                                        <tr>
                                            <td className="py-4 font-medium">Sem Fidelidade</td>
                                            <td className="py-4 text-center"><span className="material-symbols-outlined text-slate-300 text-base">remove</span></td>
                                            <td className="py-4 text-center"><span className="material-symbols-outlined text-green-500 font-bold text-base">check</span></td>
                                        </tr>
                                        <tr className="bg-orange-50/50">
                                            <td className="py-4 font-bold text-secondary">Até 30% Off</td>
                                            <td className="py-4 text-center"><span className="material-symbols-outlined text-red-500 text-base">close</span></td>
                                            <td className="py-4 text-center"><span className="material-symbols-outlined text-green-500 font-bold text-base">check</span></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <button className="w-full mt-8 bg-primary hover:bg-orange-600 text-white font-extrabold py-4 rounded-xl transition-all shadow-lg shadow-orange-500/20">
                                COMEÇAR AGORA
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-20 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl lg:text-4xl font-extrabold text-secondary">Para Quem é a Energia por Assinatura?</h2>
                    </div>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="rounded-3xl overflow-hidden bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                            <img alt="Apartment building" className="w-full h-48 object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBahFfo2u0ipdm0krN-GQfbF-azRyeDV-02qAbmCZ4pMUq5tzjiXjLS2MMRSFe6F9bvYNx3QbpvsKyBo5-bBflIXDq0oSmvyx3w_wh8iO4NSq2Ba02fXmMt6dR94paAFs-58sMEgfrr6UpNWfKeMKsNFCIvchdSxtDn5ekpnG08xR6YHxAVKX2LRW6Pz6gyEc5oLGtboIN9kui_cNRpQ1ORXwsEsCtwR_QvrL4EjehTrlX6GCXC-6gCQxLKUxi9mGBtPQsAWxia2v78" />
                            <div className="p-6">
                                <h4 className="text-xl font-bold mb-3 text-secondary">Apartamentos e Aluguel</h4>
                                <p className="text-slate-500 text-sm">Perfeito para quem não possui telhado próprio ou espaço físico para instalar placas solares.</p>
                            </div>
                        </div>
                        <div className="rounded-3xl overflow-hidden bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                            <img alt="Small Business" className="w-full h-48 object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC_fWltGW-LOReVYqMomVm4X1McyGsGaRcrpJ7JYImtK7qa4z3SqGRSddV6ypbaW91segAwd2zXrxwyOvlooeohcaf1DuNvFIlhlbJ4cjvDpFvFxApc4ZYxOhfd179kk0lx3gCqBWgZTYsKn6IFvy87GujevcemUoSKJaIFRxdguWQAAfeQT-soxPKmiHdzDosh4FXKyXe76keVgDjnWTlEsYrv_CLRI0k5gYWMWQ_IobXvze82HelMZX0duSMQ7aqGGD_DLnsDPkI3" />
                            <div className="p-6">
                                <h4 className="text-xl font-bold mb-3 text-secondary">Médios Comércios</h4>
                                <p className="text-slate-500 text-sm">Padarias, clínicas e academias que consomem a partir de R$ 500 mensais economizam milhares ao ano.</p>
                            </div>
                        </div>
                        <div className="rounded-3xl overflow-hidden bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                            <img alt="Office Professional" className="w-full h-48 object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA8QhrTefU0sjk2RymA0qrpJWBpD6Gw1RwVHbpPm1RBq6bNu5xd9aDs8LWgK1b4xL_pKgrLxMKh5BJynuClGgOl2w8MT7DzKnh4kPEXaPuq4W1pcaKoWRZrl9HBuj1kUXfd8IT9ZnH9K2YEOLIv4P2ltYSrx362KbBEyy07xcVcbZ4CoWC-Ys3Ku3ZGYBdA37dADkSjqxXhPg9ldBT1i-fn-TSh4f7wW9hmOuhQC6sASZctaXaRIeqjnP3nMQx2lRbW1KMlUvZEfh3J" />
                            <div className="p-6">
                                <h4 className="text-xl font-bold mb-3 text-secondary">Escritórios e Clínicas</h4>
                                <p className="text-slate-500 text-sm">Profissionais liberais que buscam previsibilidade financeira e um selo de sustentabilidade para sua marca.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-20 bg-slate-50" id="faq">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-extrabold text-secondary mb-4">Dúvidas Frequentes</h2>
                        <p className="text-slate-500">Tudo o que você precisa saber para começar a economizar hoje mesmo.</p>
                    </div>
                    <div className="space-y-4">
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                            <button className="flex justify-between items-center w-full text-left font-bold text-secondary group">
                                <span>Onde o serviço está disponível?</span>
                                {/* Note: Expanded accordion logic can be added later if needed */}
                                <span className="material-symbols-outlined text-primary group-hover:rotate-180 transition-transform">expand_more</span>
                            </button>
                            <div className="mt-4 text-slate-500 text-sm leading-relaxed">
                                Atendemos atualmente em SP (CPFL Paulista), RN (Cosern), RJ (Enel), PR (Copel), MT (Energisa), MS (Energisa), MG (Cemig) e GO (Equatorial). Em breve em todo o Brasil.
                            </div>
                        </div>
                        {/* Other FAQ items */}
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                            <button className="flex justify-between items-center w-full text-left font-bold text-secondary group">
                                <span>Preciso instalar placas solares?</span>
                                <span className="material-symbols-outlined text-primary">expand_more</span>
                            </button>
                        </div>
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                            <button className="flex justify-between items-center w-full text-left font-bold text-secondary group">
                                <span>Existe fidelidade no contrato?</span>
                                <span className="material-symbols-outlined text-primary">expand_more</span>
                            </button>
                        </div>
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                            <button className="flex justify-between items-center w-full text-left font-bold text-secondary group">
                                <span>Qual o valor real do desconto?</span>
                                <span className="material-symbols-outlined text-primary">expand_more</span>
                            </button>
                        </div>
                    </div>
                    <div className="mt-16 text-center">
                        <p className="text-slate-500 mb-6 font-medium">Ainda tem dúvidas? Fale com um especialista.</p>
                        <a className="inline-flex items-center gap-3 bg-[#25D366] hover:bg-[#128C7E] text-white px-8 py-4 rounded-full font-bold shadow-xl shadow-green-500/20 transition-all hover:scale-105" href="#">
                            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.588-5.946 0-6.556 5.332-11.888 11.888-11.888 3.176 0 6.161 1.237 8.404 3.48s3.481 5.229 3.481 8.406c0 6.556-5.333 11.888-11.889 11.888-2.013 0-3.988-.511-5.741-1.483l-6.242 1.638zm6.205-3.606c1.554.921 3.16 1.398 4.773 1.398 5.232 0 9.491-4.259 9.491-9.492 0-2.535-.987-4.918-2.778-6.709s-4.174-2.779-6.709-2.779c-5.235 0-9.494 4.259-9.494 9.492 0 1.954.597 3.824 1.725 5.41l-.953 3.479 3.56-.933zm11.237-7.234c-.08-.133-.293-.213-.612-.373-.319-.16-.1.889-.2.213-.08-.133-.186-.266-.319-.346-.133-.08-.426-.213-.853-.426-.426-.213-.692-.319-.773-.426-.08-.106-.08-.186 0-.293.08-.106.346-.426.479-.586.133-.16.186-.266.293-.426.106-.16.053-.293-.027-.426-.08-.133-.692-1.678-.947-2.288-.248-.594-.503-.513-.692-.523-.178-.01-.383-.01-.586-.01s-.532.08-.813.386c-.28.306-1.077 1.052-1.077 2.564s1.091 2.978 1.24 3.178c.15.199 2.146 3.279 5.198 4.597 3.052 1.318 3.052.879 3.604.826.552-.053 1.78-.727 2.031-1.428.25-.701.25-1.303.174-1.428z"></path></svg>
                            (31) 99536-7744
                        </a>
                    </div>
                </div>
            </section>

            <footer className="bg-secondary text-white py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid md:grid-cols-4 gap-12 mb-12">
                        <div className="col-span-1 md:col-span-1">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                                    <span className="material-symbols-outlined text-white text-xl">solar_power</span>
                                </div>
                                <span className="text-xl font-extrabold tracking-tight">B2W <span className="text-primary font-normal">ENERGIA</span></span>
                            </div>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                A B2W Energia democratiza o acesso à energia limpa. Economia garantida sem obras e sem burocracia para sua casa ou empresa.
                            </p>
                        </div>
                        <div>
                            <h5 className="font-bold mb-6 uppercase text-xs tracking-widest text-primary">Navegação</h5>
                            <ul className="space-y-4 text-sm text-slate-400">
                                <li><a className="hover:text-white transition-colors" href="#como-funciona">Como Funciona</a></li>
                                <li><a className="hover:text-white transition-colors" href="#vantagens">Vantagens</a></li>
                                <li><a className="hover:text-white transition-colors" href="#">Simulador</a></li>
                                <li><a className="hover:text-white transition-colors" href="#faq">Dúvidas Frequentes</a></li>
                            </ul>
                        </div>
                        {/* ... Other footer columns ... */}
                    </div>
                    <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 gap-4">
                        <p>© 2024 B2W Energia. Todos os direitos reservados.</p>
                        <div className="flex gap-4">
                            <a className="hover:text-white" href="#">Instagram</a>
                            <a className="hover:text-white" href="#">Facebook</a>
                            <a className="hover:text-white" href="#">LinkedIn</a>
                        </div>
                        <p>Feito com energia ☀️</p>
                    </div>
                </div>
            </footer>
            <a className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all" href="https://wa.me/5531995367744" target="_blank" rel="noreferrer">
                <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.588-5.946 0-6.556 5.332-11.888 11.888-11.888 3.176 0 6.161 1.237 8.404 3.48s3.481 5.229 3.481 8.406c0 6.556-5.333 11.888-11.889 11.888-2.013 0-3.988-.511-5.741-1.483l-6.242 1.638zm6.205-3.606c1.554.921 3.16 1.398 4.773 1.398 5.232 0 9.491-4.259 9.491-9.492 0-2.535-.987-4.918-2.778-6.709s-4.174-2.779-6.709-2.779c-5.235 0-9.494 4.259-9.494 9.492 0 1.954.597 3.824 1.725 5.41l-.953 3.479 3.56-.933zm11.237-7.234c-.08-.133-.293-.213-.612-.373-.319-.16-.1.889-.2.213-.08-.133-.186-.266-.319-.346-.133-.08-.426-.213-.853-.426-.426-.213-.692-.319-.773-.426-.08-.106-.08-.186 0-.293.08-.106.346-.426.479-.586.133-.16.186-.266.293-.426.106-.16.053-.293-.027-.426-.08-.133-.692-1.678-.947-2.288-.248-.594-.503-.513-.692-.523-.178-.01-.383-.01-.586-.01s-.532.08-.813.386c-.28.306-1.077 1.052-1.077 2.564s1.091 2.978 1.24 3.178c.15.199 2.146 3.279 5.198 4.597 3.052 1.318 3.052.879 3.604.826.552-.053 1.78-.727 2.031-1.428.25-.701.25-1.303.174-1.428z"></path></svg>
            </a>
        </div>
    );
}
