import { describe, it, expect } from 'vitest';
import { mesesFaltantes } from './ciclos';

describe('mesesFaltantes', () => {
    it('acha o buraco de julho entre junho e agosto', () => {
        // O caso real da UFV Bom Jesus em 10/09/2026.
        const meses = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-08'];
        expect(mesesFaltantes(meses)).toEqual(['2026-07']);
    });

    it('aceita datas completas e ignora o dia', () => {
        expect(mesesFaltantes(['2026-06-01', '2026-08-01'])).toEqual(['2026-07']);
    });

    it('não inventa meses antes do primeiro nem depois do último fechamento', () => {
        expect(mesesFaltantes(['2026-08'])).toEqual([]);
        expect(mesesFaltantes([])).toEqual([]);
        expect(mesesFaltantes(['2026-07', '2026-08'])).toEqual([]);
    });

    it('atravessa a virada do ano', () => {
        expect(mesesFaltantes(['2025-11', '2026-02'])).toEqual(['2025-12', '2026-01']);
    });

    it('lista vários buracos em ordem e não repete mês duplicado na entrada', () => {
        expect(mesesFaltantes(['2026-01', '2026-01', '2026-04', '2026-06']))
            .toEqual(['2026-02', '2026-03', '2026-05']);
    });

    it('descarta chave malformada em vez de gerar meses inválidos', () => {
        expect(mesesFaltantes(['2026-06', 'sem data', null, '2026-08'])).toEqual(['2026-07']);
    });
});
