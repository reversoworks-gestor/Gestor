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

## Serviços oficiais — cadastro de 04/11/2026

- [x] Exatamente 4 categorias DET/PDR/FAR/P3D e 21 itens: DET-01–07, PDR-01–03, FAR-01–02, P3D-01–06 e PCT-01–03. Nome/descrição em inglês dos documentos; tipos Principal, Add-on, Principal B2B e Pacote; código único imutável; ativo sim; preço nulo/vazio em todos. Não cadastrar PPF, pintura completa, mecânica ou eletrônica. Documento/job/relatório referencia código.
- [x] Pré-requisitos no mesmo job: DET-03 exige DET-01 ou DET-02; DET-04 exige DET-02; PDR-02/03 exigem PDR-01; FAR-02 exige FAR-01; P3D-03 exige P3D-01 ou P3D-02; P3D-06 exige P3D-01, P3D-02 ou P3D-05. DET-05/06/07 não têm pré-requisito. PCT-01 expande DET-02+04+05 e FAR-01+02; PCT-02 PDR-01+02 e DET-01; PCT-03 requer escolher P3D-01 ou P3D-02 e inclui P3D-03+06. Pacote não vira serviço executável independente.
- [x] Pipeline único e ordenado: Lead → Avaliação → Orçamento enviado → Aprovado → Agendado → Em produção → Controle de qualidade → Entregue / Pago → Pós-venda. Nome, contato, veículo ano/modelo/cor e serviço para sair de Lead; fotos antes e problema para sair de Avaliação; valor orçado e prazo para orçamento; depósito valor/data quando aplicável; datas entrada e promessa antes da execução; material explicitamente lançado antes de Em produção; checklist e fotos depois antes da entrega; valor final/forma/data e saldo quitado para Entregue/Pago; avaliação solicitada sim/não no Pós-venda. Não pular portões pendentes.
- [x] Todo job registra valor orçado, sinal valor/data, custo de material na compra, horas, final cobrado, saldo, forma e pagamento pendente/parcial/pago; cliente/contato/veículo/categoria/códigos e datas entrada/promessa/entrega; imagens antes/depois. Preço manual sem valores padrão.
- [x] Checklists completos DET 10, PDR 8, FAR 8, P3D 10 conforme texto original. Etapas obrigatórias bloqueiam avanço e execução dependente. DET test spot para DET-02 e add-ons trim/engine/water antes da proteção; PDR viabilidade e pintura intacta; FAR dano externo/interno antes de orçar. Fotos antes/depois exigem anexo de imagem. Campos específicos de cada categoria presentes.
- [x] P3D CAD por versão sem sobrescrever; fit test com data/responsável antes de impressão final; rejeição volta CAD e exige nova versão; material segundo função; pasta/projeto e arquivos scan/CAD finais vinculados. P3D-04 B2B só etapas 1–4 com entrega de arquivos; P3D-05 decisão reparar/recriar (recriar segue 3–10).
- [x] Pacotes: PCT-01 FAR restauração → DET correção/trim → proteções FAR-02 e DET-04 por último; PCT-02 PDR sempre antes de DET; PCT-03 P3D completo com fit test. Sequência não invertível.
- [x] Preservar login, dados antigos e publicação em /Gestor/; validar catálogo, pré-requisitos, transições, fotos e fit test, testes TypeScript/build e interface móvel; revisão independente antes de publicação. Nenhuma exclusão remota automática nesta atualização.

## Retomada e implantação desta atualização

- [x] Conferir os arquivos reenviados de serviços e pipelines sem criar itens ou preços adicionais, preservar os dados Firebase e retomar o trabalho interrompido.
- [x] Salvar a versão atualizada e confirmar a implantação no endereço GitHub Pages existente após a validação final.

## Cabeçalho no iPhone — referência de 06/11/2026

- [x] Manter o cabeçalho e seus controles visíveis abaixo dos ícones de sistema e da Dynamic Island, como na segunda captura, sem depender de puxar a página para baixo; preservar proporção, paleta e conteúdos atuais.
- [x] Reservar a altura real do cabeçalho para não encobrir conteúdo; acompanhar rolagem, giro do aparelho e quebra de texto; menu, busca e perfil continuam utilizáveis; desktop não muda de proporção.
- [x] Validar em navegação demonstrativa, áreas seguras emuladas e regressões existentes; publicar no endereço GitHub Pages autorizado sem tocar no Firebase; não declarar teste físico no iPhone.
