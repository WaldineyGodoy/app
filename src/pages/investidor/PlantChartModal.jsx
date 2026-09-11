import React, { useEffect, useMemo } from 'react';
import { cycleLabel, kwh, percent, isBlank } from './format';

const ROTULO_ORIGEM = {
    fechamento: 'fechamento apurado',
    fatura: 'leitura da conta da usina',
    previsto: 'ainda não medido',
};

/**
 * Gráfico de energia injetada, mês a mês.
 *
 * Barra sólida é medição; barra listrada é a geração prevista de um mês que
 * ainda não teve lançamento. A distinção é o ponto do gráfico: previsão
 * desenhada igual a medição viraria histórico falso no mês seguinte.
 *
 * O traço fino em cada coluna marca o previsto daquele mês, para a medição
 * poder ser lida contra a expectativa sem precisar de um segundo gráfico.
 */
export default function PlantChartModal({ usina, onClose }) {
    useEffect(() => {
        const aoTeclar = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', aoTeclar);
        return () => document.removeEventListener('keydown', aoTeclar);
    }, [onClose]);

    const serie = usina.serieInjecao || [];

    const { topo, medidos, somaMedida, somaPrevista } = useMemo(() => {
        const valores = serie.flatMap((p) => [p.kwh, p.previsto]).filter((v) => !isBlank(v));
        const med = serie.filter((p) => p.kwh !== null);
        return {
            topo: valores.length ? Math.max(...valores) : 0,
            medidos: med,
            somaMedida: med.reduce((a, p) => a + p.kwh, 0),
            // Só compara contra o previsto dos meses que têm medição; incluir os
            // meses futuros faria a usina parecer sempre abaixo da expectativa.
            somaPrevista: med.reduce((a, p) => a + (p.previsto || 0), 0),
        };
    }, [serie]);

    const altura = (v) => (topo > 0 && !isBlank(v) ? Math.max(1.5, (v / topo) * 100) : 0);
    const rendimento = somaPrevista > 0 ? (somaMedida / somaPrevista) * 100 : null;

    return (
        <div
            className="iv-dialog-veil"
            role="dialog"
            aria-modal="true"
            aria-label={`Energia injetada — ${usina.name}`}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="iv-dialog iv-dialog-wide">
                <div className="iv-graf-head">
                    <div>
                        <h2 className="iv-dialog-title">Energia injetada</h2>
                        <p className="iv-sheet-plant">{usina.name}</p>
                    </div>
                    <button type="button" className="iv-ghost" onClick={onClose}>Fechar</button>
                </div>

                {serie.length === 0 ? (
                    <div className="iv-empty">
                        <strong>Sem histórico de injeção</strong>
                        Esta usina ainda não tem fechamento nem leitura da conta da unidade geradora.
                    </div>
                ) : (
                    <>
                        <div className="iv-graf" role="img"
                            aria-label={`Injeção mensal de ${usina.name}, ${serie.length} meses`}>
                            {serie.map((p) => {
                                const rot = cycleLabel(`${p.mes}-01`);
                                const previsto = p.origem === 'previsto';
                                return (
                                    <div className="iv-graf-col" key={p.mes}>
                                        <span className="iv-graf-topo">
                                            {previsto ? kwh(p.previsto) : kwh(p.kwh)}
                                        </span>
                                        <span className="iv-graf-trilho">
                                            <span
                                                className={`iv-graf-barra is-${p.origem}`}
                                                style={{ height: `${altura(previsto ? p.previsto : p.kwh)}%` }}
                                            />
                                            {!previsto && p.previsto ? (
                                                <span
                                                    className="iv-graf-alvo"
                                                    style={{ bottom: `${altura(p.previsto)}%` }}
                                                    title={`previsto ${kwh(p.previsto)}`}
                                                />
                                            ) : null}
                                        </span>
                                        <span className="iv-graf-mes">{rot.mes}</span>
                                        <span className="iv-graf-ano">{rot.ano}</span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="iv-graf-legenda">
                            <span><i className="iv-amostra is-fechamento" />Fechamento apurado</span>
                            <span><i className="iv-amostra is-fatura" />Leitura da conta da usina</span>
                            <span><i className="iv-amostra is-previsto" />Previsto, ainda sem lançamento</span>
                            <span><i className="iv-amostra is-alvo" />Previsão do mês</span>
                        </div>

                        <div className="iv-sheet-foot">
                            <span>
                                <span className="iv-label">Injetado no período</span>{' '}
                                <span className="iv-figure">{kwh(somaMedida)}</span>
                            </span>
                            <span>
                                <span className="iv-label">Previsto para os mesmos meses</span>{' '}
                                <span className="iv-figure">{kwh(somaPrevista || null)}</span>
                            </span>
                            <span>
                                <span className="iv-label">Rendimento</span>{' '}
                                <span className="iv-figure">{percent(rendimento)}</span>
                            </span>
                        </div>

                        <div className="iv-graf-tabela">
                            <table>
                                <thead>
                                    <tr>
                                        <th scope="col">Mês</th>
                                        <th scope="col" className="iv-num">Injetado</th>
                                        <th scope="col" className="iv-num">Previsto</th>
                                        <th scope="col">Origem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...serie].reverse().map((p) => (
                                        <tr key={p.mes}>
                                            <td className="iv-figure">{cycleLabel(`${p.mes}-01`).curto}</td>
                                            <td className="iv-num">{kwh(p.kwh)}</td>
                                            <td className="iv-num">{kwh(p.previsto)}</td>
                                            <td className="iv-row-meta">{ROTULO_ORIGEM[p.origem]}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {medidos.length > 0 && serie.some((p) => p.origem === 'fatura') && (
                            <div className="iv-note is-quiet">
                                <span>
                                    Os meses marcados como leitura da conta vêm do ciclo do medidor, que
                                    atravessa a virada do mês, enquanto o fechamento é mês calendário.
                                    Servem para acompanhar a usina, não para conciliar centavo a centavo.
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
