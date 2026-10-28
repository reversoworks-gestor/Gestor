# Reverso Gestor — reconstrução automotiva

## Direção aprovada
Recriar completamente o Gestor para a Reverso Works Automotive Restoration & Engineering Studio. Em 28/10/2026 o usuário autorizou explicitamente substituir a paleta anterior do Gestor pelo novo marketing book automotivo. Preservar a logo oficial, Inter e SF Mono/fallback monoespaçado. Incorporar faróis, PDR, peças sob medida e customização, com o método Avaliar → Definir → Desenvolver → Executar → Conferir. O usuário autorizou o desenvolvimento do início ao fim sem revisões intermediárias.

## Arquitetura
Preservar React/TypeScript/Vite e a autenticação e persistência Firebase da base existente. A nova interface usa módulos separados em `source/client/src/gestor`: domínio automotivo e validação; adaptador de estado/persistência; componentes acessíveis; páginas operacionais por domínio. Manter bibliotecas de finanças, seleção de material e PDFs existentes, corrigindo regras e apresentação. Reusar coleções legadas (`clients`, `orders`, `materials`, `printers`, `parts`, `partRevisions`, `expenses`, `calendar`, `triages`, `catalogItems`); novas entidades automotivas usam coleções aditivas de veículos e avaliações. Não apagar, migrar destrutivamente nem redefinir dados antigos. Campos opcionais novos mantêm compatibilidade.

## Funcionalidades
Início e busca global; clientes e veículos; cadastro automotivo com modelo/ano/placa e necessidade; estimativas, invoices, pedidos e pagamentos; jornada de atendimento e produção; avaliação de faróis/PDR/peças/customização e triagem de material; anexos autenticados e revisões; calendário; estoque, reservas e movimentos atômicos; impressoras/manutenção; financeiro/despesas; catálogo e acesso de equipe. Criação, edição, cancelamento, pesquisa, seleção, validação, erros, estados ocupados e feedback precisam refletir operações reais. Não incluir integrações comerciais não solicitadas nem prometer validação de peças críticas sem evidências.

## Design
Verde profundo #031A17 dominante, verde estúdio #062C27 nas superfícies, #0C3931 nas camadas, dourado fosco #C6A55F nas ações/assinaturas e branco #F5F7FA. Cinza claro #C5CDC7 auxiliar. Não usar gradientes decorativos; CTA dourado sólido. Estados semânticos continuam identificados por texto/ícone e cores de estado somente quando necessárias. Navegação lateral em desktop e menu móvel utilizável; respiro, linhas finas, informação contextual e ações explícitas. Sem imagens decorativas no sistema; evidências reais anexadas pelos usuários. Foco visível, modais com contenção/restauração, teclado, WCAG AA e prefers-reduced-motion.

## Ambiente e entrega
Workspace gerenciado `/home/ubuntu/reversogestor`, com código em `source/`. Testes unitários e de integração, emuladores Firebase com projeto `demo-reverso-qa` sem credenciais reais, testes públicos de interface com dados sintéticos e navegador. Jamais executar QA no Firebase de produção. Código será sincronizado para a branch de reconstrução no repositório existente `reversoworks-gestor/Gestor`; preservar main, histórico e publicação existente. Salvar checkpoint gerenciado da mesma versão para Preview. Não declarar que produção foi implantada ou que a validação de produção ocorreu sem comprovação.

## Publicação autorizada em 28/10/2026

O usuário solicitou explicitamente publicar em https://reversoworks-gestor.github.io/Gestor/. A fonte atual de Pages é `main:/`; integrar a branch reconstruída por fast-forward, mantendo o histórico, e publicar o build com `VITE_GITHUB_PAGES=true`, base `/Gestor/`, assets locais e `.nojekyll`. Não mudar domínio, configuração Firebase ou dados comerciais. Confirmar a implantação por build do GitHub Pages, recursos HTTP e navegação anônima/demonstração. Essa autorização supera a restrição anterior de não substituir o frontend publicado; não autoriza migração destrutiva dos dados.

## Ajuste móvel após captura do usuário

Corrigir o shell sem redesenhar os módulos nem alterar registros. A busca inline fica reservada a larguras a partir de 1280 px, com envio dentro do próprio campo; abaixo disso, um único botão abre o modal de busca. O título pode quebrar linhas, sem ellipsis. Menu/perfil mantêm alvos de 44 px, e o cabeçalho respeita áreas seguras do iPhone. Remover as regras conflitantes de 430 px em vez de encobrir o problema com corte de conteúdo.

## Dispositivo prioritário confirmado

O responsável informou em 28/10/2026 que usa prioritariamente o iPhone 17 Pro Max. O Gestor deve ser touch-first: leitura e ações principais confortáveis nesse aparelho, áreas seguras de topo/laterais/base, orientação vertical e horizontal e conteúdo utilizável com texto ampliado. Validar por viewport e emulação de toque; não apresentar emulação Chromium como teste físico de Safari/iPhone.

## Compatibilidade ao abrir Estimativas

A pilha da captura foi localizada no comparador de documentos que chama `localeCompare` diretamente em timestamps. Corrigir a leitura/ordenação aceitando ISO, época numérica, Date e Timestamp do Firestore, com tratamento de valores ausentes ou inválidos. Fazer a adaptação em memória, sem gravar, apagar ou migrar registros remotos. Proteger o fallback de erros com mensagem curta em português e ações acessíveis, sem pilha técnica pública. Manter o uso prioritário no iPhone 17 Pro Max e publicar no mesmo GitHub Pages.
