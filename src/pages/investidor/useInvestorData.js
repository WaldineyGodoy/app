import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { cents } from './format';

/**
 * supabase-js não lança em erro de banco — devolve { data, error }.
 * Toda chamada aqui passa por isto para que uma falha vire estado de erro visível
 * em vez de uma tela vazia que parece "sem dados".
 */
const unwrap = (label, { data, error }) => {
    if (error) throw new Error(`${label}: ${error.message}`);
    return data;
};

const CONTA_REPASSE = '2.1.1';

/**
 * Franquia é capacidade contratada, então ela fica ocupada desde o vínculo —
 * inclusive enquanto a UC aguarda conexão, e inclusive com o assinante em atraso
 * (a UC segue conectada e compensando; quem está atrasado é o pagamento).
 * Só três estados devolvem a capacidade para a usina.
 */
const STATUS_LIBERAM_FRANQUIA = new Set(['desconectado', 'cancelado', 'cancelado_inadimplente']);
const ocupaFranquia = (uc) => !STATUS_LIBERAM_FRANQUIA.has(uc.status);

/** Quantos meses de fatura carregar para apurar o consumo compensado. */
const MESES_DE_APURACAO = 18;

export function useInvestorData(user) {
    const [state, setState] = useState({
        loading: true,
        error: null,
        supplier: null,
        usinas: [],
        cycles: [],
        entries: [],
        balance: null,
        autoRedeem: false,
        fetchedAt: null,
    });

    const load = useCallback(async () => {
        if (!user) return;
        setState((s) => ({ ...s, loading: true, error: null }));

        try {
            // 1. Fornecedor: por user_id, com fallback para e-mail (e vínculo automático).
            let supplier = unwrap('fornecedor', await supabase
                .from('suppliers').select('*').eq('user_id', user.id).maybeSingle());

            if (!supplier && user.email) {
                supplier = unwrap('fornecedor por e-mail', await supabase
                    .from('suppliers').select('*').eq('email', user.email).limit(1).maybeSingle());
                if (supplier && !supplier.user_id) {
                    unwrap('vínculo do fornecedor', await supabase
                        .from('suppliers').update({ user_id: user.id }).eq('id', supplier.id));
                }
            }

            if (!supplier) {
                setState({
                    loading: false, error: null, supplier: null, usinas: [], cycles: [],
                    entries: [], balance: null, autoRedeem: false, fetchedAt: new Date(),
                });
                return;
            }

            // 2. Usinas do fornecedor.
            const usinasRaw = unwrap('usinas', await supabase
                .from('usinas').select('*').eq('supplier_id', supplier.id).order('name')) || [];
            const usinaIds = usinasRaw.map((u) => u.id);

            // 3, 4, 5, 6 em paralelo — nenhuma depende da outra.
            const [ucs, cyclesRaw, entriesRaw, config] = await Promise.all([
                usinaIds.length
                    ? supabase.from('consumer_units')
                        .select('id, usina_id, tipo_unidade, status, franquia, numero_uc, dia_leitura, data_ativacao')
                        .in('usina_id', usinaIds).then((r) => unwrap('unidades consumidoras', r))
                    : Promise.resolve([]),
                usinaIds.length
                    ? supabase.from('generation_production')
                        .select('*').in('usina_id', usinaIds)
                        .order('mes_referencia', { ascending: true })
                        .then((r) => unwrap('ciclos de fechamento', r))
                    : Promise.resolve([]),
                supabase.from('view_ledger_enriched')
                    .select('*')
                    .eq('account_code', CONTA_REPASSE)
                    .or(`reference_id.eq.${supplier.id},supplier_id.eq.${supplier.id}`)
                    .order('created_at', { ascending: true })
                    .then((r) => unwrap('extrato', r)),
                // A policy de `integrations_config` é admin-only, então o fornecedor
                // não lê esta linha. É config acessória: falhar aqui não pode derrubar
                // o painel — no pior caso o resgate automático fica desligado.
                supabase.from('integrations_config')
                    .select('variables').eq('service_name', 'financial_api').maybeSingle()
                    .then(({ data, error }) => (error ? null : data)),
            ]);

            // Agrega as UCs por usina.
            const porUsina = new Map(usinaIds.map((id) => [id, { benef: [], geradora: null }]));
            for (const uc of ucs || []) {
                const bucket = porUsina.get(uc.usina_id);
                if (!bucket) continue;
                if (uc.tipo_unidade === 'geradora') bucket.geradora = uc;
                else bucket.benef.push(uc);
            }

            // Consumo efetivamente compensado, apurado das faturas das beneficiárias.
            // A coluna `generation_production.energia_compensada` foi medida contra estas
            // faturas em 10/08/2026 e vem subestimada (abr/26: 3.761 gravados contra
            // 10.853 apurados), então a apuração vem daqui, não da coluna.
            const idsBenef = (ucs || [])
                .filter((uc) => uc.tipo_unidade !== 'geradora').map((uc) => uc.id);
            const desde = new Date();
            desde.setMonth(desde.getMonth() - MESES_DE_APURACAO);

            const faturas = idsBenef.length
                ? unwrap('faturas das beneficiárias', await supabase
                    .from('invoices')
                    .select('uc_id, mes_referencia, consumo_compensado, status')
                    .in('uc_id', idsBenef)
                    .gte('mes_referencia', desde.toISOString().slice(0, 10))) || []
                : [];

            const usinaDaUc = new Map((ucs || []).map((uc) => [uc.id, uc.usina_id]));
            // chave `${usina_id}|${mes}` → { kwh, ucs }
            const compensado = new Map();
            for (const f of faturas) {
                if (f.status === 'cancelado' || f.consumo_compensado === null) continue;
                const chave = `${usinaDaUc.get(f.uc_id)}|${f.mes_referencia}`;
                const atual = compensado.get(chave) || { kwh: 0, ucs: 0 };
                atual.kwh += Number(f.consumo_compensado) || 0;
                atual.ucs += 1;
                compensado.set(chave, atual);
            }

            const usinas = usinasRaw.map((u) => {
                const bucket = porUsina.get(u.id) || { benef: [], geradora: null };
                const ativas = bucket.benef.filter(ocupaFranquia);
                const comprometido = ativas.reduce((acc, uc) => acc + (Number(uc.franquia) || 0), 0);
                const previsto = Number(u.geracao_estimada_kwh) || 0;
                const ciclos = (cyclesRaw || []).filter((c) => c.usina_id === u.id);
                const ultimoApurado = [...ciclos].reverse()
                    .find((c) => Number(c.geracao_mensal_kwh) > 0) || null;

                const apuracao = ultimoApurado
                    ? compensado.get(`${u.id}|${ultimoApurado.mes_referencia}`) : null;

                // UCs que passaram a ocupar franquia depois do último ciclo apurado.
                // O consumo delas não entrou naquela medição, então comparar a
                // franquia de hoje com aquele mês subestima a ocupação.
                const entrantes = ultimoApurado
                    ? ativas.filter((uc) => uc.data_ativacao
                        && uc.data_ativacao > ultimoApurado.mes_referencia)
                    : [];

                return {
                    ...u,
                    ucsBeneficiarias: bucket.benef.length,
                    ucsAtivas: ativas.length,
                    geradora: bucket.geradora,
                    comprometido,
                    ocupacao: previsto > 0 ? (comprometido / previsto) * 100 : null,
                    ultimoApurado,
                    // Base da conferência de overbook: a franquia é declaração, isto é medição.
                    compensadoUltimo: apuracao ? apuracao.kwh : null,
                    ucsComFatura: apuracao ? apuracao.ucs : 0,
                    entrantes: entrantes.length,
                    franquiaEntrantes: entrantes.reduce((a, uc) => a + (Number(uc.franquia) || 0), 0),
                    ciclos: ciclos.length,
                };
            });

            // Ciclos: um cartão por (usina, mês), do mais recente para o mais antigo.
            const nomePorUsina = new Map(usinasRaw.map((u) => [u.id, u.name]));
            const cycles = (cyclesRaw || [])
                .map((c) => {
                    const ap = compensado.get(`${c.usina_id}|${c.mes_referencia}`);
                    return {
                        ...c,
                        usinaNome: nomePorUsina.get(c.usina_id) || '—',
                        compensadoApurado: ap ? ap.kwh : null,
                        ucsComFatura: ap ? ap.ucs : 0,
                    };
                })
                .sort((a, b) => (a.mes_referencia < b.mes_referencia ? 1 : -1));

            // Extrato. Convenção do razão: débito do passivo 2.1.1 é positivo (reduz o que
            // se deve ao fornecedor). Para o investidor isso é o inverso — daí o sinal trocado.
            // O razão guarda valores com mais de duas casas (há linhas com três).
            // O acumulado corre em precisão cheia e só arredonda na exibição —
            // arredondar a cada passo faria o saldo derivar do total real.
            const limpos = (entriesRaw || []).filter((e) => e.is_sandbox !== true);
            let corrente = 0;
            const entries = limpos.map((e) => {
                const efeito = -Number(e.amount || 0); // + crédito ao investidor, − débito
                corrente += efeito;
                return { ...e, efeito, saldoCorrente: corrente };
            }).reverse();

            const creditos = limpos.filter((e) => Number(e.amount) < 0);
            const debitos = limpos.filter((e) => Number(e.amount) > 0);

            setState({
                loading: false,
                error: null,
                supplier,
                usinas,
                cycles,
                entries,
                balance: {
                    total: cents(corrente),
                    creditos: cents(creditos.reduce((a, e) => a - Number(e.amount), 0)),
                    debitos: cents(debitos.reduce((a, e) => a + Number(e.amount), 0)),
                    nCreditos: creditos.length,
                    nDebitos: debitos.length,
                    ultimoLancamento: limpos.length ? limpos[limpos.length - 1].created_at : null,
                },
                autoRedeem: Boolean(config?.variables?.allow_auto_redemption),
                fetchedAt: new Date(),
            });
        } catch (err) {
            setState((s) => ({ ...s, loading: false, error: err.message || String(err) }));
        }
    }, [user]);

    useEffect(() => { load(); }, [load]);

    return { ...state, reload: load };
}
