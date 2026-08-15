import { describe, it, expect } from 'vitest';
import { calcularCapacidade, ocupaFranquia, autoconsumoMedidoGeradora } from './capacidade';

// Cadastros reais do Novo Leblon medidos em 11/08/2026, para o caso ficar concreto.
const NOVO_LEBLON = [
    { tipo_unidade: 'geradora', status: 'ativo', franquia: 300 },
    { tipo_unidade: 'beneficiaria', status: 'ativo', franquia: 300 },
];

describe('calcularCapacidade', () => {
    it('poe a geradora no autoconsumo, nao no comprometido', () => {
        const r = calcularCapacidade({ ucs: NOVO_LEBLON, geracao: 1192 });
        expect(r.autoconsumoUG).toBe(300);
        expect(r.comprometido).toBe(300);
        expect(r.disponivel).toBe(892);
    });

    // A asercao que prova que nada e' contado duas vezes: o livre tem de bater
    // com a geracao menos a soma de TODAS as franquias, calculada aqui de forma
    // independente da implementacao.
    it('o livre bate com geracao menos a soma de todas as franquias', () => {
        const somaTodas = NOVO_LEBLON.reduce((a, uc) => a + uc.franquia, 0);
        const r = calcularCapacidade({ ucs: NOVO_LEBLON, geracao: 1192 });
        expect(r.livre).toBe(1192 - somaTodas);
    });

    it('mede a ocupacao sobre o disponivel, nao sobre a geracao bruta', () => {
        const r = calcularCapacidade({ ucs: NOVO_LEBLON, geracao: 1192 });
        // 300 / 892, nao 300 / 1192
        expect(r.ocupacao).toBeCloseTo(33.63, 2);
    });

    it('usina sem geradora tem autoconsumo zero', () => {
        const ucs = [{ tipo_unidade: 'beneficiaria', status: 'ativo', franquia: 200 }];
        const r = calcularCapacidade({ ucs, geracao: 1000 });
        expect(r.autoconsumoUG).toBe(0);
        expect(r.disponivel).toBe(1000);
        expect(r.comprometido).toBe(200);
    });

    it('cancelado_inadimplente devolve a franquia para a usina', () => {
        const ucs = [
            { tipo_unidade: 'beneficiaria', status: 'ativo', franquia: 100 },
            { tipo_unidade: 'beneficiaria', status: 'cancelado_inadimplente', franquia: 500 },
        ];
        expect(calcularCapacidade({ ucs, geracao: 1000 }).comprometido).toBe(100);
    });

    it('geradora desconectada nao consome autoconsumo', () => {
        const ucs = [{ tipo_unidade: 'geradora', status: 'desconectado', franquia: 300 }];
        const r = calcularCapacidade({ ucs, geracao: 1000 });
        expect(r.autoconsumoUG).toBe(0);
        expect(r.disponivel).toBe(1000);
    });

    // Regra dura do projeto: dado faltante propaga null, nunca vira zero.
    it('geracao ausente propaga null em vez de zero', () => {
        const r = calcularCapacidade({ ucs: NOVO_LEBLON, geracao: null });
        expect(r.geracao).toBeNull();
        expect(r.disponivel).toBeNull();
        expect(r.livre).toBeNull();
        expect(r.ocupacao).toBeNull();
        // o que nao depende da geracao continua sendo numero
        expect(r.comprometido).toBe(300);
        expect(r.autoconsumoUG).toBe(300);
    });

    it('franquia nula conta como zero, sem virar NaN', () => {
        const ucs = [{ tipo_unidade: 'beneficiaria', status: 'ativo', franquia: null }];
        expect(calcularCapacidade({ ucs, geracao: 500 }).comprometido).toBe(0);
    });

    it('nao quebra sem UC nenhuma', () => {
        const r = calcularCapacidade({ ucs: [], geracao: 500 });
        expect(r.comprometido).toBe(0);
        expect(r.livre).toBe(500);
    });

    it('duas geradoras: autoconsumo soma ambas, livre bate com geracao menos todas as franquias', () => {
        const ucs = [
            { tipo_unidade: 'geradora', status: 'ativo', franquia: 300 },
            { tipo_unidade: 'geradora', status: 'ativo', franquia: 200 },
            { tipo_unidade: 'beneficiaria', status: 'ativo', franquia: 100 },
        ];
        const somaTodas = ucs.reduce((a, uc) => a + uc.franquia, 0);
        const r = calcularCapacidade({ ucs, geracao: 1000 });
        expect(r.autoconsumoUG).toBe(500);
        expect(r.comprometido).toBe(100);
        expect(r.disponivel).toBe(500);
        expect(r.livre).toBe(1000 - somaTodas);
    });

    it('geracao igual ao autoconsumo: disponivel zero, ocupacao null, livre negativo', () => {
        const ucs = [
            { tipo_unidade: 'geradora', status: 'ativo', franquia: 300 },
            { tipo_unidade: 'beneficiaria', status: 'ativo', franquia: 100 },
        ];
        const r = calcularCapacidade({ ucs, geracao: 300 });
        expect(r.disponivel).toBe(0);
        expect(r.ocupacao).toBeNull();
        expect(r.livre).toBe(-100);
        expect(r.geracao).toBe(300);
    });

    it('geracao zero: disponivel zero, ocupacao null, livre negativo', () => {
        const ucs = [
            { tipo_unidade: 'beneficiaria', status: 'ativo', franquia: 100 },
        ];
        const r = calcularCapacidade({ ucs, geracao: 0 });
        expect(r.disponivel).toBe(0);
        expect(r.ocupacao).toBeNull();
        expect(r.livre).toBe(-100);
    });

    it('geracao menor que autoconsumo: disponivel negativo, ocupacao null, livre negativo', () => {
        const ucs = [
            { tipo_unidade: 'geradora', status: 'ativo', franquia: 300 },
            { tipo_unidade: 'beneficiaria', status: 'ativo', franquia: 100 },
        ];
        const r = calcularCapacidade({ ucs, geracao: 200 });
        expect(r.disponivel).toBe(-100);
        expect(r.ocupacao).toBeNull();
        expect(r.livre).toBe(-200);
    });
});

describe('autoconsumoMedidoGeradora', () => {
    // A UC geradora nao tem boleto de assinante: invoices.status descreve uma
    // cobranca que nao existe para ela. Esta e' a asercao que falharia se
    // alguem reintroduzisse `f.status === 'cancelado'` no filtro (regressao
    // corrigida pela 3a vez nesta base, ver commit c74a2e2).
    it('conta a leitura mesmo com status cancelado', () => {
        const faturas = [{ status: 'cancelado', consumo_compensado: 125 }];
        expect(autoconsumoMedidoGeradora(faturas)).toBe(125);
    });

    it('conta a leitura mesmo com status sem_faturamento', () => {
        const faturas = [{ status: 'sem_faturamento', consumo_compensado: 80 }];
        expect(autoconsumoMedidoGeradora(faturas)).toBe(80);
    });

    it('ignora fatura sem leitura (consumo_compensado null)', () => {
        const faturas = [{ status: 'ativo', consumo_compensado: null }];
        expect(autoconsumoMedidoGeradora(faturas)).toBeNull();
    });

    it('soma so as faturas com leitura, ignorando as sem leitura no mesmo grupo', () => {
        const faturas = [
            { status: 'cancelado', consumo_compensado: 125 },
            { status: 'ativo', consumo_compensado: null },
            { status: 'sem_faturamento', consumo_compensado: 25 },
        ];
        expect(autoconsumoMedidoGeradora(faturas)).toBe(150);
    });

    it('nenhuma fatura devolve null, nunca zero', () => {
        expect(autoconsumoMedidoGeradora([])).toBeNull();
        expect(autoconsumoMedidoGeradora()).toBeNull();
    });
});

describe('ocupaFranquia', () => {
    it('libera a franquia so nos tres estados de saida', () => {
        expect(ocupaFranquia({ status: 'ativo' })).toBe(true);
        expect(ocupaFranquia({ status: 'em_atraso' })).toBe(true);
        expect(ocupaFranquia({ status: 'aguardando_conexao' })).toBe(true);
        expect(ocupaFranquia({ status: 'desconectado' })).toBe(false);
        expect(ocupaFranquia({ status: 'cancelado' })).toBe(false);
        expect(ocupaFranquia({ status: 'cancelado_inadimplente' })).toBe(false);
    });
});
