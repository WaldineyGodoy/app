import React, { useEffect, useMemo, useState } from 'react';
import { CycleRuler, CycleSheet } from './CycleInstrument';
import PlantNameplate from './PlantNameplate';
import LedgerStatement from './LedgerStatement';
import { Sun, Moon } from 'lucide-react';
import { useUI } from '../../contexts/UIContext';
import { money, kwh, kwp, dateTime, maskPix, cents } from './format';
import './investor.css';

const FILTROS = [
    { id: 'todas', rotulo: 'Todas' },
    { id: 'gerando', rotulo: 'Gerando' },
    { id: 'em_conexao', rotulo: 'Em conexão' },
    { id: 'manutencao', rotulo: 'Manutenção' },
];

/**
 * A superfície do painel. Recebe tudo pronto por props — quem busca é o
 * container. Manter as duas coisas separadas é o que permite abrir a tela
 * com dados de exemplo sem autenticar.
 */
export default function InvestorPanel({
    supplier, usinas, cycles, entries, balance, autoRedeem, fetchedAt,
    onReload, onSignOut, onRedeem, enviando = false, aviso = null,
}) {
    const [cicloId, setCicloId] = useState(null);
    const [filtro, setFiltro] = useState('todas');
    const [dialogo, setDialogo] = useState(null); // { valor, parcial }

    const { theme, toggleTheme } = useUI();
    const escuro = theme === 'dark';

    // O <html> e o <body> precisam acompanhar o fundo do painel, senão o
    // overscroll mostra a cor do resto do app por baixo. Segue o tema escolhido.
    useEffect(() => {
        const raiz = document.documentElement;
        const antes = { body: document.body.style.backgroundColor, raiz: raiz.style.backgroundColor };
        const fundo = escuro ? '#0a0f14' : '#f2f4f6';
        document.body.style.backgroundColor = fundo;
        raiz.style.backgroundColor = fundo;
        return () => {
            document.body.style.backgroundColor = antes.body;
            raiz.style.backgroundColor = antes.raiz;
        };
    }, [escuro]);

    useEffect(() => {
        if (!cicloId && cycles.length) setCicloId(cycles[0].id);
    }, [cycles, cicloId]);

    const ciclo = useMemo(
        () => cycles.find((c) => c.id === cicloId) || null,
        [cycles, cicloId],
    );

    const visiveis = useMemo(
        () => (filtro === 'todas' ? usinas : usinas.filter((u) => u.status === filtro)),
        [usinas, filtro],
    );

    const potenciaTotal = usinas.reduce((a, u) => a + (Number(u.potencia_kwp) || 0), 0);
    const beneficiarias = usinas.reduce((a, u) => a + u.ucsAtivas, 0);
    const ultimaGeracao = cycles.find((c) => Number(c.geracao_mensal_kwh) > 0) || null;

    const saldo = balance?.total ?? null;
    const adiantamento = balance?.adiantamento ?? 0;
    // Com adiantamento em aberto o saldo apurado ainda nao e dinheiro livre: ele
    // amortiza a divida antes de virar repasse. Resgatar aqui pagaria duas vezes.
    const podeResgatar = autoRedeem && saldo !== null && saldo > 0 && adiantamento <= 0
        && Boolean(supplier?.pix_key) && Boolean(supplier?.pix_key_type);

    const enviarResgate = () => {
        const valor = cents(dialogo?.valor);
        setDialogo(null);
        onRedeem?.(valor);
    };

    return (
        <div className="iv-root">
            <header className="iv-rail">
                <div className="iv-rail-in">
                    <div className="iv-rail-mark">
                        <strong>B2W</strong>
                        <span className="iv-label">Área do investidor</span>
                    </div>
                    <span className="iv-rail-spacer" />
                    <div className="iv-rail-who">
                        <span>{supplier.name}</span>
                        <span className="iv-label">PIX {maskPix(supplier.pix_key, supplier.pix_key_type)}</span>
                    </div>
                    <button
                        type="button"
                        className="iv-ghost"
                        onClick={toggleTheme}
                        title={escuro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
                        aria-label={escuro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
                    >
                        {escuro ? <Sun size={14} /> : <Moon size={14} />}
                        <span className="iv-so-desktop">{escuro ? 'Claro' : 'Escuro'}</span>
                    </button>
                    <button type="button" className="iv-ghost" onClick={onSignOut}>Sair</button>
                </div>
            </header>

            <main className="iv-shell">
                {/* ---------------------- leitura principal ---------------------- */}
                <section className="iv-readout iv-enter">
                    <div className="iv-readout-top">
                        <div>
                            <span className="iv-label">
                                {saldo !== null && saldo < 0 ? 'Saldo devedor' : 'Saldo a receber'}
                            </span>
                            <span className={`iv-readout-figure ${saldo === null ? '' : saldo < 0 ? 'is-debit' : 'is-credit'}`}>
                                {saldo === null ? '—' : money(Math.abs(saldo))}
                            </span>
                        </div>

                        <div>
                            {podeResgatar ? (
                                <button
                                    type="button"
                                    className="iv-action"
                                    disabled={enviando}
                                    onClick={() => setDialogo({ valor: saldo, parcial: false })}
                                >
                                    {enviando ? 'Enviando…' : 'Resgatar por PIX'}
                                </button>
                            ) : (
                                <button type="button" className="iv-action" disabled>
                                    {adiantamento > 0 ? 'Amortiza o adiantamento'
                                        : saldo !== null && saldo <= 0 ? 'Nada a resgatar'
                                            : !supplier.pix_key ? 'Cadastre sua chave PIX'
                                                : 'Resgate pela B2W'}
                                </button>
                            )}
                        </div>
                    </div>

                    <p className="iv-readout-note">
                        Somatório da sua conta de repasse no razão da B2W:{' '}
                        <b>{balance?.nCreditos ?? 0} créditos</b> de energia compensada e{' '}
                        <b>{balance?.nDebitos ?? 0} débitos</b> entre despesas e resgates.
                        Último lançamento em {dateTime(balance?.ultimoLancamento)}.
                    </p>

                    {/* Adiantamento nao entra no saldo a receber: e pagamento antecipado,
                        que vai sendo abatido conforme as faturas dos assinantes sao pagas.
                        Omitir isto faria o investidor ler o saldo como valor livre. */}
                    {balance?.adiantamento > 0 && (
                        <div className="iv-note">
                            <span>
                                <b>Você tem {money(balance.adiantamento)} adiantados.</b> A B2W pagou
                                antes de o faturamento existir, e esse valor vai sendo abatido conforme
                                as faturas dos seus assinantes são pagas. O saldo acima é o que já foi
                                apurado — o adiantamento é descontado dele antes de qualquer novo repasse.
                            </span>
                        </div>
                    )}

                    <div className="iv-gauges">
                        <div className="iv-gauge">
                            <span className="iv-label">Usinas</span>
                            <span className="iv-gauge-value">{usinas.length}</span>
                        </div>
                        <div className="iv-gauge">
                            <span className="iv-label">Potência instalada</span>
                            <span className="iv-gauge-value">{kwp(potenciaTotal)}</span>
                        </div>
                        <div className="iv-gauge">
                            <span className="iv-label">Beneficiárias ativas</span>
                            <span className="iv-gauge-value">{beneficiarias}</span>
                        </div>
                        <div className="iv-gauge">
                            <span className="iv-label">Última geração apurada</span>
                            <span className="iv-gauge-value">
                                {ultimaGeracao ? kwh(ultimaGeracao.geracao_mensal_kwh) : '—'}
                            </span>
                        </div>
                    </div>
                </section>

                {/* ------------------------- ciclos ------------------------- */}
                <section className="iv-section">
                    <div className="iv-section-head">
                        <div>
                            <h2 className="iv-section-title">Ciclos de fechamento</h2>
                            <p className="iv-section-sub">
                                Cada mês fecha uma vez, por usina. A ficha mostra como o faturamento das
                                faturas pagas virou o seu saldo — e o que foi descontado no caminho.
                            </p>
                        </div>
                        <span className="iv-label">{cycles.length} ciclos</span>
                    </div>

                    {cycles.length === 0 ? (
                        <div className="iv-empty">
                            <strong>Nenhum ciclo apurado</strong>
                            O primeiro fechamento aparece aqui no mês seguinte à entrada em operação.
                        </div>
                    ) : (
                        <>
                            <CycleRuler cycles={cycles} selectedId={cicloId} onSelect={setCicloId} />
                            {ciclo && <CycleSheet cycle={ciclo} />}
                        </>
                    )}
                </section>

                {/* ------------------------- usinas ------------------------- */}
                <section className="iv-section">
                    <div className="iv-section-head">
                        <div>
                            <h2 className="iv-section-title">Suas usinas</h2>
                            <p className="iv-section-sub">
                                Os dados de placa de cada usina e quanto da geração prevista já está
                                comprometida com assinantes.
                            </p>
                        </div>
                        <div className="iv-filters">
                            {FILTROS.map((f) => (
                                <button
                                    key={f.id}
                                    type="button"
                                    className="iv-filter"
                                    aria-pressed={filtro === f.id}
                                    onClick={() => setFiltro(f.id)}
                                >
                                    {f.rotulo}
                                </button>
                            ))}
                        </div>
                    </div>

                    {visiveis.length === 0 ? (
                        <div className="iv-empty">
                            <strong>Nenhuma usina com esse estado</strong>
                            Troque o filtro para ver as demais.
                        </div>
                    ) : (
                        <div className="iv-plates">
                            {visiveis.map((u) => <PlantNameplate key={u.id} usina={u} />)}
                        </div>
                    )}
                </section>

                {/* ------------------------- extrato ------------------------ */}
                <section className="iv-section">
                    <div className="iv-section-head">
                        <div>
                            <h2 className="iv-section-title">Extrato de recebíveis</h2>
                            <p className="iv-section-sub">
                                Todos os lançamentos da sua conta de repasse, do mais recente ao mais antigo,
                                com o saldo acumulado a cada linha. Toque em um lançamento para ver a partida
                                inteira. O extrato é do investidor, consolidado — o razão ainda não separa
                                os créditos por usina.
                            </p>
                        </div>
                        <span className="iv-label">
                            {money(balance?.creditos)} creditados · {money(balance?.debitos)} debitados
                        </span>
                    </div>

                    <LedgerStatement entries={entries} supplierName={supplier.name} />
                </section>

                <footer className="iv-foot">
                    <span className="iv-label">Dados lidos em {dateTime(fetchedAt)}</span>
                    <button type="button" className="iv-ghost" onClick={onReload}>Atualizar</button>
                </footer>
            </main>

            {/* ------------------------- diálogo de resgate ------------------ */}
            {dialogo && (
                <div
                    className="iv-dialog-veil"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Resgatar por PIX"
                    onClick={(e) => { if (e.target === e.currentTarget) setDialogo(null); }}
                >
                    <div className="iv-dialog">
                        <h2 className="iv-dialog-title">Resgatar por PIX</h2>

                        <div>
                            <span className="iv-label">Valor</span>
                            {dialogo.parcial ? (
                                <label className="iv-field" style={{ marginTop: '0.5rem' }}>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        max={saldo}
                                        value={dialogo.valor}
                                        autoFocus
                                        onChange={(e) => setDialogo({ ...dialogo, valor: Number(e.target.value) })}
                                    />
                                </label>
                            ) : (
                                <span className="iv-dialog-figure" style={{ display: 'block', marginTop: '0.5rem' }}>
                                    {money(dialogo.valor)}
                                </span>
                            )}
                        </div>

                        <div>
                            <span className="iv-label">Destino</span>
                            <p className="iv-figure" style={{ marginTop: '0.375rem', fontSize: '0.875rem', wordBreak: 'break-all' }}>
                                {supplier.pix_key} · {String(supplier.pix_key_type || '').toUpperCase()}
                            </p>
                        </div>

                        <div className="iv-note is-quiet" style={{ marginTop: 0 }}>
                            <span>
                                A B2W envia o PIX ao banco. A confirmação de que o dinheiro saiu ainda
                                depende de conferência no extrato bancário — o saldo acima só muda quando
                                o lançamento entra no razão.
                            </span>
                        </div>

                        <div className="iv-dialog-actions">
                            <button type="button" className="iv-action" onClick={enviarResgate}>
                                Enviar resgate
                            </button>
                            {!dialogo.parcial && (
                                <button
                                    type="button"
                                    className="iv-ghost"
                                    onClick={() => setDialogo({ ...dialogo, parcial: true })}
                                >
                                    Outro valor
                                </button>
                            )}
                            <button type="button" className="iv-ghost" onClick={() => setDialogo(null)}>
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {aviso && (
                <div className={`iv-toast ${aviso.tom === 'error' ? 'is-error' : ''}`} role="status">
                    {aviso.texto}
                </div>
            )}
        </div>
    );
}
