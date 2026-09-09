# Implementação — Dossiê de Pedidos

Esta alteração foi aplicada sobre o commit de baseline `69dd8d377279252ce67f211bf6b7fc5f7489247f`. O repositório publicado contém somente o bundle estático do Gestor, sem o código-fonte React original. Para preservar a interface já validada, a implementação adiciona um módulo complementar carregado após o bundle existente; não reconstrói nem substitui o layout, a identidade visual ou os assets do Gestor.

## Funcionalidades incluídas

| Fluxo | Implementação |
|---|---|
| Consulta de pedido | Cada linha da aba **Pedidos** pode ser aberta para exibir o dossiê com cliente, linha, etapa, entrega, material, código da peça, revisão, prioridade, notas e imagens. |
| Edição de pedido | O dossiê apresenta a ação **Editar pedido**, que atualiza o documento do pedido e o cartão correspondente no fluxo de produção. |
| Cadastro de cliente no pedido | O seletor de cliente agora contém **+ Criar novo cliente**. A opção abre um segundo pop-up, preserva o formulário do pedido e adiciona o novo cliente já selecionado. |
| Notas | O modal de criação recebeu o campo **Notas**; o editor do pedido permite alterar o mesmo conteúdo. |
| Imagens | É possível selecionar várias imagens JPEG, PNG ou WebP no pedido. Os arquivos ficam no Firebase Storage, e o Firestore guarda apenas os metadados e o caminho seguro. |
| Economia de armazenamento | Cada imagem é convertida para **WebP lossless** e a conversão é aceita apenas quando o arquivo resultante é menor. Caso contrário, o arquivo original é mantido. Assim, não há perda visual nem aumento de armazenamento. |
| Animação | O pop-up aninhado de cliente e o dossiê usam transições de opacidade e transformação de 180–220 ms, com respeito a `prefers-reduced-motion`. O modal original já mantém a animação existente. |

## Armazenamento e acesso privado

As imagens não são gravadas como Base64 ou BLOB no Firestore. Elas usam o caminho `workspaces/reverso-private/orders/{orderId}/{arquivo}` no Firebase Storage. O arquivo `storage.rules` limita leitura e escrita aos integrantes autorizados do mesmo workspace, aceita somente JPEG, PNG e WebP e aplica o limite de 25 MB por arquivo.

Para tornar os envios de imagem operacionais no Firebase, falta apenas publicar a regra de Storage com uma conta que tenha acesso ao projeto `reverso-works`:

```bash
cd Gestor
npx firebase-tools deploy --only storage --project reverso-works
```

A tentativa de publicação não foi executada porque o ambiente não possui uma conta Firebase autenticada. Nenhum dado de produção foi alterado durante esta implementação.

## Validação realizada

A prévia local foi aberta em `?preview=1&view=orders`. Foram validados: preservação da aba Pedidos existente; abertura do detalhe a partir da linha do pedido; presença de notas e anexos no modal de pedido; presença e animação do pop-up de novo cliente sem abandono do formulário; e produção de um arquivo WebP válido (`RIFF` / `WEBP`) pelo encoder lossless. A codificação também foi submetida a um teste de pixels RGBA, com igualdade exata entre a imagem fonte e a imagem WebP decodificada. A verificação de sintaxe JavaScript e `git diff --check` também concluíram sem erros.
