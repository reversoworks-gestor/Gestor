# Relatório de execução de QA — Reverso Gestor

**Data:** 28 de outubro de 2026
**Repositório:** `reversoworks-gestor/Gestor`
**Branch:** `manus/reverso-gestor-reconstruction`
**Ambiente:** preview local `?preview=1`, sem gravações no Firebase real

## Conclusão

**100% de cobertura não foi alcançado nem pode ser certificado com os testes e o ambiente disponíveis.** A matriz contém 389 cenários de ação/estado. Desses, 373 foram classificados como exercitáveis no preview; após execução paralela, reconciliação por ID e retestes manuais sequenciais, 120 passaram, 2 falharam, 85 ficaram bloqueados e 166 não foram exercitados. Os 16 restantes foram classificados como fora do preview: 8 ficaram bloqueados, 1 não foi testado e 7 não constam no registro detalhado. Parte deles exige Firebase de staging; outros exigem geração controlada de falhas, dados de teste ou validação de impressão/PDF.

A taxa de **PASS na matriz de preview é 120/373 (32,17%)**. Essa taxa representa estados observados como aprovados; **não é cobertura de linhas ou branches de código**. Nenhuma ferramenta instrumentada de code coverage foi executada. Portanto, não há base para uma garantia de 100%.

## Resultados por área

Os números abaixo usam os IDs individuais da matriz e foram corrigidos depois de retestes manuais. “Bloqueado” indica dependência de estado/dado, ambiente ou limitação de automação; “não testado” indica que o cenário não foi executado. Cada linha soma os cenários marcados como testáveis no preview.

| Área | Cenários | PASS | FAIL | Bloqueados | Não testados |
|---|---:|---:|---:|---:|---:|
| Visão geral e início | 25 | 15 | 0 | 3 | 7 |
| Estimativas | 31 | 5 | 1 | 16 | 9 |
| Invoices | 32 | 3 | 0 | 9 | 20 |
| Pedidos | 42 | 4 | 0 | 1 | 37 |
| Produção | 34 | 0 | 0 | 34 | 0 |
| Triagem técnica | 46 | 2 | 0 | 3 | 41 |
| Clientes | 22 | 15 | 0 | 7 | 0 |
| Calendário | 9 | 6 | 0 | 0 | 3 |
| Estoque | 37 | 11 | 0 | 0 | 26 |
| Impressoras e manutenção | 29 | 13 | 0 | 2 | 14 |
| Peças e revisões | 21 | 10 | 0 | 6 | 5 |
| Financeiro | 6 | 3 | 0 | 3 | 0 |
| Despesas | 12 | 9 | 0 | 0 | 3 |
| Mais / navegação secundária | 9 | 8 | 0 | 1 | 0 |
| Ajustes | 18 | 16 | 1 | 0 | 1 |
| **Total exercitável no preview** | **373** | **120** | **2** | **85** | **166** |

### Casos fora do preview (16)

**Bloqueados (8):** `estimate.private.note`, `estimate.attachment.download`, `estimate.print.after.convert`, `estimate.attachment.cleanup.on.save.failure`, `inv-private-note`, `inv-attachment-download`, `parts-existing-attachment-download` e `parts-revision-save-validation-cleanup`. **Não testado (1):** `overview-notice-sync-error`. **Sem resultado detalhado (7):** `private-note`, `attachment-download`, `reservation-and-reconcile`, `inv-reservation-race`, `inv-direct-movement-race`, `team-email` e `team-authorize`.

Parte dos cenários exige Firebase de staging, regras de Storage implantadas, conta autorizada e dois clientes simultâneos para concorrência; outros exigem injetar falhas de upload/sincronização, criar dados de teste ou inspecionar saída de impressão/PDF. O preview não executa essas condições e nenhum dado de produção foi usado. Os totais foram recalculados pelos status individuais, pois os cabeçalhos agregados de Clientes, Peças e Ajustes divergiam da matriz e três áreas registravam denominadores diferentes.

## Retestes manuais e correções de classificação

- **Clientes — sobrenome e empresa:** os dois FAIL inicialmente registrados não se reproduziram ao limpar os campos com seleção e Backspace. O cadastro foi salvo como “QA Ana”, sem sobrenome ou empresa antigos. Ambos foram reclassificados como PASS.
- **Nova impressora:** o formulário abriu com status “Pronta”, limites `300/120/50 °C`, nozzle `0,4 mm`, material e compatibilidades vazios e checkboxes desmarcados, conforme `printerTemplate()`. O FAIL inicial foi reclassificado como PASS.
- **Fechamento do seletor de estimativa/invoice:** o botão X fechou o seletor. Cancelamento, clique no backdrop e clique dentro não foram todos verificados; por isso o cenário completo foi reclassificado para não testado, não para FAIL.
- **Atalho “Gerenciar manutenção”:** o botão funciona depois de ser rolado para dentro da viewport; os primeiros cliques automatizados falharam porque o elemento estava abaixo da dobra.
- **Data nativa da manutenção:** permanece bloqueada para validação confiável pela automação usada. O calendário nativo aparece no snapshot, mas o locator não consegue selecionar suas células; o valor malformado obtido por `fill` não foi considerado evidência de defeito do produto.
- **Preço do catálogo:** FAIL confirmado por teste manual. Um item de demonstração com preço `-2.50` foi aceito e persistido, embora o input declare `min=0`; o botão “Salvar item” permaneceu habilitado. O item de QA foi removido do estado local após a reprodução.

## Defeitos e divergências confirmados

### 1. Preço negativo aceito no catálogo — FAIL

Reprodução: em Ajustes, criar item temporário; preencher `-2.50` no preço; fornecer nome; salvar. O registro foi criado com `-2.50`. A validação HTML `min=0` tornou o input inválido (`rangeUnderflow=true`), mas o handler permitiu salvar. Deve haver validação de domínio no salvamento, mensagem acessível e teste de regressão antes da liberação.

### 2. Foco escapa do diálogo modal — achado adicional de acessibilidade, fora dos 389 casos

Em viewport iPhone 15, o diálogo declara `aria-modal="true"`, mas, ao abrir, o foco permanece no botão que o acionou fora do diálogo. Ao focar “Fechar” e pressionar `Shift+Tab`, o foco foi para “Mais” na navegação móvel (`activeInside=false`). O caso viola a contenção de foco esperada e precisa de foco inicial, ciclo de Tab/Shift+Tab e restauração ao fechar.

[Evidência da reprodução](qa-evidence/focus-escape-reproduced-2026-10-28.png)

### 3. Pagamento novo mostra valor visual vazio — divergência de estado

“Adicionar” cria uma linha com método Pix e data atual, mas o input “Valor do pagamento” aparece visualmente vazio, não `0`. O salvamento da estimativa normalizou e persistiu esse campo como zero; portanto, o ciclo não foi bloqueado, mas a indicação visual diverge do padrão esperado na matriz e pode confundir o operador.

## Fluxos interativos verificados sequencialmente

No preview, foram exercitados: criação/edição de cliente e limpeza de campos opcionais; seleção de cliente exato, item de catálogo, salvamento de estimativa; abertura do documento e conversão em invoice; confirmação da invoice na lista e em Produção; edição de preço negativo e remoção do item de teste; abertura do perfil “Nova impressora”; criação de evento de calendário; triagem técnica avançada, geração de relatório; e criação de peça/revisão sem anexo. As 15 áreas também foram abertas em smoke test.

A revisão paralela não usou uma sessão de navegador única compartilhada de forma confiável; o resultado foi, por isso, reconciliado por IDs e retestado sequencialmente nos achados críticos. Os passos que dependiam de dados não semeados ou de controles nativos permanecem listados como bloqueados ou não testados.

## Verificações estáticas e de build

- AST na camada do produto: **120 botões** e **125 campos** nativos (`input`, `select`, `textarea`); nenhum desses elementos foi encontrado sem handler/controle literal. Os componentes genéricos em `components/ui` encaminham props e incluem dois botões e cinco campos sem handler literal próprio, portanto não foram tratados como controles sem ação.
- `pnpm check`: passou.
- `pnpm test`: **33 testes passaram** em 6 arquivos.
- `pnpm build`: passou; o Vite alertou sobre chunk JavaScript de **1.073,60 kB** e o pnpm avisou que a chave de configuração `pnpm` no `package.json` não é mais lida pela versão instalada (incluindo `patchedDependencies`/`overrides`).
- A auditoria de cor/tipografia/gradiente anterior permanece válida para o commit testado; a validação visual não substitui revisão manual completa de foco, teclado e touch.

## Próximos passos para avançar a cobertura

1. Corrigir e retestar preço negativo e gerenciamento de foco modal.
2. Decidir se o valor inicial do pagamento deve ser explicitamente `0` ou permanecer em branco com apresentação inequívoca.
3. Criar dados de teste controlados para pedidos, estados de Produção, estoque, despesas e revisões; executar os 166 cenários ainda não testados no preview.
4. Executar os 85 cenários bloqueados que dependem de estados/dados disponíveis e os 16 cenários de integração em Firebase de staging.
5. Repetir a validação responsiva e de teclado em todos os diálogos e formulários; adicionar instrumentação automatizada se a exigência for cobertura de linhas/branches de código.

**Não houve alteração de código da aplicação nesta rodada de QA.** `main`, GitHub Pages e Firebase de produção não foram alterados. A branch de reconstrução permanece separada; este relatório registra o estado observado e os itens necessários antes de declarar liberação.
