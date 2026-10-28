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
- [x] Código salvo no GitHub e checkpoint gerenciado; publicação na main posteriormente autorizada para GitHub Pages; preservar histórico/dados e não declarar implantação sem evidência.

## Fronteira de entrega

A versão reconstruída e testada fica salva na branch de reconstrução e no checkpoint gerenciado. A implantação administrativa das regras Firebase não foi executada; a publicação gerenciada segue a preferência ativa do Dashboard; o histórico da versão anterior e seus dados permanecem intactos; o frontend foi publicado no endereço GitHub Pages autorizado. A matriz aprovada cobre 157 casos definidos, não todas as combinações possíveis.

## Publicação solicitada

- [x] Publicar a versão reconstruída em https://reversoworks-gestor.github.io/Gestor/, com base `/Gestor/`, logo e fontes carregando, histórico Git preservado e Firebase/dados existentes intactos.
- [x] Confirmar build bem-sucedido do GitHub Pages e carregamento real da versão publicada, incluindo login e navegação de demonstração, sem gravações em produção.

## Correção móvel da captura enviada em 28/10/2026

- [x] Cabeçalho sem busca duplicada em celular, inclusive 430–440 px; título da página integralmente legível; menu, busca e perfil com alvos de toque de pelo menos 44 px; sem sobreposição ou overflow em 320, 375, 430, 440, 768, 1024, 1280 e 1440 px.
- [x] Busca global, menu móvel e perfil continuam operacionais com teclado e toque; manter identidade automotiva e dados Firebase intactos; publicar a correção no mesmo endereço GitHub Pages e confirmar o build.

## Dispositivo principal — iPhone 17 Pro Max

- [x] Priorizar uso por toque no iPhone 17 Pro Max: cabeçalho legível na vertical e horizontal; navegação e busca acessíveis; campos com texto de pelo menos 16 px para evitar zoom de foco; áreas seguras de topo/laterais/base e espaço inferior para o indicador inicial. Verificar dimensões e ações em viewport equivalente; registrar a limitação de emulação de toque/Safari e não declarar teste físico sem acesso ao aparelho.

## Falha ao abrir Estimativas — 28/10/2026

- [x] Estimativas, invoices e pedidos devem abrir com documentos legados cujos timestamps estejam ausentes, numéricos ou no formato Firestore; ordenar sem chamar métodos de string em valores incompatíveis; manter valores e registros originais sem gravação automática.
- [ ] Falhas inesperadas devem exibir uma mensagem curta em português e ações utilizáveis no iPhone, sem pilha técnica pública ou rolagem horizontal; publicar a correção no endereço existente após testes de regressão.
