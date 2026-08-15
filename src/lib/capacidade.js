/**
 * A única dona da aritmética de capacidade de uma usina.
 *
 * Antes desta função, o painel do admin e a área do investidor calculavam
 * franquia e geração cada um do seu jeito — e divergiam. A regra existe aqui
 * uma vez só; as telas exibem o que esta função devolve.
 */

/**
 * Franquia é capacidade contratada, então ela fica ocupada desde o vínculo —
 * inclusive enquanto a UC aguarda conexão, e inclusive com o assinante em atraso
 * (a UC segue conectada e compensando; quem está atrasado é o pagamento).
 * Só três estados devolvem a capacidade para a usina.
 */
export const STATUS_LIBERAM_FRANQUIA = new Set([
    'desconectado', 'cancelado', 'cancelado_inadimplente',
]);

export const ocupaFranquia = (uc) => !STATUS_LIBERAM_FRANQUIA.has(uc?.status);

const numero = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

/**
 * A UC geradora consome energia no próprio medidor. Esse consumo sai da geração
 * ANTES do rateio — do lado da oferta, não junto das beneficiárias. Somá-lo ao
 * comprometido e também abatê-lo da geração contaria o mesmo consumo duas vezes.
 *
 * @param {object} params
 * @param {Array<{tipo_unidade?: string, status?: string, franquia?: number|string|null}>} params.ucs
 * @param {number|string|null|undefined} params.geracao kWh brutos do período; null quando não há leitura
 * @returns {{
 *   geracao: number|null, autoconsumoUG: number, disponivel: number|null,
 *   comprometido: number, livre: number|null, ocupacao: number|null
 * }}
 *
 * Sobre ocupacao: quando disponivel <= 0, ocupacao é null (não calculável).
 * Percentual sobre base não positiva não é número. Sobrecarga se lê em livre < 0, não em ocupacao.
 */
/**
 * Autoconsumo medido da UC geradora, apurado das próprias faturas dela.
 *
 * A UC geradora não tem boleto de assinante — `invoices.status` descreve uma
 * cobrança que não existe para ela e não diz nada sobre a leitura do medidor.
 * Por isso esta função NUNCA filtra por status (ao contrário da apuração do
 * compensado das beneficiárias, onde `status === 'cancelado'` é motivo
 * legítimo de exclusão). Ver commit c74a2e2, que corrigiu a mesma confusão
 * na leitura de geração — esta é a mesma regra aplicada ao autoconsumo.
 *
 * @param {Array<{consumo_compensado?: number|string|null}>} faturas
 * @returns {number|null} soma em kWh das faturas com leitura, ou null quando
 *   nenhuma fatura do grupo tem `consumo_compensado` — nunca 0, que mentiria
 *   "sem autoconsumo".
 */
export function autoconsumoMedidoGeradora(faturas = []) {
    const comLeitura = (faturas || [])
        .filter((f) => f && f.consumo_compensado !== null && f.consumo_compensado !== undefined);
    if (comLeitura.length === 0) return null;
    return comLeitura.reduce((acc, f) => acc + numero(f.consumo_compensado), 0);
}

export function calcularCapacidade({ ucs = [], geracao = null } = {}) {
    const ativas = (ucs || []).filter(ocupaFranquia);

    // Soma TODAS as UCs geradoras ativas: mesmo com cadastro errado (mais de uma geradora),
    // nenhuma franquia desaparece da contabilidade.
    const autoconsumoUG = ativas
        .filter((uc) => uc.tipo_unidade === 'geradora')
        .reduce((acc, uc) => acc + numero(uc.franquia), 0);
    const comprometido = ativas
        .filter((uc) => uc.tipo_unidade !== 'geradora')
        .reduce((acc, uc) => acc + numero(uc.franquia), 0);

    // Geração ausente propaga null: zero aqui mentiria dizendo que a usina não gerou.
    const bruta = (geracao === null || geracao === undefined || geracao === ''
        || !Number.isFinite(Number(geracao)))
        ? null : Number(geracao);

    const disponivel = bruta === null ? null : bruta - autoconsumoUG;
    const livre = disponivel === null ? null : disponivel - comprometido;
    // Ocupacao é null quando não calculável (disponivel <= 0 ou sem geração).
    // Sobrecarga aparece como livre < 0, não em ocupacao.
    const ocupacao = (disponivel === null || disponivel <= 0)
        ? null : (comprometido / disponivel) * 100;

    return { geracao: bruta, autoconsumoUG, disponivel, comprometido, livre, ocupacao };
}
