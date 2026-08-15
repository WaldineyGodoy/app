# UC geradora: autoconsumo, franquia e desvínculo do assinante

**Data:** 11/08/2026
**Repositório:** `WorkSpace 2 Front End` (branch `impl/uc-geradora-autoconsumo`)
**Projeto Supabase:** `abbysvxnnhwvvzhftoms`

Todo número neste documento foi medido contra o banco de produção em 10–11/08/2026. O banco é vivo: confira antes de tratar como verdade.

---

## 1. O problema

A UC **7021781376**, unidade geradora da usina **Novo Leblon**, está cadastrada como se fosse uma assinante: tem `subscriber_id` apontando para uma pessoa física e `franquia = 300`.

Isso foi feito para resolver um problema real — a UG **consome energia da própria usina**, e esse consumo precisa aparecer no comprometimento de capacidade. Mas resolveu pelo campo errado, e o efeito colateral é que ela passou a gerar cobrança:

- A fatura de 06/2026 saiu com `valor_a_pagar` R$ 190,10 contra `valor_concessionaria` R$ 131,27.
- Ao ser marcada `pago`, disparou `handle_invoice_paid_ledger`, que lançou no razão um recebimento de R$ 190,10 que nunca entrou, R$ 1,99 de taxa de boleto inexistente, R$ 29,41 de crédito ao investidor e R$ 29,41 de comissão — repartindo um **custo** como se fosse receita.

Os R$ 190,10 nunca foram recebidos. O que houve foi o pagamento da conta da concessionária, R$ 131,27, por fora do sistema.

### 1.1 O segundo problema: geração bruta

A UG compensa consumo no próprio medidor. A leitura de `energia_injetada` é bruta, e o sistema a trata como se fosse tudo disponível para os assinantes:

| mês | injetado | compensado na própria UG | sobra real p/ rateio |
|---|---:|---:|---:|
| 06/2026 | 702 | 105,2 | 596,8 |
| 07/2026 | 742 | 125 | 617 |

A fatura de 07/2026 traz 125,24; o banco gravou 125. A perda de precisão na importação está fora do escopo desta spec, mas fica registrada.

**A distorção hoje é dupla:** a UG conta geração bruta *e* ocupa 300 kWh de franquia junto com as beneficiárias.

### 1.2 Não afeta todas as usinas

Na UFV Bom Jesus a UG é faturada pelo mínimo da fase (custo de disponibilidade), com `consumo_compensado = 0` — bruto e líquido coincidem. O problema é específico de UG que consome no próprio medidor.

---

## 2. A decisão central

**`franquia` não depende de `subscriber_id`.** São duas perguntas diferentes que foram respondidas pelo mesmo campo:

| pergunta | campo que responde | UG do Novo Leblon |
|---|---|---|
| Esta UC consome energia da usina? | `franquia` (previsto) + `consumo_compensado` (medido) | sim |
| Esta UC gera fatura B2W a cobrar? | `subscriber_id` | não |

Tirar o assinante não tira a franquia. O comprometimento continua rastreado.

### 2.1 A franquia da UG entra do lado da oferta

Este é o detalhe que evita contar duas vezes. A UG entra **antes** do rateio, reduzindo a energia disponível — não junto das beneficiárias, aumentando a demanda:

```
                              previsto      apurado 07/26
Geração                          1.192              742
− Autoconsumo da UG               −300             −125
= Disponível para assinantes       892              617
− Comprometido (beneficiárias)    −300             −433
= Livre para vender                592              184
```

A coluna "previsto" usa os cadastros **como estão hoje**, antes do ajuste da seção 4.4. Com o autoconsumo corrigido para 150, o previsto passa a 1.192 − 150 − 300 = 742 livres.

Somar a franquia da UG ao comprometido **e** abater o autoconsumo da geração contaria o mesmo consumo duas vezes. Só uma das duas pernas pode existir, e a escolhida é a da oferta.

### 2.2 As estimativas de hoje derraparam

O desenho precisa sobreviver a isso, e o operador precisa enxergar:

| item | estimado | real medido |
|---|---:|---:|
| Autoconsumo da UG 7021781376 | 300 | 144,80 |
| Franquia da beneficiária 7024853238 | 300 | 395,55 |
| Geração da usina | 1.192 | 702–742 |

---

## 3. O que já está certo e não se mexe

Verificado em produção:

- `fn_faturamento_detalhado` soma apenas `tipo_unidade = 'beneficiaria'`. A conta da UG nunca entrou como receita.
- `fechar_producao` lê o valor por `fn_conta_ug` e lança `2.1.1 +valor` / `2.1.3.01 −valor` — o débito ao fornecedor pela despesa da usina. É exatamente a "dedução como despesa" desejada; não há nada a construir.
- `useInvestorData.js` já separa a geradora das beneficiárias (`:105`, `:114`, `:140`) e a exclui da franquia.
- A UFV São José do Seridó já está no formato-alvo: `subscriber_id` nulo, `titular_fatura_id` preenchido.

**`titular_fatura_id` permanece preenchido na UG.** É por ele que o robô faturista resolve o login no portal da concessionária. Apagar os dois vínculos quebraria a raspagem.

---

## 4. Mudanças

### 4.1 `ConsumerUnitModal.jsx`

**`tipo_unidade` passa a ser editável.** Hoje a coluna é nula por padrão, nenhum trigger a preenche (`handle_uc_usina_link` mexe em `status`, não nela) e nenhuma tela do frontend escreve nela — as 4 UGs existentes foram marcadas por SQL manual. Consequência hoje: **uma usina cadastrada só pela interface não fecha o mês**, porque `fn_conta_ug` recusa com `usina_sem_uc_geradora`.

Quando `tipo_unidade === 'geradora'`:

- O rótulo "Franquia (kWh)" vira **"Autoconsumo previsto (kWh)"**, com uma linha de ajuda dizendo que esse valor sai da geração antes do rateio.
- Abaixo do campo, exibir o autoconsumo **medido**: a média de `consumo_compensado` das faturas daquela UC nos **últimos 6 meses**, ignorando faturas com `consumo_compensado` nulo. Quando não houver nenhuma fatura com valor, não exibir a linha em vez de exibir zero.
- Ocultar "Desconto Assinante (%)" e "Dia Vencimento": numa UG sem cobrança são ruído.

**Bloqueio a remover:** `ConsumerUnitModal.jsx:264` faz `if (!payload.subscriber_id) throw new Error('Assinante é obrigatório.')`. Hoje é **impossível salvar uma UC sem assinante pela interface** — o desvínculo da seção 4.4 não teria como ser feito nem mantido, e qualquer edição futura da UG seria recusada. A obrigatoriedade passa a valer só para `tipo_unidade !== 'geradora'`.

**Regra de quem ocupa franquia:** hoje existem duas versões. `useInvestorData.js:23` libera a franquia em `desconectado`, `cancelado` e `cancelado_inadimplente`; `PlantAnalyticsModal.jsx:123` esquece o terceiro. A UC 7029990055 da Bom Jesus está exatamente em `cancelado_inadimplente`, então a divergência é viva. A regra correta é a do `useInvestorData` e vai para o módulo da seção 4.2.

### 4.2 Módulo único da regra de capacidade

Novo módulo em `src/lib/`, com uma função que recebe as UCs da usina (e, quando houver, as faturas do mês) e devolve:

`geracao`, `autoconsumoUG`, `disponivel`, `comprometido`, `livre` — nas duas versões, prevista e apurada.

Motivo: hoje `PlantAnalyticsModal`, `SupplierDashboard` e `useInvestorData` calculam franquia e geração cada um do seu jeito, e foi assim que a geração exibida divergiu entre telas. A regra passa a existir uma vez só.

Módulo JS, não função de banco: nenhuma RPC usa franquia, e uma função SQL viveria no outro repositório.

### 4.3 Quem passa a consumir o módulo

O grosso da rodada é o **painel do administrador**. A **área nova do investidor** entra junto, porque o fornecedor precisa enxergar o próprio autoconsumo — é energia da usina dele que não foi para assinantes, e esconder isso é o oposto de transparência.

**Admin:**

- `PlantAnalyticsModal.jsx:123` soma hoje a franquia de **todas** as UCs, geradora inclusive. Passa a exibir `Autoconsumo da UG` e `Disponível para rateio` como linhas próprias.
- `ConsumerUnitModal.jsx`, conforme 4.1.

**Área nova do investidor (`/fornecedores/novo`):**

- `useInvestorData.js` já exclui a geradora da franquia (`:114`, `:140`), mas ainda não subtrai o autoconsumo da geração disponível. Passa a expor `autoconsumoUG` (previsto e medido) e a calcular a ocupação sobre a geração **disponível**: hoje `:164` faz `comprometido / previsto`, e passa a fazer `comprometido / (previsto − autoconsumoUG)`.
- `PlantNameplate.jsx` ganha a linha `Autoconsumo da UG` entre as specs, e a legenda do medidor deixa claro que a ocupação é sobre o disponível, não sobre o bruto.

### 4.4 Ajuste de dados — Novo Leblon

- `consumer_units.subscriber_id` da UC 7021781376 → `NULL`
- `consumer_units.franquia` da UC 7021781376 → `150`
- `titular_fatura_id` permanece como está

### 4.5 Migration obrigatória: `fn_trigger_subscriber_recalculate`

O trigger `tr_recalculate_subscriber_on_uc_change` dispara em `UPDATE OF subscriber_id`. A função faz:

```sql
IF OLD.subscriber_id IS NOT NULL AND OLD.subscriber_id != NEW.subscriber_id THEN
```

Com `NEW.subscriber_id = NULL`, o `!=` devolve NULL, o `AND` vira NULL e o ramo não executa: **o status do assinante antigo não é recalculado**. Trocar por `IS DISTINCT FROM`.

Não é opcional. É a mudança 4.4 que dispara o defeito.

---

## 5. Fora de escopo

Registrado, não feito nesta rodada:

- **A tela antiga do fornecedor.** `SupplierDashboard.jsx` (rota `/fornecedores`) continua com o cálculo antigo, porque será substituída pela área nova. **Consequência conhecida e aceita:** até a troca das telas, `/fornecedores` mostrará capacidade diferente do admin e de `/fornecedores/novo`. Não vale migrar uma tela que vai ser descartada.

- **Guarda por `tipo_unidade` em `handle_invoice_paid_ledger`.** A função não verifica o tipo da UC. Desvincular o assinante não a impede de disparar — apenas faz o `JOIN` com `subscribers` falhar, e as partidas continuam sendo inseridas, agora com referência nula. A guarda continua necessária.
- **Estorno das transações fantasma:** `0e40f2bf` (Bom Jesus 05/2026) e `2e73aba2` (Novo Leblon 06/2026).
- **Precisão de `consumo_compensado`** na importação (125 gravado contra 125,24 na fatura).
- **Franquias e geração estimada desatualizadas** das demais UCs e usinas.

---

## 5b. Achados da revisão final — resolvidos

A revisão final da branch (15/08/2026) levantou dois pontos, e o dono decidiu corrigir os dois.

**a) Admin e investidor usavam bases diferentes de "geração prevista", com o mesmo rótulo.** O `PlantAnalyticsModal` deriva a previsão de `vw_irradiancia × potencia_kwp` do mês selecionado; a área do investidor usa `usinas.geracao_estimada_kwh`. Medido na Novo Leblon: o admin mostrava 883 kWh disponíveis em junho e 1.058 em agosto, o investidor 1.042 o ano inteiro.

**Resolução:** as duas grandezas são legitimamente diferentes — uma é projeção sazonal do mês, a outra é valor de placa — e **não** foram forçadas a coincidir. Isso corrige o critério 2 da seção 6, que partia da premissa errada de que deviam ser o mesmo número. O que estava de fato errado era o admin refazer `avgEstimatedGen − totalFranquia − autoconsumoUG` por fora do módulo; agora ele chama `calcularCapacidade` e herda a propagação de `null`. A equivalência foi conferida caso a caso, inclusive nas fronteiras: nenhum número exibido mudou. Os rótulos passaram a dizer qual base cada tela usa.

**b) A badge "% Ocupação" e o donut do admin estavam na conta antiga.** Faziam `consumo / geração bruta`, e o consumo somava as faturas de **todas** as UCs, geradora inclusive. Medido na Novo Leblon em mar/2026: 128 kWh de consumo da própria UG entravam como se fossem consumo de assinante.

**Resolução:** o consumo passa a somar só as faturas das beneficiárias, e a ocupação é medida sobre o disponível apurado — geração menos o autoconsumo **medido** da UG, lido por `autoconsumoMedidoGeradora`, que nunca filtra por `invoices.status`. Sem fatura da geradora no período, a ocupação não é apurável e a tela indica ausência de dado em vez de calcular sobre premissa falsa.

## 6. Como validar

1. A UG do Novo Leblon sai do comprometido e passa a aparecer como autoconsumo. Mantido o valor de franquia em 300, o "livre para vender" tem de dar o mesmo de antes (592) — se mudar, alguma perna está sendo contada duas vezes. Só depois aplicar o ajuste para 150.
2. Toda a aritmética de capacidade exibida no admin e na área nova vem do módulo da seção 4.2 — nenhuma das duas refaz a conta por conta própria. **Elas não precisam mostrar o mesmo número:** o admin projeta pela irradiância do mês selecionado e o investidor usa o valor de placa cadastrado. São grandezas diferentes, e o rótulo de cada tela tem de dizer qual é a sua.
2b. O fornecedor vê o autoconsumo da própria UG em `/fornecedores/novo`, e a ocupação exibida ali é sobre a geração disponível, não sobre a bruta.
3. Nas usinas cujo UG tem `consumo_compensado = 0` (Bom Jesus), os números exibidos não mudam.
4. Após o desvínculo, o status do assinante que perdeu a UC é recalculado.
5. `fn_conta_ug` continua devolvendo `ok = true` para Novo Leblon e Bom Jesus.
