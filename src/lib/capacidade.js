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
 */
export function calcularCapacidade({ ucs = [], geracao = null } = {}) {
    const ativas = (ucs || []).filter(ocupaFranquia);
    const geradora = ativas.find((uc) => uc.tipo_unidade === 'geradora') || null;

    const autoconsumoUG = geradora ? numero(geradora.franquia) : 0;
    const comprometido = ativas
        .filter((uc) => uc.tipo_unidade !== 'geradora')
        .reduce((acc, uc) => acc + numero(uc.franquia), 0);

    // Geração ausente propaga null: zero aqui mentiria dizendo que a usina não gerou.
    const bruta = (geracao === null || geracao === undefined || geracao === ''
        || !Number.isFinite(Number(geracao)))
        ? null : Number(geracao);

    const disponivel = bruta === null ? null : bruta - autoconsumoUG;
    const livre = disponivel === null ? null : disponivel - comprometido;
    const ocupacao = (disponivel === null || disponivel <= 0)
        ? null : (comprometido / disponivel) * 100;

    return { geracao: bruta, autoconsumoUG, disponivel, comprometido, livre, ocupacao };
}
