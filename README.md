# Reverso Gestor — Automotive Studio

Sistema privado de operação da Reverso Works, reconstruído conforme o Marketing Book Automotivo e a autorização de verde/dourado de 28/10/2026. A aplicação organiza clientes, veículos, estimativas, invoices, pedidos, jornada de produção, avaliações, triagem de materiais, agenda, estoque, impressoras, manutenção, peças/revisões, financeiro, despesas, catálogo e ajustes.

## Desenvolvimento

Node.js 22+ e Java 21+ para os emuladores. Dependências fixadas em `source/pnpm-lock.yaml`.

```bash
npx --yes pnpm@10.4.1 --dir source install --frozen-lockfile
npx --yes pnpm@10.4.1 --dir source dev --host 0.0.0.0
```

A aplicação serve a porta 3000. O modo `/?preview=1` mantém dados explicitamente sintéticos no navegador e anexos em IndexedDB. Não acessa dados de produção. O estado de demonstração usa a chave `reverso-automotive-demo-v1`; os dados não são uma simulação de gravação Firebase.

## Verificações

```bash
npx --yes pnpm@10.4.1 --dir source check
npx --yes pnpm@10.4.1 --dir source test
npx --yes pnpm@10.4.1 --dir source build
bash scripts/test-emulators.sh
python3 qa/check_layout.py
```

O último comando requer agent-browser e o servidor local iniciado. O runner Firebase utiliza somente `demo-reverso-qa`, limpa variáveis de credenciais e inicia Auth, Firestore e Storage locais. Os testes de concorrência, conversão e revisão chamam o mesmo repositório transacional utilizado pela aplicação, não uma implementação substituta.

## Acesso e produção

A configuração web pública do Firebase `reverso-works` foi preservada. Sem `preview=1`, o acesso usa e-mail/senha e o workspace `reverso-private`. Somente contas autorizadas leem dados. O responsável altera as configurações e os e-mails autorizados; integrantes não podem se autopromover.

O workspace deve estar provisionado administrativamente com `ownerUid` e `allowedEmails`. **A aplicação não permite que o primeiro visitante autenticado tome posse de um workspace vazio.** Não existe criação automática de proprietário no cliente.

As regras versionadas em `firestore.rules` e `storage.rules` devem ser implantadas no projeto Firebase correto pelo responsável autorizado antes de uma troca de produção. O desenvolvimento e os emuladores não implantam regras nem alteram a aplicação anterior. Downloads de anexos usam autenticação Storage, sem persistir URLs bearer; a configuração CORS do bucket de produção deve permitir o domínio efetivo de uso para esse fluxo.

Para testar o login sem produção, inicie os emuladores e o frontend com `VITE_USE_FIREBASE_EMULATORS=true`. Essa opção é aplicada somente em desenvolvimento; um build de produção não pode ativá-la. Não publique uma configuração de emuladores.

## Integridade

Valores monetários são calculados em centavos. Documentos e despesas guardam sua moeda; relatórios segregam USD e BRL, sem conversão automática. Uma invoice conserva o snapshot comercial do cliente emitido. Estimativa → invoice é idempotente. Reservas usam o saldo atual em transação; revisão e ponteiros da peça são gravados atomicamente.

Para manter a validação server-side dentro dos limites do Firestore, cada documento comporta até **20 lançamentos entre itens e pagamentos**. Divida documentos maiores e registre o vínculo no escopo. A entrega exige etapa Conferir, aprovações de acabamento, montagem e cliente e notas de conferência. Triagem técnica não substitui validação de componentes críticos.

O projeto mantém compatibilidade de leitura com modelos e coleções existentes, inclusive `partRevisions`, e o código anterior permanece no histórico Git. Não há migração destrutiva de dados.

## Estrutura

`source/client/src/gestor/pages` contém os módulos operacionais; `components` contém shell, campos e modais acessíveis; `domain.ts` concentra validação e normalização; `repository.ts` reúne transações reais; `store.tsx` integra persistência e demonstração. `lib/firebase.ts` encapsula acesso privado e anexos. `qa` e os testes documentam verificações executáveis. Consulte `docs/BRAND-AUTOMOTIVE.md` para a identidade desta edição.

## Permissões e rastreabilidade

A conta responsável pelo workspace pode alterar registros e arquivos. Integrantes autorizados têm acesso consultivo, sem gravação, exclusão ou sobrescrita de evidências, tanto na interface quanto nas regras Firebase. Não há criação automática de proprietário pelo cliente. Remoções de registros autenticados são arquivamentos com `archivedAt` e `archivedBy`: não há exclusão física de registros e os anexos históricos continuam preservados. Registros arquivados deixam de aparecer nas listas operacionais. A demonstração usa dados descartáveis locais e não representa retenção de produção.

Moeda é fixada em documentos, despesas e itens do catálogo. Trocar a moeda do estúdio afeta novos registros e o filtro inicial de relatórios; não converte nem renomeia valores históricos. O seletor comercial mostra somente itens do catálogo na moeda do documento.

## Publicação em GitHub Pages

Endereço solicitado: https://reversoworks-gestor.github.io/Gestor/. O build de produção usa `VITE_GITHUB_PAGES=true`, base `/Gestor/`, e está servido pela branch `main:/`, com `.nojekyll`. O código-fonte e o histórico foram preservados. Implantar o frontend não altera as regras ou os dados do Firebase; as novas regras dependem de acesso administrativo.
