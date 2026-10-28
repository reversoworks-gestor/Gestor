# TODO — Reverso Gestor

Legenda: `[x]` concluído e verificado; `[~]` implementado ou verificado parcialmente, ainda requer validação complementar; `[ ]` pendente.

## Navegação e operações por área

- [x] **Visão geral e navegação:** preservar o contexto operacional, ligar os atalhos às telas e confirmar a abertura das 15 áreas no preview local.
- [~] **Estimativas, invoices e pedidos:** validar campos e salvar documento de demonstração com item, imposto, pagamento e anexo; converter uma estimativa em invoice. A interação de cada ação condicional ainda exige mais testes de ponta a ponta.
- [~] **Produção:** preservar lista/quadro e ações de navegação; conferir transições de cada estado e o fluxo de arrastar em teste dirigido.
- [~] **Triagem técnica:** preencher campos avançados, testar presets, salvar na prévia e gerar relatório; falta repetir a interação de cada critério e revisar teclado/foco.
- [x] **Clientes:** criar e editar cadastro de demonstração e corrigir composição de nomes e feedback de salvamento.
- [x] **Calendário:** preencher e salvar evento de demonstração com data/hora local, categoria e detalhes.
- [~] **Estoque:** validar regras puras de entrada, consumo e reserva; a concorrência é protegida por transação Firestore, mas requer teste integrado com dois clientes em workspace de staging.
- [~] **Impressoras e manutenção:** alinhar os status ao modelo; completar interação ponta a ponta de cada formulário em staging.
- [~] **Peças e revisões:** criar peça e revisão sem anexo no preview; persistir revisão/vínculo em batch, evitar upload no cancelamento e usar downloads autenticados. Concluir o teste integrado de arquivo em staging.
- [~] **Financeiro e despesas:** revisar os campos e rotas; completar teste de criação/edição de despesa, pagamentos e impressão no navegador.
- [~] **Mais e Ajustes:** confirmar os cartões de navegação e revisar estática e visualmente catálogo/equipe; completar validação dos handlers no workspace real.
- [~] **Cobertura requerida pelo usuário:** inspeção estática local encontrou 119 botões com handler e 127 campos de entrada; dois são componentes genéricos que encaminham propriedades. O snapshot validou as 15 telas e fluxos críticos, mas isso não substitui clicar cada estado condicional nem executar E2E contra o serviço real.

## Identidade, acessibilidade e confiabilidade

- [x] Seguir “Comando Técnico — Sistema Operacional”, usando logo oficial, paleta autorizada, Inter e fallback monoespaçado; o gradiente permanece restrito ao CTA primário.
- [~] Contraste AA foi medido para texto branco operacional com 72% de opacidade nas superfícies; persistem verificações de foco, contenção/restauração de foco em diálogos e operação teclado/touch completa.
- [x] Preview e testes não gravaram no Firebase real; as mudanças ficaram na branch de reconstrução e não alteraram `main` nem publicação.
- [x] Novos downloads de documentos/STL passam por leitura autenticada no Storage; novas gravações deixam de persistir URLs bearer e salvamentos removem o campo legado do documento atualizado.
- [~] Tokens bearer existentes em objetos previamente enviados não são revogados por alteração de código. É necessária migração administrativa/reenvio desses objetos e publicação das regras `storage.rules` no projeto Firebase correto.

## Verificação e entrega

- [x] Typecheck, 33 testes Vitest e build de produção passaram.
- [x] Preview local respondeu HTTP 200; 15 rotas carregaram; fluxos críticos de cliente, documento, triagem e calendário foram exercitados; sem erros de JavaScript/console da aplicação.
- [x] Registrar evidências e limites em `QA-VERIFICATION.md`.
- [x] Manter mudanças na branch `manus/reverso-gestor-reconstruction`; preservar `main` e GitHub Pages até aprovação explícita da publicação.
