// Formatadores da área do investidor.
// Regra do projeto: dado faltante propaga null e aparece como travessão — nunca vira zero.

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dec = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dec2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const isBlank = (v) => v === null || v === undefined || v === '' || Number.isNaN(Number(v));

export const money = (v) => (isBlank(v) ? '—' : brl.format(Number(v)));

/** Valor absoluto em reais, sem o sinal — para colunas de crédito/débito. */
export const moneyAbs = (v) => (isBlank(v) ? '—' : brl.format(Math.abs(Number(v))));

export const kwh = (v) => (isBlank(v) ? '—' : `${dec.format(Number(v))} kWh`);

export const kwp = (v) => (isBlank(v) ? '—' : `${dec2.format(Number(v))} kWp`);

export const percent = (v, digits = 1) =>
    isBlank(v) ? '—' : `${digits === 0 ? dec.format(Number(v)) : dec1.format(Number(v))}%`;

/** '2026-04-01' → { mes: 'ABR', ano: '26', longo: 'Abril de 2026' } */
export const cycleLabel = (isoDate) => {
    if (!isoDate) return { curto: '—', mes: '—', ano: '', longo: '—' };
    const [y, m] = String(isoDate).split('-');
    const curtos = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const longos = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const i = Number(m) - 1;
    return {
        curto: `${curtos[i]}/${y.slice(2)}`,
        mes: curtos[i],
        ano: y.slice(2),
        longo: `${longos[i]} de ${y}`,
    };
};

export const dateShort = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

export const dateTime = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
};

/** Arredonda para centavos, evitando o resíduo de ponto flutuante da soma do razão. */
export const cents = (v) => Math.round(Number(v || 0) * 100) / 100;

/** Mostra só o suficiente da chave PIX para o dono reconhecê-la. */
export const maskPix = (key, type) => {
    if (!key) return '—';
    const k = String(key);
    if (type === 'aleatoria') return `••••${k.slice(-6)}`;
    if (k.length <= 6) return k;
    return `${k.slice(0, 3)}••••${k.slice(-4)}`;
};

const MODALIDADES = {
    auto_consumo_remoto: 'Autoconsumo remoto',
    geracao_compartilhada: 'Geração compartilhada',
    gd2: 'GD II',
};
export const modalidade = (v) => MODALIDADES[v] || v || '—';

const STATUS_USINA = {
    gerando: { rotulo: 'Gerando', tom: 'sun' },
    em_conexao: { rotulo: 'Em conexão', tom: 'neutro' },
    manutencao: { rotulo: 'Manutenção', tom: 'rust' },
    inativa: { rotulo: 'Inativa', tom: 'neutro' },
};
export const statusUsina = (v) => STATUS_USINA[v] || { rotulo: v || 'Sem status', tom: 'neutro' };

const STATUS_CICLO = {
    em_producao: { rotulo: 'Em produção', tom: 'neutro', nota: 'Rascunho do mês, ainda aberto.' },
    fechado: { rotulo: 'Fechado', tom: 'sun', nota: 'Apurado e lançado no razão. Repasse ainda não liberado.' },
    liquidado: { rotulo: 'Liquidado', tom: 'verdigris', nota: 'Repasse enviado ao banco.' },
};
export const statusCiclo = (v) => STATUS_CICLO[v] || { rotulo: v || '—', tom: 'neutro', nota: '' };
