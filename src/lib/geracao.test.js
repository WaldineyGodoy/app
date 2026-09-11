import { describe, it, expect } from 'vitest';
import { serieDeInjecao } from './geracao';

// O caso real da UFV Bom Jesus em 10/09/2026, com as três origens presentes.
const CICLOS = [
    { mes_referencia: '2026-01-01', geracao_mensal_kwh: '725', geracao_prevista: '13810' },
    { mes_referencia: '2026-02-01', geracao_mensal_kwh: '12386', geracao_prevista: '14515' },
    { mes_referencia: '2026-03-01', geracao_mensal_kwh: '13552', geracao_prevista: '14515' },
    { mes_referencia: '2026-04-01', geracao_mensal_kwh: '14664', geracao_prevista: '13709' },
    { mes_referencia: '2026-05-01', geracao_mensal_kwh: '0', geracao_prevista: '12600' },
    { mes_referencia: '2026-06-01', geracao_mensal_kwh: '0', geracao_prevista: '11592' },
    { mes_referencia: '2026-08-01', geracao_mensal_kwh: null, geracao_prevista: null },
];
const FATURAS_UG = [
    { mes_referencia: '2026-05-01', energia_injetada: '12218' },
    { mes_referencia: '2026-06-01', energia_injetada: '12935' },
    { mes_referencia: '2026-07-01', energia_injetada: '13119' },
    { mes_referencia: '2026-08-01', energia_injetada: '12477' },
];

describe('serieDeInjecao', () => {
    const serie = serieDeInjecao({
        ciclos: CICLOS, faturasUG: FATURAS_UG, previstoPlaca: 13558, ate: '2026-09', meses: 12,
    });
    const por = Object.fromEntries(serie.map((p) => [p.mes, p]));

    it('cobre de janeiro ao mês pedido, inclusive o mês sem fechamento', () => {
        expect(serie.map((p) => p.mes)).toEqual([
            '2026-01', '2026-02', '2026-03', '2026-04', '2026-05',
            '2026-06', '2026-07', '2026-08', '2026-09',
        ]);
    });

    it('prefere o fechamento quando ele tem número', () => {
        expect(por['2026-04']).toMatchObject({ kwh: 14664, origem: 'fechamento' });
        // 725 kWh é pouco, mas é medição real do mês em que a usina entrou.
        expect(por['2026-01']).toMatchObject({ kwh: 725, origem: 'fechamento' });
    });

    it('cai na fatura da UG quando o fechamento está zerado', () => {
        expect(por['2026-05']).toMatchObject({ kwh: 12218, origem: 'fatura' });
        expect(por['2026-06']).toMatchObject({ kwh: 12935, origem: 'fatura' });
    });

    it('usa a fatura quando não existe linha de fechamento nenhuma', () => {
        expect(por['2026-07']).toMatchObject({ kwh: 13119, origem: 'fatura' });
    });

    it('usa a fatura quando o fechamento existe com geração nula', () => {
        expect(por['2026-08']).toMatchObject({ kwh: 12477, origem: 'fatura' });
    });

    it('marca como previsto o mês sem medição e usa o valor de placa', () => {
        expect(por['2026-09']).toMatchObject({ kwh: null, previsto: 13558, origem: 'previsto' });
    });

    it('prefere a previsão do próprio mês ao valor de placa', () => {
        expect(por['2026-02'].previsto).toBe(14515);
    });

    it('soma faturas da geradora no mesmo mês', () => {
        const s = serieDeInjecao({
            ciclos: [{ mes_referencia: '2026-03-01', geracao_mensal_kwh: 0 }],
            faturasUG: [
                { mes_referencia: '2026-03-01', energia_injetada: 6000 },
                { mes_referencia: '2026-03-01', energia_injetada: 4000 },
            ],
            ate: '2026-03',
        });
        expect(s).toEqual([{ mes: '2026-03', kwh: 10000, previsto: null, origem: 'fatura' }]);
    });

    it('respeita o limite de meses, mantendo os mais recentes', () => {
        const s = serieDeInjecao({
            ciclos: CICLOS, faturasUG: FATURAS_UG, previstoPlaca: 13558, ate: '2026-09', meses: 3,
        });
        expect(s.map((p) => p.mes)).toEqual(['2026-07', '2026-08', '2026-09']);
    });

    it('devolve vazio quando não há nenhuma medição', () => {
        expect(serieDeInjecao({ ciclos: [], faturasUG: [], previstoPlaca: 13558, ate: '2026-09' }))
            .toEqual([]);
    });

    it('não corta medição posterior ao mês pedido', () => {
        const s = serieDeInjecao({
            ciclos: [], faturasUG: [{ mes_referencia: '2026-10-01', energia_injetada: 900 }],
            ate: '2026-09',
        });
        expect(s[s.length - 1]).toMatchObject({ mes: '2026-10', kwh: 900 });
    });
});
