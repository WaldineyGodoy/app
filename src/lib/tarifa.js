/**
 * Composição da tarifa líquida do investidor.
 *
 * A mesma cadeia que o PlantAnalyticsModal do CRM já mostrava ao administrador,
 * extraída para cá porque agora o investidor também a vê em /fornecedores.
 * Enquanto as duas telas tiverem contas próprias elas vão divergir, e divergir
 * numa conta que vira dinheiro no fim do mês.
 *
 *   Tarifa de energia
 *   − desconto do assinante
 *   − Fio B                (isento em GD1)
 *   − tributos             (só em geração compartilhada)
 *   = base da gestão
 *   − taxa de gestão B2W
 *   = tarifa líquida do investidor
 *
 * Regra do projeto: insumo ausente propaga null e o chamador mostra travessão.
 * Aqui isso não é preciosismo — alíquota faltando tratada como zero exibia ao
 * investidor uma tarifa líquida ~34% maior que a real numa usina de GC.
 */

/** Colunas da tabela `Concessionaria` por classe tarifária da usina. */
const COLUNAS = {
    'B1 Residencial': ['Tarifa Concessionaria', 'Desconto Assinante', 'Fio B'],
    'B2 Rural': ['Tarifa Concessionaria_B2', 'Desconto Assinante_B2', 'Fio B_B2'],
    'B3 Comercial': ['Tarifa Concessionaria_B3', 'Desconto Assinante_B3', 'Fio B_B3'],
    'Grupo A': ['Tarifa Concessionaria_A', 'Desconto Assinante_A', 'Fio B_A'],
};

const GRUPO_PADRAO = 'B1 Residencial';

const num = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
};

/**
 * @param {object} usina  linha de `usinas` (grupo_tarifario, gestao_percentual,
 *                        modalidade, modalidade_gd)
 * @param {object} linha  linha de `Concessionaria` da distribuidora da usina
 * @returns {object|null} null quando não há linha de tarifas para a distribuidora
 */
export function componentesTarifarios(usina, linha) {
    if (!usina || !linha) return null;

    const grupo = usina.grupo_tarifario || GRUPO_PADRAO;
    const [colTarifa, colDesconto, colFioB] = COLUNAS[grupo] || COLUNAS[GRUPO_PADRAO];

    const tarifa = num(linha[colTarifa]);
    const descontoPercent = num(linha[colDesconto]);
    const fioBBruto = num(linha[colFioB]);

    // GD1 não paga Fio B. Isento é zero de verdade, não dado faltante.
    const isGD1 = usina.modalidade_gd === 'GD1';
    const fioB = isGD1 ? 0 : fioBBruto;

    const gestaoPercent = num(usina.gestao_percentual);

    const isCompartilhada = usina.modalidade === 'geracao_compartilhada';
    const icmsPercent = num(linha.ICMS);
    const pisPercent = num(linha.PIS);
    const cofinsPercent = num(linha.COFINS);

    const faltando = [];
    if (tarifa === null) faltando.push('tarifa de energia');
    if (descontoPercent === null) faltando.push('desconto do assinante');
    if (fioB === null) faltando.push('Fio B');
    if (gestaoPercent === null) faltando.push('percentual de gestão');

    // Tributos entram só em geração compartilhada. O Fio B sai da base porque já
    // chega tributado na conta; o ICMS incide primeiro e PIS/COFINS sobre o que
    // sobra depois dele.
    let icms = 0;
    let pisCofins = 0;
    let tributos = 0;
    if (isCompartilhada) {
        const temAliquotas = icmsPercent !== null && pisPercent !== null && cofinsPercent !== null;
        if (!temAliquotas || tarifa === null || fioBBruto === null) {
            faltando.push('alíquotas de ICMS, PIS e COFINS');
            tributos = null;
        } else {
            const base = tarifa - fioBBruto;
            icms = base * (icmsPercent / 100);
            pisCofins = (base - icms) * ((pisPercent + cofinsPercent) / 100);
            tributos = icms + pisCofins;
        }
    }

    const completo = faltando.length === 0 && tributos !== null;

    const descontoReais = completo ? tarifa * (descontoPercent / 100) : null;
    const baseGestao = completo ? tarifa - descontoReais - fioB - tributos : null;
    const gestaoReais = completo ? baseGestao * (gestaoPercent / 100) : null;
    const liquida = completo ? baseGestao - gestaoReais : null;

    return {
        grupo,
        tarifa,
        descontoPercent,
        descontoReais,
        fioB,
        fioBIsento: isGD1,
        isCompartilhada,
        icmsPercent,
        pisPercent,
        cofinsPercent,
        icms: isCompartilhada ? icms : null,
        pisCofins: isCompartilhada ? pisCofins : null,
        tributos: isCompartilhada ? tributos : null,
        baseGestao,
        gestaoPercent,
        gestaoReais,
        liquida,
        faltando,
    };
}
