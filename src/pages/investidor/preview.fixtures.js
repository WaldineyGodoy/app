/**
 * Dados de exemplo para abrir o painel sem autenticar (rota só de desenvolvimento).
 *
 * Extraídos do banco de produção em 10/08/2026, sob o papel `authenticated` com o
 * uid do fornecedor TOBIAS BERTUSSI — ou seja, exatamente o recorte que a RLS
 * devolve a ele. Valores, sinais, casas decimais e datas são os reais, inclusive
 * as inconsistências: ciclo liquidado sem saldo gravado, serviços que já embutem
 * a conta de energia, lançamentos com descrição de crédito e valor de débito, e
 * montantes com três casas decimais.
 *
 * Nomes de assinantes e números de UC foram trocados por equivalentes de mesmo
 * formato e comprimento — o teste visual é idêntico e nenhum dado de cliente
 * fica gravado no repositório.
 */

const usina = (over) => ({
    concessionaria: 'Neoenergia Cosern', ultimoApurado: null, ciclos: 0, ...over,
});

const U1 = '9bf1349b-6c79-4f68-a8e4-bc00f00850f5'; // UFV Bom Jesus

export const usinas = [
    usina({
        id: '82bf2a2d-2382-45c5-9f6d-f0adf5031b5a',
        name: 'UFV - Potengi - SPP',
        status: 'manutencao',
        modalidade: 'auto_consumo_remoto',
        potencia_kwp: 100.82,
        geracao_estimada_kwh: 13401,
        unidade_geradora: '',
        address: { cidade: 'São Paulo do Potengi', uf: 'RN' },
        // Sem UC geradora cadastrada: autoconsumo zero, disponível = geração bruta.
        ucsBeneficiarias: 0, ucsAtivas: 0, comprometido: 0,
        autoconsumoUG: 0, disponivelPrevisto: 13401, livre: 13401, ocupacao: 0,
        compensadoUltimo: null, ucsComFatura: 0, entrantes: 0, franquiaEntrantes: 0,
    }),
    usina({
        id: U1,
        name: 'UFV Bom Jesus',
        status: 'gerando',
        modalidade: 'auto_consumo_remoto',
        potencia_kwp: 100.8,
        geracao_estimada_kwh: 13558,
        unidade_geradora: '7029875701',
        address: { cidade: 'Bom Jesus', uf: 'RN' },
        // 14 beneficiárias cadastradas, 12 com status que ocupa franquia. As duas
        // fora (cancelado e cancelado_inadimplente) somam 1.600 kWh. A UC 7030839166
        // foi ativada em 10/08/2026 e trouxe 4.500 kWh — daí o overbook real.
        // A UG é faturada pelo mínimo: autoconsumo pequeno (100 kWh/mês), que ainda
        // assim reduz o disponível e piora o overbook, nunca melhora.
        ucsBeneficiarias: 14,
        ucsAtivas: 12,
        comprometido: 14271,
        autoconsumoUG: 100,
        disponivelPrevisto: 13558 - 100,
        livre: (13558 - 100) - 14271,
        ocupacao: (14271 / (13558 - 100)) * 100,
        ultimoApurado: { mes_referencia: '2026-04-01', geracao_mensal_kwh: 14664 },
        compensadoUltimo: 10853,
        ucsComFatura: 12,
        // A UC 7030839166 (4.500 kWh) só conectou em 09/06/2026, depois do ciclo de abril.
        entrantes: 1,
        franquiaEntrantes: 4500,
        ciclos: 6,
    }),
    usina({
        id: '7c49ff51-c04b-4135-8a90-3a257d2efe94',
        name: 'UFV Bom Jesus II',
        status: 'manutencao',
        modalidade: 'gd2',
        potencia_kwp: 102.24,
        geracao_estimada_kwh: 13751,
        unidade_geradora: '',
        address: { cidade: 'Bom Jesus', uf: 'RN' },
        // Sem UC geradora cadastrada: autoconsumo zero, disponível = geração bruta.
        ucsBeneficiarias: 0, ucsAtivas: 0, comprometido: 0,
        autoconsumoUG: 0, disponivelPrevisto: 13751, livre: 13751, ocupacao: 0,
        compensadoUltimo: null, ucsComFatura: 0, entrantes: 0, franquiaEntrantes: 0,
    }),
];

const ciclo = (over) => ({ usina_id: U1, usinaNome: 'UFV Bom Jesus', ...over });

export const cycles = [
    ciclo({
        id: 'ac118c87', mes_referencia: '2026-06-01',
        compensadoApurado: 5916, ucsComFatura: 6, status: 'em_producao',
        geracao_mensal_kwh: 0, geracao_prevista: 11592, energia_compensada: 0,
        faturamento_mensal: 0, custo_disponibilidade: 0, manutencao: 0, gestao_reais: 0,
        arrendamento: 600, servicos: 155.9, total_despesas: 755.9, saldo_receber: -755.9,
        service_details: { 'Água': 76, Internet: 79.9 }, despesas_eventuais: {},
    }),
    ciclo({
        id: 'ad695e72', mes_referencia: '2026-05-01',
        compensadoApurado: 10039, ucsComFatura: 12, status: 'em_producao',
        geracao_mensal_kwh: 0, geracao_prevista: 12600, energia_compensada: 0,
        faturamento_mensal: 5833.183840000001, custo_disponibilidade: 0, manutencao: 0,
        gestao_reais: 583.32, arrendamento: 600, servicos: 155.9,
        total_despesas: 755.9, saldo_receber: 4493.96,
        service_details: { 'Água': 76, Internet: 79.9 }, despesas_eventuais: {},
    }),
    ciclo({
        id: '4d193cdc', mes_referencia: '2026-04-01', status: 'liquidado',
        // A coluna gravou 3.761; as faturas das beneficiárias somam 10.853.
        compensadoApurado: 10853, ucsComFatura: 12,
        geracao_mensal_kwh: 14664, geracao_prevista: 13709, energia_compensada: 3761,
        faturamento_mensal: 2655.8428999999996, custo_disponibilidade: 110.2, manutencao: 0,
        gestao_reais: 0, arrendamento: 0, servicos: 266.1,
        total_despesas: 266.1, saldo_receber: null,
        service_details: { 'Água': 76, Energia: 110.2, Internet: 79.9, 'Segurança': 0 },
        despesas_eventuais: {},
    }),
    ciclo({
        id: '7480a5e5', mes_referencia: '2026-03-01',
        compensadoApurado: 11301, ucsComFatura: 8, status: 'fechado',
        geracao_mensal_kwh: 13552, geracao_prevista: 14515, energia_compensada: 4333,
        faturamento_mensal: 0, custo_disponibilidade: 102, manutencao: 0, gestao_reais: 0,
        arrendamento: 0, servicos: 42, total_despesas: 144, saldo_receber: 144,
        service_details: {}, despesas_eventuais: {},
    }),
    ciclo({
        id: 'f0335809', mes_referencia: '2026-02-01',
        compensadoApurado: null, ucsComFatura: 0, status: 'fechado',
        geracao_mensal_kwh: 12386, geracao_prevista: 14515, energia_compensada: 4333,
        faturamento_mensal: 0, custo_disponibilidade: 102, manutencao: 0, gestao_reais: 0,
        arrendamento: 0, servicos: 42, total_despesas: 144, saldo_receber: 144,
        service_details: {}, despesas_eventuais: {},
    }),
    ciclo({
        id: '8919389a', mes_referencia: '2026-01-01',
        compensadoApurado: null, ucsComFatura: 0, status: 'em_producao',
        geracao_mensal_kwh: 725, geracao_prevista: 13810, energia_compensada: 0,
        faturamento_mensal: 0, custo_disponibilidade: 0, manutencao: 0, gestao_reais: 0,
        arrendamento: 600, servicos: 155.9, total_despesas: 755.9, saldo_receber: -755.9,
        service_details: { 'Água': 76, Internet: 79.9 }, despesas_eventuais: {},
    }),
];

// Razão, do mais antigo para o mais novo — a mesma ordem que o banco devolve.
// [data, valor no razão, descrição]. Valor negativo = crédito ao investidor.
const brutos = [
    ['2026-06-10T01:01:42.071836Z', -393.83, 'Aurora Bandeira - UC 7029990055 - 753 Kwh'],
    ['2026-06-10T01:02:32.007960Z', -299.16, 'Aurora Bandeira - UC 70304455 - 572 Kwh'],
    ['2026-06-10T01:02:53.167704Z', -238.77, 'Aurora Bandeira - UC 70304579 - 456,54 Kwh'],
    ['2026-06-10T01:03:32.045607Z', -566.94, 'TRANSPORTES MERIDIANO - UC 7030245380 - 1084 Kwh'],
    ['2026-06-10T01:03:54.619964Z', -74.95, 'TRANSPORTES MERIDIANO - UC 70303858 - 143,3 Kwh'],
    ['2026-06-10T01:04:10.296948Z', -1413.17, 'TRANSPORTES MERIDIANO - UC 70303955 - 2702 Kwh'],
    ['2026-06-10T01:04:34.653781Z', -7.95, 'TRANSPORTES MERIDIANO - UC 70303980 - 15,21 Kwh'],
    ['2026-06-10T01:04:57.905751Z', -376.57, 'TRANSPORTES MERIDIANO - UC 70304021 - 720 Kwh'],
    ['2026-06-10T01:05:14.754117Z', -438.80, 'TRANSPORTES MERIDIANO - UC 70304129 - 839 Kwh'],
    ['2026-06-10T01:05:33.255584Z', -553.87, 'TRANSPORTES MERIDIANO - UC 70304188 - 1059 Kwh'],
    ['2026-06-10T01:05:52.595801Z', -658.47, 'TRANSPORTES MERIDIANO - UC 70304366 - 1259 Kwh'],
    ['2026-06-10T01:06:26.676918Z', -653.76, 'SEBASTIANA DO CARMO DE - UC 7030043183 - 1250 Kwh'],
    ['2026-06-10T01:15:39.866315Z', 79.90, 'Internet '],
    ['2026-06-10T01:16:01.962837Z', 600, 'Arrendamento de area'],
    ['2026-06-10T01:16:22.863379Z', 76, 'Agua'],
    ['2026-06-10T01:16:35.924903Z', 109.79, 'Energia'],
    ['2026-06-10T18:28:18.160587Z', -1668.76, 'COND RESID ALVORADA PARQUE - UC 7030839166 -   3221 Kwh'],
    ['2026-06-10T20:27:41.745518Z', 4479.31, 'Pagamento Transferência/PIX'],
    ['2026-06-11T15:54:24.184037Z', 1999.9999999999998, 'Pagamento Transferência/PIX'],
    ['2026-07-01T15:21:35.510359Z', 186.28, 'Crédito Repasse Investidor'],
    ['2026-07-01T15:35:47.146218Z', -80.109, 'Crédito Repasse Investidor'],
    ['2026-07-07T03:20:12.564122Z', -672.039, 'Crédito Repasse Investidor'],
    ['2026-07-07T03:20:12.564122Z', -546.543, 'Crédito Repasse Investidor'],
    ['2026-07-07T03:20:12.564122Z', -1395.828, 'Crédito Repasse Investidor'],
    ['2026-07-09T19:25:25.381197Z', 0, 'Crédito Repasse Investidor'],
    ['2026-07-09T19:25:25.381197Z', 40.74, 'Crédito Repasse Investidor'],
    ['2026-07-09T19:25:25.381197Z', 347.64, 'Crédito Repasse Investidor'],
    ['2026-07-09T19:25:25.381197Z', 99.46, 'Crédito Repasse Investidor'],
    ['2026-07-09T19:25:25.381197Z', 142.9379999999999, 'Crédito Repasse Investidor'],
    ['2026-07-09T19:25:25.381197Z', 346.59, 'Crédito Repasse Investidor'],
    ['2026-07-09T19:25:25.381197Z', 0, 'Crédito Repasse Investidor'],
    ['2026-07-09T19:25:25.381197Z', 0, 'Crédito Repasse Investidor'],
    ['2026-07-09T22:30:18.946901Z', 1530.87, 'Ajuste de conta - Contestação na concessionaria'],
    ['2026-07-09T22:33:41.546058Z', 265.69, 'Despesas Fixas: Serviços (Net/Seg/Agua/En) - Junho/2026'],
    ['2026-07-09T22:33:41.546058Z', 600, 'Despesa Fixa: Arrendamento - Junho/2026'],
    ['2026-07-10T00:47:31.014935Z', -6732.11, 'Credito de Kwh compensados em clientes - 12218 kwh ( R$ 0,551) '],
    ['2026-07-10T01:13:20.697114Z', 5000, 'Pagamento Transferência/PIX'],
    ['2026-07-10T12:26:18.683413Z', 866.42, 'Pagamento Transferência/PIX'],
    ['2026-08-01T00:05:00.223185Z', 600, 'Despesa Fixa: Arrendamento - Julho/2026'],
    ['2026-08-01T00:05:00.223185Z', 265.69, 'Despesas Fixas: Serviços (Net/Seg/Agua/En) - Julho/2026'],
    ['2026-08-06T20:12:50.836983Z', -1408.9716000000005, 'Crédito Repasse Investidor'],
    ['2026-08-06T20:12:50.836983Z', -493.0416, 'Crédito Repasse Investidor'],
    ['2026-08-06T20:12:50.836983Z', -502.6770000000001, 'Crédito Repasse Investidor'],
    ['2026-08-06T20:12:50.836983Z', -479.0646000000001, 'Crédito Repasse Investidor'],
];

const cents = (v) => Math.round(v * 100) / 100;

// Mesma acumulação do useInvestorData: precisão cheia, arredondamento só na exibição.
let corrente = 0;
export const entries = brutos.map(([created_at, amount, description], i) => {
    const efeito = -amount;
    corrente += efeito;
    return {
        id: `e${i}`, transaction_id: `t${i}`, created_at, amount, description,
        account_code: '2.1.1', efeito, saldoCorrente: corrente,
    };
}).reverse();

export const balance = {
    total: cents(corrente),
    creditos: cents(brutos.filter(([, a]) => a < 0).reduce((s, [, a]) => s - a, 0)),
    debitos: cents(brutos.filter(([, a]) => a > 0).reduce((s, [, a]) => s + a, 0)),
    nCreditos: brutos.filter(([, a]) => a < 0).length,
    nDebitos: brutos.filter(([, a]) => a > 0).length,
    ultimoLancamento: brutos[brutos.length - 1][0],
};

export const supplier = {
    id: '83dfcbcd-eab4-4a1c-9da4-5360ee96331a',
    name: 'TOBIAS BERTUSSI',
    pix_key: 'e95484ec-8600-4794-868b-9bdbb1365366',
    pix_key_type: 'aleatoria',
};
