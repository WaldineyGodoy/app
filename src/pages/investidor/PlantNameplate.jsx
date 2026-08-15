import React from 'react';
import {
    kwp, kwh, percent, modalidade, statusUsina, cycleLabel, isBlank,
} from './format';

/**
 * Overbook não é erro: é aviso para apurar.
 *
 * A franquia é uma declaração de estimativa de consumo, não o consumo real.
 * Quando a soma das franquias passa da geração prevista, o que decide é a
 * medição — se o consumo compensado do último ciclo coube na geração, é só
 * acompanhar; se confirmou a franquia, as UCs precisam ser remanejadas para
 * outra usina, senão parte do consumo fica sem compensação.
 */
function Overbook({ usina }) {
    const compensado = usina.compensadoUltimo;
    const ciclo = usina.ultimoApurado;
    const gerado = ciclo ? Number(ciclo.geracao_mensal_kwh) : null;
    const autoconsumo = usina.autoconsumoMedidoUltimo;
    const mes = ciclo ? cycleLabel(ciclo.mes_referencia).curto : null;

    // A conferência é contra o disponível apurado (gerado − autoconsumo da UG no
    // mesmo ciclo), não contra o bruto — o autoconsumo nunca chega às beneficiárias.
    // Sem a medição do autoconsumo daquele ciclo não dá para saber o disponível,
    // então cai no aviso de "ainda não apurado" em vez de comparar contra o bruto
    // em silêncio (era exatamente esse o defeito: mascarava overbook real).
    if (compensado === null || gerado === null || !gerado || autoconsumo === null) {
        return (
            <div className="iv-note is-quiet iv-note-compact">
                <span>
                    <b>Franquia acima da geração prevista.</b> Ainda não há ciclo apurado
                    para conferir contra o consumo real. Acompanhe quando o mês fechar.
                </span>
            </div>
        );
    }

    const disponivelApurado = gerado - autoconsumo;
    const coube = compensado <= disponivelApurado;
    const folga = disponivelApurado - compensado;
    // A medição só vale como conferência se a composição das UCs não mudou depois dela.
    const novas = usina.entrantes || 0;
    const desatualizada = novas > 0;

    return (
        <div className={`iv-note iv-note-compact ${coube && !desatualizada ? 'is-quiet' : ''}`}>
            <span>
                <b>{coube ? 'Franquia acima da geração, consumo dentro.' : 'O consumo confirmou a franquia.'}</b>{' '}
                Em {mes} as beneficiárias compensaram {kwh(compensado)} contra {kwh(disponivelApurado)} disponíveis
                ({kwh(gerado)} gerados − {kwh(autoconsumo)} de autoconsumo da UG)
                {coube
                    ? ` — sobraram ${kwh(folga)}.`
                    : ` — faltaram ${kwh(Math.abs(folga))}. Remaneje UCs para outra usina, ou parte do consumo fica sem compensação.`}
                {desatualizada
                    ? ` ${novas} UC${novas === 1 ? ' entrou' : 's entraram'} depois desse ciclo, com ${kwh(usina.franquiaEntrantes)} de franquia que a medição não viu. Confira de novo no próximo fechamento.`
                    : coube ? ' Acompanhe: a franquia é estimativa, e o consumo pode subir.' : ''}
            </span>
        </div>
    );
}

/**
 * A placa de identificação rebitada no inversor: pares rótulo/valor gravados,
 * um LED de estado e um medidor de ocupação da franquia. Sem gráfico
 * decorativo — cada linha é uma grandeza que o investidor consegue conferir.
 */
export default function PlantNameplate({ usina }) {
    const estado = statusUsina(usina.status);
    const cidade = usina.address?.cidade;
    const uf = usina.address?.uf;
    const ocupacao = usina.ocupacao;
    // Sobrecarga se lê em livre < 0, não em ocupacao: quando o autoconsumo consome
    // toda a geração, disponivel <= 0 e ocupacao vira null — livre continua negativo.
    const excedido = usina.livre !== null && usina.livre !== undefined && usina.livre < 0;
    const ultimo = usina.ultimoApurado;

    const specs = [
        ['Potência instalada', kwp(usina.potencia_kwp)],
        ['Modalidade', modalidade(usina.modalidade)],
        ['Unidade geradora', usina.unidade_geradora || '—'],
        ['Beneficiárias ativas', `${usina.ucsAtivas} de ${usina.ucsBeneficiarias}`],
        ['Geração prevista (valor de placa)', isBlank(usina.geracao_estimada_kwh) ? '—' : `${kwh(usina.geracao_estimada_kwh)}/mês`],
        ['Autoconsumo da UG', usina.autoconsumoUG > 0
            ? `${kwh(usina.autoconsumoUG)}/mês`
            : '—'],
        ['Disponível para rateio', isBlank(usina.disponivelPrevisto)
            ? '—'
            : `${kwh(usina.disponivelPrevisto)}/mês`],
        ['Último ciclo apurado', ultimo
            ? `${cycleLabel(ultimo.mes_referencia).curto} · ${kwh(ultimo.geracao_mensal_kwh)}`
            : 'nenhum'],
    ];

    return (
        <article className="iv-nameplate">
            <header className="iv-nameplate-head">
                <div>
                    <h3 className="iv-nameplate-name">{usina.name}</h3>
                    <span className="iv-nameplate-place">
                        {cidade ? `${cidade}${uf ? ` · ${uf}` : ''}` : 'local não cadastrado'}
                        {usina.concessionaria ? ` · ${usina.concessionaria}` : ''}
                    </span>
                </div>
                <span className={`iv-chip tom-${estado.tom}`}>
                    <span className="iv-led" aria-hidden="true" />
                    {estado.rotulo}
                </span>
            </header>

            <div>
                {specs.map(([rotulo, valor]) => (
                    <div className="iv-spec" key={rotulo}>
                        <span className="iv-label">{rotulo}</span>
                        <span className="iv-spec-value">{valor}</span>
                    </div>
                ))}
            </div>

            <div className="iv-meter">
                <div className="iv-meter-track">
                    <span
                        className={`iv-meter-fill ${excedido ? 'is-over' : ''}`}
                        style={{ width: `${Math.min(100, Math.max(0, ocupacao ?? 0))}%` }}
                    />
                </div>
                <div className="iv-meter-legend">
                    <span className="iv-label">Franquia comprometida (sobre o disponível)</span>
                    <span className="iv-spec-value">
                        {kwh(usina.comprometido)}
                        {ocupacao === null ? '' : ` · ${percent(ocupacao)}`}
                    </span>
                </div>
                {excedido && <Overbook usina={usina} />}
            </div>
        </article>
    );
}
