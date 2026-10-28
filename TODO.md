# Entrega — Reverso Gestor Automotivo

- [x] Recriar o sistema do início ao fim, mantendo início, estimativas, invoices, pedidos, produção, triagem, clientes, calendário, estoque, impressoras, manutenção, peças/revisões, financeiro, despesas, mais e ajustes, com todas as ações ligadas à persistência/estado correto.
- [x] Aplicar exclusivamente a identidade verde/dourada autorizada: #031A17, #062C27, #0C3931, #C6A55F, #F5F7FA e #C5CDC7; logo oficial intacta, Inter e monoespaçada; estados por texto/ícone; sem gradientes decorativos.
- [x] Incorporar faróis, PDR, engenharia/peças e customização, veículo/modelo/ano/função, avaliação, premissas e limites; método Avaliar → Definir → Desenvolver → Executar → Conferir.
- [x] Todos os campos devem poder ser preenchidos; todos os botões devem funcionar; validar obrigatoriedade, números não negativos, datas reais, associação de registros e transições; indicar erro, carregamento, sucesso e próximo passo.
- [x] Clientes, veículos, documentos, pagamentos, itens, taxas, anexos e revisões devem manter valores após salvar; cancelamento não grava; notas privadas somente em contexto autenticado e nunca no PDF público.
- [x] Reservas e movimentos de estoque devem ser atômicos e resistentes a concorrência; sem saldo negativo, anexos órfãos silenciosos ou referências de revisão inconsistentes.
- [x] Login privado real preservado, nenhum bypass de produção, regras Firebase verificadas; testar permissões, downloads e compensação em emuladores isolados, não em produção.
- [x] Modais devem conter/restaurar foco e fechar por Escape; menu móvel, campos e ações acessíveis em 320, 375, 768, 1024, 1280 e 1440 px; sem overflow global acidental; respeitar redução de movimento.
- [x] Corrigir falhas de preço negativo, valor de pagamento vazio e foco do último relatório; suprir dados de teste para estados antes bloqueados; validar módulos e regressões com resultados observados.
- [x] Revisão independente read-only da implementação, build e TypeScript limpos; testes de interface, domínio e integração sem pendências ocultas; registrar honestamente a cobertura efetiva.
- [x] Código salvo na branch GitHub de reconstrução e checkpoint gerenciado; não sobrescrever main/produção nem declarar implantação sem evidência.

## Fronteira de entrega

A versão reconstruída e testada fica salva na branch de reconstrução e no checkpoint gerenciado. A publicação e a implantação administrativa das regras Firebase não foram executadas; a produção anterior e seus dados permanecem intactos. A matriz aprovada cobre 157 casos definidos, não todas as combinações possíveis.
