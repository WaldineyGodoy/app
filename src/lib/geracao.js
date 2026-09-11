/**
 * Série mensal de energia injetada por usina, para o gráfico do investidor.
 *
 * Três fontes, nesta ordem — a mesma precedência que os painéis do CRM já usam:
 *
 * 1. `generation_production.geracao_mensal_kwh` — o fechamento conferido pelo
 *    operador. É sobre ele que o mês fecha e o repasse sai.
 * 2. `invoices.energia_injetada` da UC geradora — a leitura do medidor no ciclo
 *    de faturamento. Entra quando o fechamento é 0 ou não existe.
 * 3. Geração prevista — `geracao_prevista` do mês, ou o valor de placa da usina.
 *    Nunca se mistura com medição: vem marcada como `previsto` para a tela
 *    desenhar diferente.
 *
 * Os dois primeiros não medem o mesmo período: o fechamento é mês calendário e a
 * fatura é ciclo de leitura, que atravessa a virada do mês. Por isso cada ponto
 * carrega `origem` — comparar meses de origens diferentes exige saber disso.
 *
 * Zero conta como "ainda não medido", não como "usina parada". É convenção do
 * projeto, herdada do CRM: o fechamento nasce zerado e só recebe o número quando
 * o operador apura.
 */

const num = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
};

const chaveMes = (v) => (v ? String(v).slice(0, 7) : null);

const indiceDe = (chave) => {
    const [ano, mes] = chave.split('-').map(Number);
    return ano * 12 + (mes - 1);
};

const chaveDe = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

/**
 * @param {object[]} ciclos       linhas de generation_production da usina
 * @param {object[]} faturasUG    faturas da UC geradora (mes_referencia, energia_injetada)
 * @param {number|null} previstoPlaca  `usinas.geracao_estimada_kwh`
 * @param {string} ate            mês final 'YYYY-MM' (normalmente o mês corrente)
 * @param {number} meses          quantos meses no máximo devolver
 * @returns {{mes: string, kwh: number|null, previsto: number|null, origem: string}[]}
 *          em ordem cronológica
 */
export function serieDeInjecao({ ciclos = [], faturasUG = [], previstoPlaca = null, ate, meses = 12 }) {
    const fechamento = new Map();
    const previstoDoMes = new Map();
    for (const c of ciclos) {
        const k = chaveMes(c.mes_referencia);
        if (!k) continue;
        fechamento.set(k, num(c.geracao_mensal_kwh));
        const p = num(c.geracao_prevista);
        if (p !== null && p > 0) previstoDoMes.set(k, p);
    }

    // Uma UC geradora pode ter mais de uma fatura no mesmo mês (troca de
    // titularidade, conta refaturada). Somar é o que reconstrói o ciclo.
    const medidoNaFatura = new Map();
    for (const f of faturasUG) {
        const k = chaveMes(f.mes_referencia);
        const v = num(f.energia_injetada);
        if (!k || v === null) continue;
        medidoNaFatura.set(k, (medidoNaFatura.get(k) || 0) + v);
    }

    const conhecidos = [...new Set([...fechamento.keys(), ...medidoNaFatura.keys()])].sort();
    if (!conhecidos.length) return [];

    const fim = ate && /^\d{4}-\d{2}$/.test(ate)
        ? Math.max(indiceDe(ate), indiceDe(conhecidos[conhecidos.length - 1]))
        : indiceDe(conhecidos[conhecidos.length - 1]);
    const inicio = Math.max(indiceDe(conhecidos[0]), fim - (meses - 1));

    const placa = num(previstoPlaca);
    const serie = [];
    for (let i = inicio; i <= fim; i += 1) {
        const mes = chaveDe(i);
        const fech = fechamento.get(mes) ?? null;
        const fat = medidoNaFatura.get(mes) ?? null;
        const previsto = previstoDoMes.get(mes) ?? (placa !== null && placa > 0 ? placa : null);

        if (fech !== null && fech > 0) {
            serie.push({ mes, kwh: fech, previsto, origem: 'fechamento' });
        } else if (fat !== null && fat > 0) {
            serie.push({ mes, kwh: fat, previsto, origem: 'fatura' });
        } else {
            serie.push({ mes, kwh: null, previsto, origem: 'previsto' });
        }
    }
    return serie;
}
