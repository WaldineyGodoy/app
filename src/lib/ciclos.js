/**
 * Meses que a régua de ciclos precisa mostrar como ausentes.
 *
 * `generation_production` só tem linha para mês que alguém fechou. Quando um mês
 * do meio não foi fechado ele simplesmente some da tela, e sumir é pior que
 * aparecer vazio: julho/2026 da UFV Bom Jesus desapareceu entre junho e agosto
 * sem que nada dissesse ao investidor que aquele mês existiu e ficou sem apuração.
 *
 * Só buracos INTERNOS viram marcador. Antes do primeiro fechamento a usina não
 * tinha o que fechar, e depois do último o mês ainda pode estar em curso.
 *
 * @param {string[]} mesesPresentes chaves 'YYYY-MM' dos meses que têm fechamento
 * @returns {string[]} chaves 'YYYY-MM' faltantes, em ordem crescente
 */
export function mesesFaltantes(mesesPresentes) {
    const chaves = [...new Set((mesesPresentes || []).filter(Boolean).map((m) => String(m).slice(0, 7)))]
        .filter((m) => /^\d{4}-\d{2}$/.test(m))
        .sort();
    if (chaves.length < 2) return [];

    const existentes = new Set(chaves);
    const indice = (chave) => {
        const [ano, mes] = chave.split('-').map(Number);
        return ano * 12 + (mes - 1);
    };
    const chaveDe = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

    const faltantes = [];
    const fim = indice(chaves[chaves.length - 1]);
    for (let i = indice(chaves[0]) + 1; i < fim; i += 1) {
        const chave = chaveDe(i);
        if (!existentes.has(chave)) faltantes.push(chave);
    }
    return faltantes;
}
