# Autoconsumo da UC geradora — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar "ocupa capacidade" de "é assinante", pondo o autoconsumo da UC geradora do lado da oferta (reduzindo a geração disponível) em vez de somá-lo ao comprometido das beneficiárias.

**Architecture:** Uma função pura em `src/lib/capacidade.js` passa a ser a única dona da aritmética de capacidade. O painel do admin e a área nova do investidor consomem essa função; nenhuma tela refaz a conta. O modal da UC ganha o campo `tipo_unidade` e passa a se comportar diferente quando a UC é geradora.

**Tech Stack:** React 19, Vite 7, Supabase JS 2, Vitest (adicionado na Task 1), ESLint 9.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-11-uc-geradora-autoconsumo-design.md`. Ela manda; onde este plano divergir, a spec vence.
- Branch: `impl/uc-geradora-autoconsumo`. **Nunca dar push em `main`** — `.github/workflows/deploy.yml` republica `app.b2wenergia.com.br` a cada push em `main`.
- **Dado faltante propaga `null`, nunca vira zero.** Geração ausente é `null`, não `0`. `COALESCE`-para-zero sobre insumo de cálculo é proibido.
- **`supabase-js` não lança em erro de banco** — devolve `{ data, error }`. Toda chamada nova checa `error`.
- Não tocar em `src/pages/SupplierDashboard.jsx`: está fora de escopo por decisão do dono (será substituída pela área nova).
- Não tocar em `handle_invoice_paid_ledger` nem estornar lançamentos do razão: fora de escopo, registrado na spec §5.
- Comentários em português sem acentuação em SQL; nos `.js`/`.jsx` seguir o arquivo (a área `investidor/` usa português acentuado, os componentes antigos usam inglês).
- Rodar `npm run lint` antes de cada commit. Os 7 erros pré-existentes (`motion`, `authLoading`, `suppError`, `emailError`, `ucCount`, `revenue`, `usinaLedger`) não são regressão; **nenhum erro novo** pode aparecer.

---

### Task 1: Ferramenta de teste

O projeto não tem nenhum runner hoje (`package.json` só traz `dev`, `build`, `type-check`, `lint`, `preview`). O módulo da Task 2 é aritmética que não pode contar duas vezes — sem teste, é exatamente o tipo de regra que volta a divergir.

**Files:**
- Modify: `package.json`
- Test: `src/lib/capacidade.test.js` (criado na Task 2)

**Interfaces:**
- Consumes: nada.
- Produces: script `npm test` executando Vitest em modo não-interativo.

- [ ] **Step 1: Instalar o Vitest como dependência de desenvolvimento**

```bash
npm install -D vitest@^3
```

Só devDependency: não entra no bundle. Vitest lê o `vite.config.js` que já existe, então não precisa de arquivo de configuração próprio.

- [ ] **Step 2: Adicionar o script de teste**

Em `package.json`, dentro de `"scripts"`, logo depois de `"lint"`:

```json
    "test": "vitest run",
```

- [ ] **Step 3: Confirmar que o runner sobe**

Run: `npm test`
Expected: sai com "No test files found" e código de saída 1. Isso prova que o Vitest está instalado e executando — os testes chegam na Task 2.

- [ ] **Step 4: Confirmar que o build não quebrou**

Run: `npm run lint`
Expected: os mesmos 7 erros pré-existentes, nenhum novo.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: adiciona vitest para testar a regra de capacidade"
```

---

### Task 2: Módulo da regra de capacidade

**Files:**
- Create: `src/lib/capacidade.js`
- Create: `src/lib/capacidade.test.js`

**Interfaces:**
- Consumes: o script `npm test` da Task 1.
- Produces:
  - `STATUS_LIBERAM_FRANQUIA: Set<string>`
  - `ocupaFranquia(uc: {status?: string}): boolean`
  - `calcularCapacidade({ ucs, geracao }): { geracao, autoconsumoUG, disponivel, comprometido, livre, ocupacao }`
    - `ucs`: array de objetos com `tipo_unidade`, `status`, `franquia`
    - `geracao`: kWh brutos do período, ou `null` quando não há leitura
    - todos os retornos numéricos são `number`, exceto `geracao`, `disponivel`, `livre` e `ocupacao`, que são `number | null`

- [ ] **Step 1: Escrever os testes que devem falhar**

Criar `src/lib/capacidade.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { calcularCapacidade, ocupaFranquia } from './capacidade';

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
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./capacidade"`.

- [ ] **Step 3: Escrever o módulo**

Criar `src/lib/capacidade.js`:

```js
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
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test`
Expected: PASS — 10 testes.

- [ ] **Step 5: Lint e commit**

```bash
npm run lint
git add src/lib/capacidade.js src/lib/capacidade.test.js
git commit -m "feat: modulo unico da regra de capacidade da usina"
```

---

### Task 3: `PlantAnalyticsModal` consome o módulo

**Files:**
- Modify: `src/components/PlantAnalyticsModal.jsx` (linha 123; bloco de métricas ~271-299; card "Capacidade Comprometida" ~546-554)

**Interfaces:**
- Consumes: `calcularCapacidade` da Task 2.
- Produces: nada para tarefas seguintes.

- [ ] **Step 1: Importar o módulo**

No topo do arquivo, depois do import de `supabase`:

```js
import { calcularCapacidade } from '../lib/capacidade';
```

- [ ] **Step 2: Trocar o cálculo da franquia**

Substituir a linha 123, que hoje é:

```js
            const totalFranquia = ucs?.filter(uc => uc.status !== 'desconectado' && uc.status !== 'cancelado').reduce((acc, curr) => acc + (Number(curr.franquia) || 0), 0) || 0;
```

por:

```js
            // A geradora sai do comprometido e vira dedução da geração: ver
            // docs/superpowers/specs/2026-08-11-uc-geradora-autoconsumo-design.md
            const capacidadeCadastro = calcularCapacidade({ ucs: ucs || [], geracao: null });
            const totalFranquia = capacidadeCadastro.comprometido;
            const autoconsumoUG = capacidadeCadastro.autoconsumoUG;
```

A query da linha 118 precisa trazer `tipo_unidade`. Trocar:

```js
                .select('id, franquia, status, numero_uc')
```

por:

```js
                .select('id, franquia, status, numero_uc, tipo_unidade')
```

- [ ] **Step 3: Derivar o disponível a partir da geração do período**

No bloco de métricas, logo depois da linha que hoje calcula `vacancyKwh` (`const vacancyKwh = Math.max(0, generationLastMonth - consumptionLastMonth);`), inserir:

```js
            // Geração já apurada do período menos o autoconsumo da UG: é isto que
            // sobra para os assinantes. `generationLastMonth` é bruto.
            const disponivelRateio = generationLastMonth - autoconsumoUG;
```

- [ ] **Step 4: Passar os dois valores para o estado**

No objeto de `setMetrics({...})`, junto de `totalFranquia`, acrescentar:

```js
                autoconsumoUG,
                disponivelRateio,
```

- [ ] **Step 5: Mostrar as duas linhas no card**

Substituir o conteúdo do card "Capacidade Comprometida" (o bloco `<h4>Capacidade Comprometida</h4>` e seu `<small>`) por:

```jsx
                                            <h4>Capacidade Comprometida</h4>
                                            <div className="stat-main d-flex align-items-center gap-2">
                                                <ArrowDownRight size={24} color="#FF6600" />
                                                <span className="fs-3 fw-bold">{formatNumber(metrics.totalFranquia)} kWh</span>
                                            </div>
                                            <small className="text-muted d-block">
                                                Franquia das beneficiárias
                                            </small>
                                            {metrics.autoconsumoUG > 0 && (
                                                <small className="text-muted d-block mt-1">
                                                    Autoconsumo da UG: {formatNumber(metrics.autoconsumoUG)} kWh ·
                                                    disponível para rateio: {formatNumber(metrics.disponivelRateio)} kWh
                                                </small>
                                            )}
```

- [ ] **Step 6: Conferir no navegador**

Subir o preview e abrir o Painel de Análise da **Novo Leblon**.

Expected: "Capacidade Comprometida" mostra **300** (só a beneficiária, não 600), e abaixo aparece "Autoconsumo da UG: 300 kWh".

Abrir depois a **UFV Bom Jesus**, cuja UG tem franquia 1.

Expected: os números praticamente não mudam (comprometido cai de 1.202 para 1.201) — é a prova de que a mudança não mexe em usina sem autoconsumo relevante.

- [ ] **Step 7: Lint e commit**

```bash
npm run lint
git add src/components/PlantAnalyticsModal.jsx
git commit -m "fix(admin): geradora sai do comprometido e vira deducao da geracao"
```

---

### Task 4: `ConsumerUnitModal` — tipo de unidade e autoconsumo

**Files:**
- Modify: `src/components/ConsumerUnitModal.jsx` (estado ~78-105; hidratação ~112-133; payload ~234-264; campos ~584-601)

**Interfaces:**
- Consumes: nada das tarefas anteriores.
- Produces: nada para tarefas seguintes.

- [ ] **Step 1: Acrescentar `tipo_unidade` ao estado do formulário**

No `useState` inicial (~linha 87, junto de `franquia`), acrescentar:

```js
        tipo_unidade: 'beneficiaria',
```

E na hidratação a partir de `consumerUnit` (~linha 123, junto de `franquia`):

```js
                tipo_unidade: consumerUnit.tipo_unidade || 'beneficiaria',
```

- [ ] **Step 2: Buscar o autoconsumo medido da UC**

Acrescentar um estado novo ao lado dos outros `useState` do componente:

```js
    const [autoconsumoMedido, setAutoconsumoMedido] = useState(null);
```

E um efeito que só roda quando a UC já existe e é geradora:

```js
    // Média do compensado dos últimos 6 meses, para o operador calibrar a
    // estimativa em vez de chutar. Sem faturas com valor, não exibe nada —
    // zero aqui seria uma afirmação falsa sobre o consumo.
    useEffect(() => {
        if (!consumerUnit?.id || formData.tipo_unidade !== 'geradora') {
            setAutoconsumoMedido(null);
            return;
        }
        const desde = new Date();
        desde.setMonth(desde.getMonth() - 6);
        (async () => {
            const { data, error } = await supabase
                .from('invoices')
                .select('consumo_compensado')
                .eq('uc_id', consumerUnit.id)
                .gte('mes_referencia', desde.toISOString().slice(0, 10))
                .not('consumo_compensado', 'is', null);
            if (error) { setAutoconsumoMedido(null); return; }
            if (!data?.length) { setAutoconsumoMedido(null); return; }
            const soma = data.reduce((acc, i) => acc + Number(i.consumo_compensado), 0);
            setAutoconsumoMedido(soma / data.length);
        })();
    }, [consumerUnit?.id, formData.tipo_unidade]);
```

- [ ] **Step 3: Tornar a obrigatoriedade do assinante condicional**

Substituir a linha 264:

```js
            if (!payload.subscriber_id) throw new Error('Assinante é obrigatório.');
```

por:

```js
            // A UC geradora é a usina vista pela concessionária, não um cliente:
            // ela não gera fatura B2W e por isso não tem assinante. Quem identifica
            // o titular da conta de energia é `titular_fatura_id`, que continua valendo.
            if (formData.tipo_unidade !== 'geradora' && !payload.subscriber_id) {
                throw new Error('Assinante é obrigatório.');
            }
```

E acrescentar `tipo_unidade` ao `payload` (junto de `franquia`, ~linha 243):

```js
                tipo_unidade: formData.tipo_unidade,
```

- [ ] **Step 4: Trocar os campos da seção técnica**

Substituir o bloco das linhas 584-601 (`Desconto Assinante`, `Franquia`, `Dia Vencimento`) por:

```jsx
                    {(defaultSection === 'all' || defaultSection === 'technical') && (
                        <>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px' }}>Tipo de Unidade</label>
                                <select value={formData.tipo_unidade} onChange={e => setFormData({ ...formData, tipo_unidade: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                                    <option value="beneficiaria">Beneficiária</option>
                                    <option value="geradora">Geradora (UG da usina)</option>
                                </select>
                            </div>
                            {formData.tipo_unidade !== 'geradora' && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px' }}>Desconto Assinante (%)</label>
                                    <input type="number" step="0.01" value={formData.desconto_assinante} onChange={e => setFormData({ ...formData, desconto_assinante: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                                </div>
                            )}
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px' }}>
                                    {formData.tipo_unidade === 'geradora' ? 'Autoconsumo previsto (kWh)' : 'Franquia (kWh)'}
                                </label>
                                <input type="number" value={formData.franquia} onChange={e => setFormData({ ...formData, franquia: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                                {formData.tipo_unidade === 'geradora' && (
                                    <small style={{ color: '#64748b', display: 'block', marginTop: '4px' }}>
                                        Sai da geração antes do rateio.
                                        {autoconsumoMedido !== null && ` Medido: ${autoconsumoMedido.toFixed(1)} kWh/mês (média de 6 meses).`}
                                    </small>
                                )}
                            </div>
                            {formData.tipo_unidade !== 'geradora' && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px' }}>Dia Vencimento</label>
                                    <select value={formData.dia_vencimento} onChange={e => setFormData({ ...formData, dia_vencimento: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                                        {vencimentoOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                </div>
                            )}
                        </>
                    )}
```

- [ ] **Step 5: Conferir no navegador**

Abrir a UC **7021781376** (Novo Leblon).

Expected: "Tipo de Unidade" mostra **Geradora**; o campo diz **"Autoconsumo previsto (kWh)"** com "Medido: 144,8 kWh/mês (média de 6 meses)" embaixo; "Desconto Assinante" e "Dia Vencimento" sumiram.

Abrir uma beneficiária qualquer.

Expected: tudo como antes, com "Franquia (kWh)" e os dois campos de cobrança visíveis.

- [ ] **Step 6: Lint e commit**

```bash
npm run lint
git add src/components/ConsumerUnitModal.jsx
git commit -m "feat(admin): tipo_unidade editavel e autoconsumo previsto na UC geradora"
```

---

### Task 5: Área do investidor mostra o autoconsumo

**Files:**
- Modify: `src/pages/investidor/useInvestorData.js` (linhas 23-24, 138-172)
- Modify: `src/pages/investidor/PlantNameplate.jsx` (bloco `specs`, medidor)

**Interfaces:**
- Consumes: `calcularCapacidade`, `ocupaFranquia` da Task 2.
- Produces: cada usina do estado passa a expor `autoconsumoUG: number` e `disponivelPrevisto: number|null`, além do `comprometido` e `ocupacao` já existentes — agora calculados sobre o disponível.

- [ ] **Step 1: Passar a importar a regra em vez de redefini-la**

Remover as linhas 17-24 (o comentário sobre franquia, `STATUS_LIBERAM_FRANQUIA` e `ocupaFranquia`) e, no topo, acrescentar:

```js
import { calcularCapacidade, ocupaFranquia } from '../../lib/capacidade';
```

O comentário explicativo foi junto para `src/lib/capacidade.js` na Task 2; não duplicar aqui.

- [ ] **Step 2: Calcular a capacidade pelo módulo**

Substituir as linhas 140-141, hoje:

```js
                const ativas = bucket.benef.filter(ocupaFranquia);
                const comprometido = ativas.reduce((acc, uc) => acc + (Number(uc.franquia) || 0), 0);
                const previsto = Number(u.geracao_estimada_kwh) || 0;
```

por:

```js
                const ativas = bucket.benef.filter(ocupaFranquia);
                // A geradora entra aqui de propósito: é ela que o módulo separa
                // como autoconsumo, deduzindo-o da geração antes do rateio.
                const todasAsUcs = bucket.geradora ? [...bucket.benef, bucket.geradora] : bucket.benef;
                const previsto = Number(u.geracao_estimada_kwh) || 0;
                const capacidade = calcularCapacidade({
                    ucs: todasAsUcs,
                    geracao: previsto > 0 ? previsto : null,
                });
                const comprometido = capacidade.comprometido;
```

- [ ] **Step 3: A ocupação passa a ser sobre o disponível**

Substituir a linha 164, hoje:

```js
                    ocupacao: previsto > 0 ? (comprometido / previsto) * 100 : null,
```

por:

```js
                    ocupacao: capacidade.ocupacao,
                    autoconsumoUG: capacidade.autoconsumoUG,
                    disponivelPrevisto: capacidade.disponivel,
```

- [ ] **Step 4: Mostrar o autoconsumo na placa**

Em `PlantNameplate.jsx`, dentro do array `specs`, logo depois da linha `['Geração prevista', ...]`, acrescentar:

```jsx
        ['Autoconsumo da UG', usina.autoconsumoUG > 0
            ? `${kwh(usina.autoconsumoUG)}/mês`
            : '—'],
        ['Disponível para rateio', isBlank(usina.disponivelPrevisto)
            ? '—'
            : `${kwh(usina.disponivelPrevisto)}/mês`],
```

E na legenda do medidor, trocar:

```jsx
                    <span className="iv-label">Franquia comprometida</span>
```

por:

```jsx
                    <span className="iv-label">Franquia comprometida (sobre o disponível)</span>
```

- [ ] **Step 5: Conferir no navegador**

Abrir `/preview/investidor` (só em DEV) e, se possível, `/fornecedores/novo` autenticado como o fornecedor da Novo Leblon.

Expected na Novo Leblon: aparecem "Autoconsumo da UG" e "Disponível para rateio"; a ocupação sobe de **25,2%** (300/1.192) para **33,6%** (300/892), porque agora é medida sobre o que de fato pode ser vendido.

Conferir também que o preview com fixtures não quebra — `preview.fixtures.js` pode não trazer `tipo_unidade` nas UCs. Se a placa mostrar "—" em autoconsumo no preview, está correto: fixture sem geradora tem autoconsumo zero.

- [ ] **Step 6: Lint e commit**

```bash
npm run lint
git add src/pages/investidor/useInvestorData.js src/pages/investidor/PlantNameplate.jsx
git commit -m "feat(investidor): autoconsumo da UG visivel e ocupacao sobre o disponivel"
```

---

### Task 6: Banco — trigger e ajuste de dados

Esta task roda contra **produção**. Não há banco local. Cada bloco é enviado por `execute_sql` do MCP do Supabase (projeto `abbysvxnnhwvvzhftoms`), exceto a função, que vai por `apply_migration`.

**Files:**
- Nenhum arquivo do repositório. As mudanças vivem no banco.

**Interfaces:**
- Consumes: nada.
- Produces: a UC 7021781376 sem assinante e com franquia 150, e `fn_trigger_subscriber_recalculate` tolerante a `NULL`.

- [ ] **Step 1: Provar o defeito do trigger antes de corrigir**

Rodar, em uma chamada só:

```sql
SELECT
    (NULL::uuid IS NOT NULL) AS old_nao_nulo_com_null,
    ('11111111-1111-1111-1111-111111111111'::uuid != NULL::uuid) AS comparacao_com_null,
    ('11111111-1111-1111-1111-111111111111'::uuid IS DISTINCT FROM NULL::uuid) AS com_is_distinct_from;
```

Expected: `comparacao_com_null` volta **NULL** e `com_is_distinct_from` volta **true**. É a prova de que o ramo do `IF` não executa quando o assinante é removido.

- [ ] **Step 2: Corrigir a função**

Por `apply_migration`, com `name` = `20260811a_fn_trigger_subscriber_recalculate_null_safe`:

```sql
CREATE OR REPLACE FUNCTION public.fn_trigger_subscriber_recalculate()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.subscriber_id IS NOT NULL THEN
        PERFORM public.fn_recalculate_subscriber_status(NEW.subscriber_id);
    END IF;

    -- `!=` devolve NULL quando um dos lados e' NULL, e o IF nao executa: ao
    -- desvincular o assinante de uma UC (subscriber_id -> NULL) o status do
    -- assinante antigo ficava sem recalcular. IS DISTINCT FROM trata NULL.
    IF OLD.subscriber_id IS NOT NULL
       AND OLD.subscriber_id IS DISTINCT FROM NEW.subscriber_id THEN
        PERFORM public.fn_recalculate_subscriber_status(OLD.subscriber_id);
    END IF;

    RETURN NEW;
END;
$function$;
```

- [ ] **Step 3: Confirmar que a função nova está no banco**

```sql
SELECT pg_get_functiondef(p.oid) LIKE '%IS DISTINCT FROM%' AS corrigida
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'fn_trigger_subscriber_recalculate';
```

Expected: `corrigida = true`.

- [ ] **Step 4: Registrar o estado de antes do ajuste de dados**

```sql
SELECT cu.numero_uc, cu.tipo_unidade, cu.franquia, cu.subscriber_id, cu.titular_fatura_id,
       s.name AS assinante, s.status::text AS status_assinante
FROM consumer_units cu LEFT JOIN subscribers s ON s.id = cu.subscriber_id
WHERE cu.numero_uc = '7021781376';
```

Anotar o resultado: é contra ele que o Step 6 é conferido. Esperado hoje — `franquia` 300, assinante "Waldiney Godoy", `titular_fatura_id` preenchido.

- [ ] **Step 5: Aplicar o ajuste**

```sql
UPDATE consumer_units
SET subscriber_id = NULL,
    franquia      = 150
WHERE numero_uc = '7021781376'
  AND tipo_unidade = 'geradora'
RETURNING numero_uc, tipo_unidade, franquia, subscriber_id, titular_fatura_id;
```

`titular_fatura_id` **não** é tocado de propósito: é por ele que o robô faturista resolve o login no portal da concessionária.

Se o `execute_sql` for barrado pelo classificador de permissões, tentar uma segunda vez — a chamada passa a pedir aprovação. Persistindo o bloqueio, entregar o SQL ao dono para rodar no SQL Editor do Supabase, sem tentar contornar.

- [ ] **Step 6: Confirmar que o trigger recalculou o assinante**

```sql
SELECT s.name, s.status::text AS status_assinante,
       (SELECT count(*) FROM consumer_units c WHERE c.subscriber_id = s.id) AS ucs_restantes
FROM subscribers s
WHERE s.id = '5b83ea91-0ade-4f18-af2f-504c7dca6c03';
```

Expected: o status reflete as UCs que sobraram. Se o assinante ficou sem nenhuma UC e o status continuar `ativo`, o recálculo não rodou — parar e investigar `fn_recalculate_subscriber_status` antes de seguir.

- [ ] **Step 7: Confirmar que o fechamento não quebrou**

```sql
SELECT public.fn_conta_ug('6046fd8f-9f2e-4a36-a413-ab11a7b4c2cf', DATE '2026-07-01') AS novo_leblon,
       public.fn_conta_ug('9bf1349b-6c79-4f68-a8e4-bc00f00850f5', DATE '2026-07-01') AS bom_jesus;
```

Expected: as duas com `"ok": true`. `fn_conta_ug` depende de `tipo_unidade`, não de `subscriber_id` — se alguma voltar `false`, o desvínculo atingiu algo que não devia.

- [ ] **Step 8: Conferir o resultado nas telas**

Recarregar o Painel de Análise da Novo Leblon.

Expected: "Capacidade Comprometida" 300, "Autoconsumo da UG: 150 kWh", "disponível para rateio" = geração do mês − 150.

Abrir a UC 7021781376 no modal.

Expected: salva sem reclamar de assinante; "Autoconsumo previsto" mostra 150 com o medido de ~144,8 embaixo.

- [ ] **Step 9: Commit**

Não há arquivo a commitar nesta task. Registrar o que foi aplicado no corpo do commit final da Task 7.

---

### Task 7: Fechamento

**Files:**
- Modify: `docs/superpowers/plans/2026-08-11-uc-geradora-autoconsumo.md` (marcar os checkboxes)

- [ ] **Step 1: Rodar a bateria completa**

```bash
npm test && npm run lint && npm run build
```

Expected: testes passam; lint com os mesmos 7 erros pré-existentes e nenhum novo; build conclui.

- [ ] **Step 2: Registrar as mudanças de banco no repositório**

```bash
git commit --allow-empty -m "$(cat <<'EOF'
chore: registra mudancas de banco do autoconsumo da UG

Aplicadas em producao (abbysvxnnhwvvzhftoms) durante a Task 6:
- fn_trigger_subscriber_recalculate passa a usar IS DISTINCT FROM
- UC 7021781376 (UG da Novo Leblon): subscriber_id -> NULL, franquia -> 150
EOF
)"
```

- [ ] **Step 3: Conferir o diff inteiro antes de encerrar**

```bash
git diff main...impl/uc-geradora-autoconsumo --stat
```

Expected: só os arquivos previstos — `package.json`, `package-lock.json`, `src/lib/capacidade.js`, `src/lib/capacidade.test.js`, `src/components/PlantAnalyticsModal.jsx`, `src/components/ConsumerUnitModal.jsx`, `src/pages/investidor/useInvestorData.js`, `src/pages/investidor/PlantNameplate.jsx` e os dois documentos. **`src/pages/SupplierDashboard.jsx` não pode aparecer** com mudanças desta rodada; as alterações que ele já tinha vieram da correção anterior de geração e são legítimas — conferir que nada novo entrou.

- [ ] **Step 4: Não dar push**

A branch fica local até o dono decidir. Push em `main` republica `app.b2wenergia.com.br`.

---

## Fora deste plano

Registrado na spec §5, não implementar aqui:

- Guarda por `tipo_unidade` em `handle_invoice_paid_ledger`.
- Estorno das transações `0e40f2bf` (Bom Jesus 05/2026) e `2e73aba2` (Novo Leblon 06/2026).
- Precisão de `consumo_compensado` na importação (125 gravado contra 125,24 na fatura).
- Migrar `SupplierDashboard.jsx` para o módulo.
