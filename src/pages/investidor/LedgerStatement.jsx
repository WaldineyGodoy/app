import React, { useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { money, moneyAbs, dateShort, dateTime } from './format';

const TIPOS = [
    { id: 'todos', rotulo: 'Tudo' },
    { id: 'credito', rotulo: 'Créditos' },
    { id: 'debito', rotulo: 'Débitos' },
];

/**
 * Nomes de conta em linguagem do investidor, não do plano de contas.
 * `sinal` amarra o rótulo ao efeito real: existem lançamentos com descrição de
 * crédito e valor de débito, e chamá-los de crédito seria mentir sobre o extrato.
 */
const HISTORICO = [
    [/repasse investidor|kwh compensados/i, 'Energia compensada nos assinantes', 1],
    [/transferência|transferencia|pix/i, 'Resgate por PIX', -1],
    [/arrendamento/i, 'Arrendamento do terreno', -1],
    [/serviços|servicos/i, 'Serviços da usina', -1],
    [/ajuste/i, 'Ajuste de conta', 0],
];

const humanize = (descricao, efeito) => {
    if (!descricao) return 'Lançamento';
    const sinal = efeito > 0 ? 1 : efeito < 0 ? -1 : 0;
    const achado = HISTORICO.find(([re, , esperado]) => re.test(descricao)
        && (esperado === 0 || esperado === sinal));
    return achado ? achado[1] : descricao.trim();
};

/**
 * A descrição crua só vira subtítulo quando o título foi reescrito. Boa parte
 * dos lançamentos já vem legível do razão ("Fulano - UC 70299... - 753 Kwh"),
 * e repetir a mesma frase duas vezes é ruído.
 */
const detalhe = (descricao, titulo) => {
    const cru = (descricao || '').trim();
    return cru && cru !== titulo ? cru : null;
};

const toCsv = (entries) => {
    const linhas = [['data', 'historico', 'descricao_original', 'credito', 'debito', 'saldo']];
    entries.forEach((e) => {
        linhas.push([
            dateShort(e.created_at),
            humanize(e.description, e.efeito),
            (e.description || '').replace(/[\r\n;]/g, ' ').trim(),
            e.efeito > 0 ? e.efeito.toFixed(2) : '',
            e.efeito < 0 ? Math.abs(e.efeito).toFixed(2) : '',
            e.saldoCorrente.toFixed(2),
        ]);
    });
    return linhas.map((l) => l.join(';')).join('\n');
};

export default function LedgerStatement({ entries, supplierName }) {
    const [de, setDe] = useState('');
    const [ate, setAte] = useState('');
    const [tipo, setTipo] = useState('todos');
    const [aberto, setAberto] = useState(null);
    const [composicao, setComposicao] = useState([]);
    const [carregandoComposicao, setCarregandoComposicao] = useState(false);

    const filtradas = useMemo(() => entries.filter((e) => {
        if (de && new Date(e.created_at) < new Date(`${de}T00:00:00`)) return false;
        if (ate && new Date(e.created_at) > new Date(`${ate}T23:59:59`)) return false;
        if (tipo === 'credito' && e.efeito <= 0) return false;
        if (tipo === 'debito' && e.efeito >= 0) return false;
        return true;
    }), [entries, de, ate, tipo]);

    const abrir = async (entry) => {
        if (aberto === entry.id) { setAberto(null); return; }
        setAberto(entry.id);
        setComposicao([]);
        if (!entry.transaction_id) return;
        setCarregandoComposicao(true);
        const { data, error } = await supabase
            .from('view_ledger_enriched')
            .select('id, account_code, account_name, description, amount')
            .eq('transaction_id', entry.transaction_id);
        setCarregandoComposicao(false);
        if (error) { setComposicao([{ erro: error.message }]); return; }
        setComposicao(data || []);
    };

    const baixarCsv = () => {
        const blob = new Blob([`﻿${toCsv(filtradas)}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `extrato-${(supplierName || 'investidor').toLowerCase().replace(/\W+/g, '-')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="iv-statement">
            <div className="iv-statement-tools">
                <label className="iv-field">
                    <span className="iv-label">De</span>
                    <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
                </label>
                <label className="iv-field">
                    <span className="iv-label">Até</span>
                    <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
                </label>
                <label className="iv-field">
                    <span className="iv-label">Mostrar</span>
                    <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                        {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
                    </select>
                </label>
                <span style={{ flex: 1 }} />
                <button type="button" className="iv-ghost" onClick={baixarCsv}>
                    Baixar CSV
                </button>
            </div>

            {filtradas.length === 0 ? (
                <div className="iv-empty">
                    <strong>Sem lançamentos no período</strong>
                    Ajuste as datas ou volte quando o próximo ciclo fechar.
                </div>
            ) : (
                <div className="iv-statement-scroll">
                    <table>
                        <caption className="visually-hidden" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                            Extrato de recebíveis do investidor
                        </caption>
                        <thead>
                            <tr>
                                <th scope="col">Data</th>
                                <th scope="col">Histórico</th>
                                <th scope="col" className="iv-num">Crédito</th>
                                <th scope="col" className="iv-num">Débito</th>
                                <th scope="col" className="iv-num">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtradas.map((e) => (
                                <React.Fragment key={e.id}>
                                    <tr
                                        className="iv-row"
                                        aria-expanded={aberto === e.id}
                                        tabIndex={0}
                                        onClick={() => abrir(e)}
                                        onKeyDown={(ev) => {
                                            if (ev.key === 'Enter' || ev.key === ' ') {
                                                ev.preventDefault();
                                                abrir(e);
                                            }
                                        }}
                                    >
                                        <td className="iv-figure" style={{ whiteSpace: 'nowrap' }}>
                                            {dateShort(e.created_at)}
                                        </td>
                                        <td>
                                            {(() => {
                                                const titulo = humanize(e.description, e.efeito);
                                                const sub = detalhe(e.description, titulo);
                                                return (
                                                    <>
                                                        <span className="iv-row-desc">{titulo}</span>
                                                        {sub && <span className="iv-row-meta">{sub}</span>}
                                                    </>
                                                );
                                            })()}
                                        </td>
                                        {/* Existem partidas de valor zero no razão. Elas não movem
                                            o saldo, mas deixar a linha em branco parece defeito. */}
                                        <td className={`iv-num ${e.efeito > 0 ? 'is-in' : 'is-nil'}`}>
                                            {e.efeito >= 0 ? moneyAbs(e.efeito) : ''}
                                        </td>
                                        <td className="iv-num is-out">
                                            {e.efeito < 0 ? moneyAbs(e.efeito) : ''}
                                        </td>
                                        <td className="iv-num">{money(e.saldoCorrente)}</td>
                                    </tr>

                                    {aberto === e.id && (
                                        <tr>
                                            <td colSpan={5} style={{ padding: 0 }}>
                                                <div className="iv-breakdown">
                                                    <div className="iv-label" style={{ marginBottom: '0.75rem' }}>
                                                        Partida completa · {dateTime(e.created_at)}
                                                    </div>
                                                    {carregandoComposicao && (
                                                        <div className="iv-fall-detail">Buscando as contrapartidas…</div>
                                                    )}
                                                    {!carregandoComposicao && composicao.length === 0 && (
                                                        <div className="iv-fall-detail">
                                                            Sem contrapartidas registradas para esta transação.
                                                        </div>
                                                    )}
                                                    {composicao.map((d, i) => (
                                                        d.erro ? (
                                                            <div className="iv-error" key={`erro-${i}`}>
                                                                Não foi possível carregar a partida: {d.erro}
                                                            </div>
                                                        ) : (
                                                            <div className="iv-breakdown-row" key={d.id}>
                                                                <span>
                                                                    <span style={{ color: 'var(--iv-ink)' }}>
                                                                        {d.account_name || 'Conta'}
                                                                    </span>
                                                                    <span className="iv-breakdown-account">
                                                                        {' '}· {d.account_code}
                                                                    </span>
                                                                    <span className="iv-row-meta">{d.description}</span>
                                                                </span>
                                                                <span className={`iv-num ${Number(d.amount) < 0 ? 'is-in' : 'is-out'}`}>
                                                                    {Number(d.amount) < 0 ? '+' : '−'} {moneyAbs(d.amount)}
                                                                </span>
                                                            </div>
                                                        )
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
