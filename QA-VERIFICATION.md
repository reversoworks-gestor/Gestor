# Reverso Gestor Automotivo — verificação final

Versão reconstruída em 28/10/2026 conforme o Marketing Book Automotivo e a autorização de verde/dourado. A aplicação anterior não foi sobrescrita.

## Resultado

| Verificação | Resultado observado |
| --- | --- |
| Matriz de ações e estados dos módulos | **157/157 casos PASS** |
| Testes de domínio, componentes, regressões e PDF | **64/64 PASS** |
| Auth, Firestore, Storage e transações reais em emuladores | **13/13 PASS** |
| Reflow das 16 páginas em 320, 375, 768, 1024, 1280 e 1440 px | **96/96 PASS**, sem overflow global |
| TypeScript e build de produção | Sem erros |
| Logo oficial | SHA-256 idêntico ao original |

A matriz, com ID, ação e observação, está em `qa/case-matrix.json`. Testes não concluídos das rodadas iniciais foram reexecutados no build estático, com seletores estáveis. Não há FAIL, BLOCKED ou NOT_RUN na matriz final. A aprovação de 157 casos refere-se a esta matriz definida; não é garantia absoluta para todas as combinações de dados, navegadores ou falhas possíveis.

## Correções confirmadas

Foram corrigidos preço negativo, pagamento vazio, atualização de centavos e totais, datas impossíveis, troca explícita de cliente versus snapshot histórico, preservação de moeda do catálogo, foco de modais aninhados e confirmação de exclusão que também submetia o formulário pai. As duas últimas falhas foram reproduzidas em testes antes da correção e passaram depois dela. Exclusões livres de cliente, veículo, peça, revisão e evento foram verificadas após a correção. O arquivo STL salvo foi baixado e seus bytes comparados com o original.

Os emuladores exercitaram autenticação, negativas de acesso, leitura consultiva da equipe, gravação restrita ao responsável, limites de anexos, download sem URL bearer, reserva concorrente de estoque, conversão idempotente e vínculo de revisão. O teste de navegador autenticado usou somente usuários sintéticos locais e verificou nota privada e anexo. PDFs multipágina incorporam Inter e a logo oficial e não incluem notas privadas.

## Uso e ativação

A demonstração usa somente registros sintéticos e armazenamento local do navegador. Sem `preview=1`, o código utiliza a integração Firebase preservada e requer conta autorizada e workspace administrativamente provisionado. A produção anterior e seus dados não foram alterados.

**A troca de produção não foi executada.** Para ativação definitiva, o responsável autorizado deve implantar `firestore.rules` e `storage.rules`, conferir CORS do bucket no domínio efetivo e publicar o build. Isso exige acesso administrativo ao Firebase e autorização de publicação, não fornecidos nesta execução. As instruções reproduzíveis estão no README.
