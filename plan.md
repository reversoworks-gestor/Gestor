# Plano de implementação — Reverso Gestor

## Escopo e abordagem

Reaproveitar o código-fonte React/TypeScript, Vite e Firebase já existente no repositório `reversoworks-gestor/Gestor`, em vez de reconstruir sobre o bundle compilado. Trabalhar exclusivamente na branch `manus/reverso-gestor-reconstruction`; preservar `main`, a publicação GitHub Pages e o workspace Firebase real. Corrigir comportamentos encontrados na revisão das áreas e conectar os controles aos fluxos, estados e mensagens adequados. Quando existir dependência remota, manter o modo de demonstração sem gravação real e indicar claramente seus limites.

## Estrutura do projeto

- `source/client/src/App.tsx`: autenticação Firebase, abertura do workspace e modo de demonstração.
- `source/client/src/pages/Home.tsx`: navegação, telas operacionais, formulários, ações e ligação à persistência Firestore/Storage.
- `source/client/src/components/DocumentDialog.tsx`: criação e edição de estimativas/invoices, itens, pagamentos, anexos e notas.
- `source/client/src/components/MaterialSelector.tsx`: triagem técnica e decisão de material.
- `source/client/src/lib/`: modelos, regras financeiras, seleção de material, documentos, formatação e adaptadores Firebase.
- `source/client/src/index.css`: tokens visuais, responsividade, componentes e acessibilidade.
- `source/client/public/`: PWA, arquivos oficiais da marca e imagens técnicas existentes.
- Testes Vitest junto aos módulos de domínio; verificações TypeScript/build pelo pacote existente.

## Decisões de implementação

- Manter React, TypeScript, Vite e a integração Firebase existente; não migrar dados nem alterar regras/deploy externos nesta tarefa.
- Tratar `Comando Técnico — Sistema Operacional` como a única referência visual: logo oficial branca fornecida, Preto Operacional, Grafite Operacional/Camada, Linha Técnica, Branco Operacional e Ciano Reverso; gradiente somente no CTA primário; Inter e fallback monoespaçado para dados.
- Priorizar correções de integridade e de campo: datas locais, validação numérica, status de impressoras, estoque, filtros/rotulagem de produção, taxas e anexos dos documentos e estados de demonstração.
- Preservar o caráter operacional e os módulos existentes; não criar funcionalidades decorativas ou prometer persistência que a prévia não oferece.
- Implementar documentação de trabalho e regressões verificáveis no código da branch. Usar preview local com `?preview=1`; não executar gravações, uploads ou exclusões no Firebase de produção.

## Design

- **Movimento:** Comando Técnico — Sistema Operacional, derivado do Gestor e definido nos ativos oficiais do projeto.
- **Princípios:** precisão operacional; hierarquia e rastreabilidade; contraste e legibilidade; feedback explícito com próximos passos.
- **Cor:** base escura dominante para segurança e foco; grafites em camadas para organizar dados; ciano funcional para foco/seleção/ações secundárias; semântica de estado apenas quando necessária; gradiente reservado ao CTA primário.
- **Layout:** navegação operacional existente, títulos/descrições de contexto, cartões e tabelas em superfícies grafite, linhas técnicas discretas e composição responsiva para iPhone e desktop.
- **Elementos recorrentes:** metadados e IDs monoespaçados; status acompanhados de texto/rótulo; foco ciano visível.
- **Interação:** controles devem refletir estado, ação, carregamento e resultado; formulário valida junto ao campo e fornece erro/recuperação; movimento curto e funcional, respeitando `prefers-reduced-motion`.
- **Tipografia:** Inter para interface e SF Mono/fallback monoespaçado para IDs, códigos, medidas e status.
- **Logo:** somente o arquivo oficial; versão branca sobre fundo escuro, sem recorte, recoloração ou efeito.
- **Essência/voz:** sistema privado de operação e engenharia da Reverso Works; técnico, claro e responsável. Microcopy aponta evidências, pendências e próximos passos sem alegações absolutas.

## Entrega

Revisar páginas, campos, controles e fluxos essenciais usando o código, testes automatizados e preview. Corrigir as falhas reproduzíveis; registrar as dependências de credenciais/serviços que não possam ser certificadas sem acesso explícito ao ambiente Firebase real. A branch de trabalho não publica o site nem altera a branch publicada.