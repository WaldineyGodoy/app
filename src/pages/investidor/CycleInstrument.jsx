import React, { useMemo } from 'react';
import {
    cycleLabel, isBlank, money, kwh, percent, statusCiclo, cents,
} from './format';

/**
 * Deriva a cascata de um ciclo a partir das colunas gravadas em
 * generation_production. O saldo é recalculado aqui e comparado com a coluna
 * `saldo_receber` — quando divergem, a tela mostra as duas, em vez de escolher
 * uma. Insumo ausente propaga null; não vira zero.
 */
export function readCycle(cycle) {
    if (!cycle) return null;

    const num = (v) => (isBlank(v) ? null : Number(v));
    const faturamento = num(cycle.faturamento_mensal);
    const despesas = num(cycle.total_despesas);
    const gestao = num(cycle.gestao_reais);
    const registrado = num(cycle.saldo_receber);

    const faltando = [];
    if (faturamento === null) faltando.push('faturamento do mês');
    if (despesas === null) faltando.push('total de despesas');
    if (gestao === null) faltando.push('taxa de gestão');

    const apurado = faltando.length ? null : cents(faturamento - despesas - gestao);
    const divergencia = apurado !== null && registrado !== null
        ? cents(apurado - registrado) : null;

    // Composição registrada das despesas, nas colunas que existirem.
    const composicao = [];
    const push = (nome, valor) => {
        if (!isBlank(valor) && Number(valor) !== 0) composicao.push({ nome, valor: Number(valor) });
    };
    push('Conta de energia da usina', cycle.custo_disponibilidade);
    push('Arrendamento do terreno', cycle.arrendamento);
    push('Manutenção', cycle.manutencao);

    const detalhes = cycle.service_details && typeof cycle.service_details === 'object'
        ? Object.entries(cycle.service_details).filter(([, v]) => Number(v) !== 0)
        : [];
    if (detalhes.length) detalhes.forEach(([nome, v]) => push(`Serviço · ${nome}`, v));
    else push('Serviços', cycle.servicos);

    const eventuais = cycle.despesas_eventuais && typeof cycle.despesas_eventuais === 'object'
        ? Object.entries(cycle.despesas_eventuais) : [];
    eventuais.forEach(([nome, v]) => push(`Eventual · ${nome}`, v));

    const somaComposicao = composicao.length
        ? cents(composicao.reduce((a, c) => a + c.valor, 0)) : null;

    const geracao = num(cycle.geracao_mensal_kwh);
    const previsto = num(cycle.geracao_prevista);

    return {
        faturamento, despesas, gestao, registrado, apurado, divergencia,
        composicao, somaComposicao, faltando, geracao, previsto,
        rendimento: geracao !== null && previsto ? (geracao / previsto) * 100 : null,
        // Apurado das faturas das beneficiárias. A coluna `energia_compensada` do
        // fechamento vem subestimada e não é usada aqui.
        compensada: num(cycle.compensadoApurado),
        ucsComFatura: cycle.ucsComFatura || 0,
        compensadaGravada: num(cycle.energia_compensada),
        status: statusCiclo(cycle.status),
        repasse: cycle.repasse_status,
        pagamentoUg: cycle.pagamento_ug_status,
    };
}

/* ------------------------------- Régua de ciclos ------------------------- */

export function CycleRuler({ cycles, selectedId, onSelect }) {
    const ticks = useMemo(() => {
        const lidos = cycles.map((c) => ({ cycle: c, lido: readCycle(c) }));
        const maior = lidos.reduce(
            (m, { lido }) => Math.max(m, Math.abs(lido?.apurado ?? 0)), 0,
        );
        return lidos.map(({ cycle, lido }) => {
            const valor = lido?.apurado;
            const altura = maior > 0 && valor !== null && valor !== undefined
                ? Math.max(2, (Math.abs(valor) / maior) * 100) : 2;
            let tom = cycle.status === 'liquidado' ? 'verdigris'
                : cycle.status === 'fechado' ? 'sun' : 'neutro';
            if (valor !== null && valor !== undefined && valor < 0) tom = 'rust';
            return { cycle, lido, altura, tom };
        });
    }, [cycles]);

    return (
        <div className="iv-ruler" role="group" aria-label="Ciclos de fechamento">
            {ticks.map(({ cycle, lido, altura, tom }) => {
                const rot = cycleLabel(cycle.mes_referencia);
                const ativo = cycle.id === selectedId;
                return (
                    <button
                        key={cycle.id}
                        type="button"
                        className="iv-tick"
                        aria-pressed={ativo}
                        onClick={() => onSelect(cycle.id)}
                    >
                        <span className="iv-tick-bar">
                            <span
                                className={`iv-tick-fill tom-${tom}`}
                                style={{ height: `${altura}%` }}
                            />
                        </span>
                        <span>
                            <span className="iv-tick-month">{rot.curto}</span>
                            <span className="iv-tick-plant">{cycle.usinaNome}</span>
                            <span className="iv-tick-plant">
                                {lido?.apurado === null ? 'não apurado' : money(lido.apurado)}
                            </span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

/* ------------------------------- Ficha do ciclo -------------------------- */

/**
 * Uma degrau da cascata. `de` e `ate` são posições já normalizadas em 0–100 na
 * mesma escala de toda a ficha, com o zero marcado no trilho — é isso que faz o
 * degrau da despesa começar onde o faturamento parou e o saldo negativo cruzar
 * para o outro lado do eixo.
 */
function FallRow({ nome, valor, detalhe, variante, de, ate, zero }) {
    const esquerda = Math.min(de, ate);
    const largura = Math.abs(ate - de);
    // Só a linha de saída ganha o sinal de menos, e só quando há valor a subtrair.
    const saida = variante === 'out' && valor !== null && valor !== 0;
    const negativo = variante === 'total' && valor !== null && valor < 0;
    const texto = valor === null ? '—'
        : saida ? `− ${money(Math.abs(valor))}`
            : money(valor);
    return (
        <div className={`iv-fall-row ${variante === 'base' ? 'is-base' : ''} ${variante === 'total' ? 'is-total' : ''}`}>
            <div className="iv-fall-line">
                <span className="iv-fall-name">{nome}</span>
                <span className={`iv-fall-value ${saida || negativo ? 'is-out' : ''}`}>
                    {texto}
                </span>
            </div>
            <div className="iv-fall-track">
                <span className="iv-fall-zero" style={{ left: `${zero}%` }} aria-hidden="true" />
                <span
                    className={`iv-fall-bar ${saida || negativo ? 'is-out' : ''} ${variante === 'base' ? 'is-base' : ''} ${variante === 'total' && !negativo ? 'is-total' : ''}`}
                    style={{ left: `${esquerda}%`, width: `${largura}%` }}
                />
            </div>
            {detalhe ? <span className="iv-fall-detail">{detalhe}</span> : null}
        </div>
    );
}

export function CycleSheet({ cycle }) {
    const lido = readCycle(cycle);
    if (!lido) return null;

    const rot = cycleLabel(cycle.mes_referencia);

    // Escala única da cascata: do menor ao maior ponto por onde o dinheiro passa,
    // sempre incluindo o zero para o eixo existir mesmo quando tudo é despesa.
    const fat = lido.faturamento ?? 0;
    const desp = lido.despesas ?? 0;
    const gest = lido.gestao ?? 0;
    const marcos = [0, fat, fat - desp, fat - desp - gest];
    const minimo = Math.min(...marcos);
    const maximo = Math.max(...marcos);
    const amplitude = maximo - minimo || 1;
    const pos = (v) => ((v - minimo) / amplitude) * 100;
    const zero = pos(0);

    return (
        <div className="iv-sheet iv-enter" key={cycle.id}>
            <div className="iv-sheet-head">
                <h3 className="iv-sheet-month">{rot.longo}</h3>
                <p className="iv-sheet-plant">{cycle.usinaNome}</p>
                <span className={`iv-chip tom-${lido.status.tom}`}>
                    <span className="iv-led" aria-hidden="true" />
                    {lido.status.rotulo}
                </span>
            </div>

            <div className="iv-fall">
                <FallRow
                    nome="Faturamento das faturas pagas"
                    valor={lido.faturamento}
                    variante="base"
                    de={zero} ate={pos(fat)} zero={zero}
                    detalhe={lido.compensada !== null
                        ? `${kwh(lido.compensada)} compensados em ${lido.ucsComFatura} beneficiária${lido.ucsComFatura === 1 ? '' : 's'}`
                        : 'consumo compensado ainda não apurado nas faturas'}
                />
                <FallRow
                    nome="Despesas do ciclo"
                    valor={lido.despesas}
                    variante="out"
                    de={pos(fat)} ate={pos(fat - desp)} zero={zero}
                    detalhe={lido.composicao.length ? `${lido.composicao.length} lançamentos registrados` : null}
                />
                <FallRow
                    nome="Taxa de gestão B2W"
                    valor={lido.gestao}
                    variante="out"
                    de={pos(fat - desp)} ate={pos(fat - desp - gest)} zero={zero}
                />
                <FallRow
                    nome="Saldo apurado do ciclo"
                    valor={lido.apurado}
                    variante="total"
                    de={zero} ate={lido.apurado === null ? zero : pos(lido.apurado)} zero={zero}
                />
            </div>

            {lido.faltando.length > 0 && (
                <div className="iv-note">
                    <span>
                        <b>Fechamento incompleto.</b> Falta {lido.faltando.join(', ')} para apurar o saldo
                        deste ciclo. O valor fica em branco até o fechamento gravar o dado.
                    </span>
                </div>
            )}

            {lido.divergencia !== null && Math.abs(lido.divergencia) >= 0.01 && (
                <div className="iv-note">
                    <span>
                        <b>Saldo apurado difere do gravado.</b> A conta acima chega a {money(lido.apurado)};
                        a coluna do fechamento guarda {money(lido.registrado)} — diferença de {money(Math.abs(lido.divergencia))}.
                        Confira antes de usar para conciliar.
                    </span>
                </div>
            )}

            {lido.composicao.length > 0 && (
                <>
                    <div className="iv-sheet-foot">
                        <span className="iv-label">Composição das despesas</span>
                    </div>
                    <div className="iv-fall">
                        {lido.composicao.map((c) => (
                            <div className="iv-fall-row" key={c.nome}>
                                <div className="iv-fall-line">
                                    <span className="iv-fall-name">{c.nome}</span>
                                    <span className="iv-fall-value is-out">− {money(Math.abs(c.valor))}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {lido.despesas !== null && lido.somaComposicao !== null
                        && Math.abs(cents(lido.somaComposicao - lido.despesas)) >= 0.01 && (
                            <div className="iv-note is-quiet">
                                <span>
                                    As linhas acima somam {money(lido.somaComposicao)}, e o fechamento
                                    apurou {money(lido.despesas)} de despesa total. A diferença costuma ser
                                    conta de energia contada dentro de serviços em ciclos antigos.
                                </span>
                            </div>
                        )}
                </>
            )}

            <div className="iv-sheet-foot">
                <span>
                    <span className="iv-label">Geração</span>{' '}
                    <span className="iv-figure">{kwh(lido.geracao)}</span>
                </span>
                <span>
                    <span className="iv-label">Previsto</span>{' '}
                    <span className="iv-figure">{kwh(lido.previsto)}</span>
                </span>
                <span>
                    <span className="iv-label">Rendimento</span>{' '}
                    <span className="iv-figure">{percent(lido.rendimento)}</span>
                </span>
            </div>

            {cycle.status === 'liquidado' && (
                <div className="iv-note">
                    <span>
                        <b>Repasse enviado ao banco.</b> O sistema ainda não recebe a confirmação de que
                        o PIX saiu — o status para em “enfileirado”. Confira o crédito no extrato abaixo
                        antes de dar o ciclo por recebido.
                    </span>
                </div>
            )}
        </div>
    );
}
