import React, { useMemo } from 'react';
import {
    cycleLabel, isBlank, money, kwh, percent, statusCiclo, cents,
    tarifa as tarifaBRL,
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
            const valor = cycle.ausente ? null : lido?.apurado;
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
                        className={`iv-tick ${cycle.ausente ? 'is-ausente' : ''}`}
                        aria-pressed={ativo}
                        onClick={() => onSelect(cycle.id)}
                    >
                        <span className="iv-tick-bar">
                            <span
                                className={`iv-tick-fill ${cycle.ausente ? '' : `tom-${tom}`}`}
                                style={{ height: `${cycle.ausente ? 100 : altura}%` }}
                            />
                        </span>
                        <span>
                            <span className="iv-tick-month">{rot.curto}</span>
                            <span className="iv-tick-plant">{cycle.usinaNome}</span>
                            <span className="iv-tick-plant">
                                {cycle.ausente ? 'sem fechamento'
                                    : lido?.apurado === null ? 'não apurado' : money(lido.apurado)}
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
    // Sem valor a barra teria largura zero e a linha sumiria, o que se lê como
    // gráfico quebrado. O trilho listrado diz "este degrau ainda não foi apurado".
    const vazio = valor === null;
    return (
        <div className={`iv-fall-row ${variante === 'base' ? 'is-base' : ''} ${variante === 'total' ? 'is-total' : ''}`}>
            <div className="iv-fall-line">
                <span className="iv-fall-name">{nome}</span>
                <span className={`iv-fall-value ${saida || negativo ? 'is-out' : ''}`}>
                    {texto}
                </span>
            </div>
            <div className={`iv-fall-track ${vazio ? 'is-vazio' : ''}`}>
                <span className="iv-fall-zero" style={{ left: `${zero}%` }} aria-hidden="true" />
                {!vazio && (
                    <span
                        className={`iv-fall-bar ${saida || negativo ? 'is-out' : ''} ${variante === 'base' ? 'is-base' : ''} ${variante === 'total' && !negativo ? 'is-total' : ''}`}
                        style={{ left: `${esquerda}%`, width: `${largura}%` }}
                    />
                )}
            </div>
            {detalhe ? <span className="iv-fall-detail">{detalhe}</span> : null}
        </div>
    );
}

/**
 * A composição que leva da tarifa cheia da concessionária ao que sobra por kWh
 * para o investidor. É a conta que ele recebe por WhatsApp todo mês; tê-la na
 * tela evita conferir de cabeça.
 */
function TariffChain({ usina }) {
    const t = usina?.tarifa;
    if (!t) {
        return (
            <div className="iv-note is-quiet">
                <span>
                    A distribuidora <b>{usina?.concessionaria || 'desta usina'}</b> ainda não tem
                    tarifas cadastradas, então a composição da sua tarifa líquida não pode ser
                    exibida.
                </span>
            </div>
        );
    }

    const linhas = [
        ['Tarifa de energia', t.tarifa, 'in', `classe ${t.grupo}`],
        ['Desconto do assinante', t.descontoReais, 'out',
            t.descontoPercent === null ? null : `${percent(t.descontoPercent, 0)} da tarifa`],
        ['Fio B', t.fioB, 'out', t.fioBIsento ? 'isento — usina GD1' : 'uso da rede da distribuidora'],
    ];
    if (t.isCompartilhada) {
        linhas.push(['ICMS', t.icms, 'out',
            t.icmsPercent === null ? null : `${percent(t.icmsPercent, 0)} sobre a tarifa sem Fio B`]);
        linhas.push(['PIS + COFINS', t.pisCofins, 'out',
            t.pisPercent === null || t.cofinsPercent === null
                ? null : `${percent(t.pisPercent + t.cofinsPercent)} após o ICMS`]);
    }
    linhas.push(['Taxa de gestão B2W', t.gestaoReais, 'out',
        t.gestaoPercent === null ? null : `${percent(t.gestaoPercent, 0)} do que sobra`]);

    return (
        <>
            <div className="iv-sheet-foot">
                <span className="iv-label">Componentes da sua tarifa · por kWh compensado</span>
            </div>

            <div className="iv-tarifa">
                {linhas.map(([nome, valor, tipo, nota]) => (
                    <div className="iv-tarifa-row" key={nome}>
                        <span>
                            <span className="iv-fall-name">{nome}</span>
                            {nota ? <span className="iv-fall-detail">{nota}</span> : null}
                        </span>
                        <span className={`iv-tarifa-value ${tipo === 'out' ? 'is-out' : ''}`}>
                            {valor === null ? '—' : `${tipo === 'out' ? '− ' : ''}${tarifaBRL(valor)}`}
                        </span>
                    </div>
                ))}
                <div className="iv-tarifa-row is-total">
                    <span className="iv-fall-name">Tarifa líquida do investidor</span>
                    <span className="iv-tarifa-value is-total">{tarifaBRL(t.liquida)}</span>
                </div>
            </div>

            {t.faltando.length > 0 && (
                <div className="iv-note">
                    <span>
                        <b>Tarifa incompleta.</b> Falta {t.faltando.join(', ')} no cadastro da
                        distribuidora. A tarifa líquida fica em branco até o dado existir — mostrar
                        zero no lugar inflaria o valor que você vê por kWh.
                    </span>
                </div>
            )}
        </>
    );
}

export function CycleSheet({ cycle, usina }) {
    const rot = cycleLabel(cycle?.mes_referencia);

    // Mês que existiu no calendário e nunca foi fechado. Não tem cascata para
    // desenhar; tem uma ausência para explicar.
    if (cycle?.ausente) {
        return (
            <div className="iv-sheet iv-enter" key={cycle.id}>
                <div className="iv-sheet-head">
                    <h3 className="iv-sheet-month">{rot.longo}</h3>
                    <p className="iv-sheet-plant">{cycle.usinaNome}</p>
                    <span className="iv-chip tom-neutro">
                        <span className="iv-led" aria-hidden="true" />
                        Sem fechamento
                    </span>
                </div>

                <div className="iv-note">
                    <span>
                        <b>Este mês não foi fechado.</b> Não existe apuração gravada para{' '}
                        {rot.longo} nesta usina, embora haja fechamento antes e depois.
                        {cycle.compensadoApurado !== null
                            ? ` As faturas das beneficiárias desse mês registram ${kwh(cycle.compensadoApurado)}
                               compensados em ${cycle.ucsComFatura} unidade${cycle.ucsComFatura === 1 ? '' : 's'},
                               então houve energia — o que falta é o fechamento.`
                            : ' Também não há faturas de beneficiárias apuradas no período.'}
                        {' '}Fale com a B2W antes de conciliar o período.
                    </span>
                </div>

                {usina && <TariffChain usina={usina} />}
            </div>
        );
    }

    const lido = readCycle(cycle);
    if (!lido) return null;

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

            {usina && <TariffChain usina={usina} />}

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
