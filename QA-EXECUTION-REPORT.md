# Execução final — Reverso Gestor Automotivo

A reconstrução completa substitui a interface anterior e aplica a identidade verde/dourada expressamente autorizada. Este relatório é da nova versão; relatórios anteriores permanecem no histórico Git.

## Escopo validado

Clientes e veículos, documentos comerciais, pagamentos e impostos, jornada e produção, avaliações de faróis/PDR/engenharia/customização, seleção técnica de materiais, estoque, impressoras e manutenção, peças e revisões com STL, calendário, financeiro, despesas, catálogo, configurações, busca, navegação e estados vazios/erro/confirmação.

A matriz final contém **157 casos**, todos aprovados. Os resultados estão em [`qa/case-matrix.json`](qa/case-matrix.json), com cada observação preservada. Rodadas e revalidações originais ficam em `qa/modules` e `qa/residual-results.json` para rastreabilidade; status históricos desses arquivos não substituem a matriz final reconciliada.

## Evidências complementares

- **64 testes automatizados** aprovados: domínio, cálculo, normalização de registros, anexos, foco e confirmação de modais, datas, documentos e PDF multipágina.
- **13 testes de integração** aprovados em `demo-reverso-qa`, usando os módulos transacionais da aplicação e emuladores locais de Auth, Firestore e Storage. Erros PERMISSION_DENIED nessa suíte são negativas esperadas de acesso, não falhas da aplicação.
- **96 combinações de página/largura** aprovadas: 16 páginas em 320, 375, 768, 1024, 1280 e 1440 px. Capturas representativas estão em `qa/evidence`; o detalhe mensurado está em `qa/layout-results.json`.
- TypeScript e build limpos. Logo oficial preservada byte a byte. Inter local, cores aprovadas e ausência de gradientes decorativos.
- Leitura crítica independente identificou problemas de permissões, arquivamento, snapshot e moeda; as correções foram reavaliadas.

## Limites explícitos

O frontend foi testado no Chromium e em viewports móveis, não em todos os motores ou dispositivos físicos. Datas financeiras priorizam emissão sobre criação/vencimento: a interface e o caminho de código/CSV foram conferidos, sem expor datas técnicas de criação desnecessariamente. Notas privadas e integrações autenticadas foram exercitadas em emuladores, não com dados comerciais reais.

Não foi realizada migração destrutiva, substituição do sistema anterior ou implantação de regras Firebase em produção. A publicação gerenciada segue a preferência ativa do Dashboard. As regras estão prontas para implantação pelo responsável com acesso administrativo. Consulte `QA-VERIFICATION.md` e `README.md`.

## Dependências da edição final

Componentes e servidor legados fora da aplicação ativa foram removidos. A biblioteca gRPC foi atualizada para a versão corrigida; 64 testes de unidade e 13 de emuladores passaram novamente. A auditoria das nove dependências diretas de produção e suas transitivas retornou zero alertas em 28/10/2026. Isso não é garantia contra vulnerabilidades futuras; alertas da branch principal antiga não representam esta versão. O frontend continua sendo publicado como saída estática, com backend Firebase externo.
