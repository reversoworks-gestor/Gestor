# TODO — Reverso Gestor

Legenda: `[x]` concluído e verificado; `[~]` parcial; `[ ]` pendente ou com falha confirmada.

## Navegação e operações

- [x] Abrir as 15 áreas em preview local; verificar fluxo de navegação principal.
- [~] Estimativas/invoices: criar estimativa com cliente/item, salvar, converter e confirmar presença em Invoices/Produção; revisar o valor visual vazio em nova linha de pagamento.
- [~] Clientes: criar/editar cadastro e limpar sobrenome/empresa com teclado; retestar validação de e-mail e estados de erro.
- [~] Triagem técnica, calendário e criação de peça/revisão sem anexo exercitados; falta repetir cada estado condicional.
- [~] Produção, pedidos, estoque, financeiro, despesas e ajustes: executar os 373 casos de preview restantes — no relatório detalhado, 120 PASS, 2 FAIL, 85 bloqueados e 166 não testados após reclassificação manual.
- [ ] Corrigir validação de preço no catálogo: impedir salvamento de valor negativo, informar o campo de forma acessível e adicionar teste de regressão.
- [ ] Corrigir gerenciamento de foco: mover foco ao abrir diálogo, conter Tab/Shift+Tab e restaurar o foco ao fechar.
- [ ] Validar campo de data nativo da manutenção com uma rota de automação compatível; não tratar o resultado malformado de `fill` como defeito confirmado.
- [~] Ação “Adicionar pagamento” cria Pix/data e salva valor vazio normalizado como zero; decidir/exibir claramente o valor inicial esperado.

## Integração, acessibilidade e release

- [ ] Executar os 16 cenários fora do preview; usar Firebase de staging para autenticação, Storage e concorrência, além de harness de falhas, fixtures e validação de PDF quando aplicável.
- [ ] Executar estados bloqueados e não testados com fixtures controladas; não afirmar 100% antes de todos terem evidência.
- [ ] Completar auditoria teclado/touch e foco em todos os formulários e diálogos.
- [x] Preservar marca “Comando Técnico — Sistema Operacional”, ativo oficial, tokens, tipografia e gradiente restrito ao CTA.
- [x] `pnpm check`, 33 testes Vitest e `pnpm build` passaram; build mantém aviso de chunk JS de 1.073,60 kB e pnpm ignora configurações antigas `pnpm.*`.
- [x] Nenhum acesso ao Firebase de produção; `main` e GitHub Pages não alterados.
- [x] Registrar status, reclassificações e evidência em `QA-EXECUTION-REPORT.md`.
