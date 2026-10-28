# Verificação de qualidade — Reverso Gestor

- **Repositório:** `reversoworks-gestor/Gestor`
- **Branch:** `manus/reverso-gestor-reconstruction`
- **Ambiente:** preview local `?preview=1`, sem gravações no Firebase real
- **Resultado:** QA amplo executado parcialmente; **não há certificação de 100% de cobertura**.

## Cobertura observada

A matriz contém 389 cenários de ação/estado, dos quais 373 foram classificados como testáveis no preview e 16 ficaram fora desse ambiente (autenticação/Storage, concorrência, geração controlada de falhas, fixtures ou PDF/impressão). Após reconciliar IDs e retestar achados, a matriz de preview ficou em **120 PASS, 2 FAIL, 85 bloqueados e 166 não testados**. A taxa PASS observada é 32,17% dos cenários de preview; isso não representa cobertura de código instrumentada.

As 15 áreas carregaram no smoke test. Fluxos sequenciais de cliente, estimativa, conversão em invoice, invoice em Produção, triagem, calendário, impressora e revisão de peça foram exercitados no preview. A auditoria estática encontrou 120 botões e 125 campos de aplicação com handlers/controle; essa inspeção não prova o comportamento de cada estado condicional.

## Achados que impedem declarar liberação

Os **dois FAIL da matriz** são a aceitação de preço negativo e o valor de pagamento visualmente vazio. A fuga de foco abaixo foi descoberta em um teste adicional de acessibilidade, fora dos 389 cenários contabilizados.

1. **Preço negativo no catálogo:** o sistema salvou `-2.50` apesar do limite visual `min=0`.
2. **Foco modal:** ao abrir um diálogo `aria-modal=true`, o foco fica no acionador fora do diálogo; `Shift+Tab` sai para “Mais” na navegação móvel.
3. **Pagamento inicial:** a linha nova mostra valor visualmente vazio, embora o salvamento normalize para zero.

Os dois FAIL de limpeza de nome/empresa não se reproduziram com interação por teclado. “Nova impressora” correspondeu ao template. O campo nativo de data da manutenção não pôde ser validado confiavelmente com a automação disponível e permanece bloqueado.

## Verificações automatizadas

- `pnpm check`: passou.
- `pnpm test`: 33 testes passaram em 6 arquivos.
- `pnpm build`: passou, com aviso de chunk JS de 1.073,60 kB e aviso de configuração `pnpm` ignorada pela versão instalada.
- Nenhum acesso ao Firebase de produção; integração de Storage, regras, autenticação e concorrência requer staging.

Consulte a [matriz detalhada e evidências de execução](QA-EXECUTION-REPORT.md). A [captura da fuga de foco](qa-evidence/focus-escape-reproduced-2026-10-28.png) acompanha o relatório. A branch permanece isolada; `main` e GitHub Pages não foram alterados.
