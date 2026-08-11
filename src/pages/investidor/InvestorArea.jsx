import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useInvestorData } from './useInvestorData';
import InvestorPanel from './InvestorPanel';
import './investor.css';

export default function InvestorArea() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const dados = useInvestorData(user);
    const { loading, error, supplier, balance, reload } = dados;

    const [enviando, setEnviando] = useState(false);
    const [aviso, setAviso] = useState(null);

    useEffect(() => {
        if (!aviso) return undefined;
        const t = setTimeout(() => setAviso(null), 6000);
        return () => clearTimeout(t);
    }, [aviso]);

    const sair = async () => {
        await signOut();
        navigate('/login');
    };

    const resgatar = async (valor) => {
        const saldo = balance?.total ?? 0;
        if (!(valor > 0) || valor > saldo) {
            setAviso({ tom: 'error', texto: 'Valor de resgate inválido para o saldo disponível.' });
            return;
        }
        setEnviando(true);
        // supabase-js devolve { data, error } — a falha precisa ser lida, não engolida.
        const { data, error: fnError } = await supabase.functions.invoke('transfer-asaas-pix', {
            body: {
                amount: valor,
                value: valor,
                pixKey: supplier.pix_key,
                pix_key: supplier.pix_key,
                pixKeyType: supplier.pix_key_type,
                pix_key_type: supplier.pix_key_type,
                supplierId: supplier.id,
                destinationType: 'supplier',
                description: `Resgate investidor: ${supplier.name}`,
                operationType: 'PIX',
            },
        });
        setEnviando(false);

        if (fnError || data?.success === false) {
            setAviso({
                tom: 'error',
                texto: `O resgate não foi enviado: ${fnError?.message || data?.error || 'erro desconhecido'}`,
            });
            return;
        }
        setAviso({
            tom: 'ok',
            texto: 'Resgate solicitado. O crédito aparece no extrato quando o banco confirmar.',
        });
        reload();
    };

    if (loading) {
        return (
            <div className="iv-root">
                <div className="iv-shell iv-boot">
                    <span className="iv-label">Lendo os medidores</span>
                    <span className="iv-boot-bar"><span /></span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="iv-root">
                <div className="iv-shell iv-boot">
                    <div className="iv-error" style={{ maxWidth: '34rem' }}>
                        Não foi possível carregar seus dados — {error}
                    </div>
                    <button type="button" className="iv-ghost" onClick={reload}>Tentar de novo</button>
                </div>
            </div>
        );
    }

    if (!supplier) {
        return (
            <div className="iv-root">
                <div className="iv-shell iv-boot">
                    <div className="iv-empty" style={{ maxWidth: '38rem' }}>
                        <strong>Conta sem usina vinculada</strong>
                        O acesso <span className="iv-figure">{user?.email}</span> ainda não está ligado a um
                        cadastro de investidor. Fale com a B2W para vincular suas usinas a este login.
                    </div>
                    <button type="button" className="iv-ghost" onClick={sair}>Sair</button>
                </div>
            </div>
        );
    }

    return (
        <InvestorPanel
            {...dados}
            onReload={reload}
            onSignOut={sair}
            onRedeem={resgatar}
            enviando={enviando}
            aviso={aviso}
        />
    );
}
