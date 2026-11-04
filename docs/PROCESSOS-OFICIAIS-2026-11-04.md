# DOCUMENTO 2 de 2 — PIPELINE E PROCESSOS POR TIPO DE SERVIÇO
## Para: Manus (desenvolvimento do sistema de controle da Reverso Works)
## De: Lincoln Porta, via Jay — 04/11/2026

### Contexto
A Reverso Works é uma empresa automotiva em Fremont, CA, de Lincoln Porta. O sistema de controle (financeiro + processos) foi criado por Lincoln do zero, e você (Manus) é responsável pelo desenvolvimento dele. Este documento define como os trabalhos (jobs) andam no sistema e qual processo operacional cada tipo de serviço segue. O Documento 1 (serviços) traz o cadastro oficial: 4 categorias — **DET** (Detailing & Paint Care), **PDR** (Paintless Dent Removal), **FAR** (Headlight Restoration) e **P3D** (3D Parts, OEM & Custom) — e 21 itens codificados (DET-01 a DET-07, PDR-01 a PDR-03, FAR-01 a FAR-02, P3D-01 a P3D-06, PCT-01 a PCT-03).

### Instruções de implementação
1. Implementar o **pipeline universal** (Seção 1) como o fluxo único de status de qualquer job, independente da categoria.
2. Ao abrir um job, o sistema deve **gerar automaticamente o checklist de tarefas do processo da categoria** do serviço principal (Seção 3), na ordem dada. Job de pacote usa os processos das categorias envolvidas, na ordem da Seção 4.
3. Etapas marcadas com ⭐ são **obrigatórias/bloqueantes**: o job não avança de status sem elas concluídas.
4. Etapas de foto ("antes"/"depois") exigem **anexo de imagem** no job.
5. Os **campos financeiros** (Seção 2) existem em todo job. Valores de preço de serviço estão nulos no cadastro (Documento 1) — o valor de cada job é lançado manualmente no orçamento. NÃO criar valores padrão.

---

## SEÇÃO 1 — PIPELINE UNIVERSAL (9 status, nesta ordem)
| # | Status | Quando entra | Registro obrigatório para avançar |
|---|---|---|---|
| 1 | Lead | Contato inicial do cliente | Nome, contato, veículo (ano/modelo/cor), serviço desejado |
| 2 | Avaliação | Fotos recebidas ou inspeção presencial | Fotos "antes" anexadas, descrição do problema |
| 3 | Orçamento enviado | Preço e prazo calculados | Valor orçado, prazo estimado |
| 4 | Aprovado | Cliente aceitou | Sinal/depósito (valor e data), se aplicável |
| 5 | Agendado | Data de entrada definida | Data de entrada, data prometida de entrega |
| 6 | Em produção | Execução começou | Checklist da categoria em andamento |
| 7 | Controle de qualidade | Execução terminou | Checklist completo + fotos "depois" anexadas |
| 8 | Entregue / Pago | Cliente buscou e pagou | Valor final, forma de pagamento, data |
| 9 | Pós-venda | Após a entrega | Avaliação solicitada (sim/não) |

## SEÇÃO 2 — CAMPOS DO JOB
**Financeiros (todo job):** valor orçado · sinal recebido (valor/data) · custo de material (lançar quando a compra acontece) · horas trabalhadas · valor final cobrado · saldo · forma de pagamento · status do pagamento (pendente/parcial/pago).
**Gerais (todo job):** cliente · contato · veículo · categoria · código(s) do(s) serviço(s) · datas (entrada, promessa, entrega) · anexos (fotos antes/depois).
**Específicos por categoria:** listados no fim de cada processo, na Seção 3.

---

## SEÇÃO 3 — PROCESSOS POR CATEGORIA (checklist do job)

### PROCESSO DET — Detailing & Paint Care (10 etapas)
1. Recebimento e inspeção — fotos 360° do veículo e close dos defeitos sob luz; registrar danos pré-existentes.
2. Pré-lavagem, lavagem e descontaminação (clay, se houver correção).
3. Avaliação da pintura — decidir: só detailing ou entra correção (DET-02); registrar upsell aprovado pelo cliente.
4. Mascaramento de plásticos, borrachas e emblemas.
5. ⭐ Correção (se DET-02): test spot primeiro — definir composto, boina e rotação (velocidade baixa corta, média refina, alta lustra); expandir para o veículo todo só após o test spot.
6. Interior completo — aspiração, limpeza de tecidos/couro, plásticos e vidros internos.
7. Add-ons nesta ordem (se contratados): trim (DET-05), engine bay (DET-06), water spots (DET-07) — todos ANTES da proteção.
8. Proteção (DET-03/DET-04) sobre a pintura corrigida e limpa; registrar produto e data; respeitar o tempo de cura.
9. Controle de qualidade sob luz forte, em vários ângulos; fotos "depois" nos mesmos ângulos das fotos "antes".
10. Entrega — walk-around com o cliente e instruções de manutenção/cura.

*Campos específicos DET:* test spot feito (S/N) · composto/boina usados · proteção aplicada (qual/data) · próxima manutenção sugerida.

### PROCESSO PDR — Paintless Dent Removal (8 etapas)
1. ⭐ Avaliação do amassado — tamanho, profundidade, acesso por trás do painel e pintura intacta (S/N). Pintura quebrada muda o escopo: entra touch-up (PDR-02) ou o caso não é PDR puro; registrar a decisão de viabilidade.
2. Orçamento por painel/amassado, com foto do dano sob luz de PDR.
3. Preparação de acesso — remover forro/lanterna/acabamento que bloqueie; registrar o que foi removido.
4. Trabalho sob luz de PDR — alavanca por trás e/ou glue pull, em passadas pequenas, conferindo na luz a cada passada.
5. Refinamento — baixar pontos altos e igualar a textura do painel.
6. Add-ons (se contratados): touch-up (PDR-02) e polimento localizado (PDR-03).
7. Controle de qualidade — luz de PDR e luz natural, de frente e de lado; foto "depois" na mesma posição da foto da avaliação.
8. Remontagem de tudo que foi removido e entrega com walk-around lateral.

*Campos específicos PDR:* painel trabalhado · pintura intacta (S/N) · técnica (alavanca/glue pull) · itens de acesso removidos.

### PROCESSO FAR — Headlight Restoration (8 etapas)
1. ⭐ Avaliação — dano externo (restaura) ou interno/trinca (restauração externa não resolve; alinhar expectativa com o cliente antes de orçar).
2. Foto "antes" padronizada dos dois faróis (mesma distância e luz).
3. Mascaramento de toda a pintura e trim ao redor do farol.
4. Lixamento progressivo — sequência de grãos do mais agressivo ao mais fino, sem pular grão.
5. Polimento até a lente ficar transparente; conferir contra a luz.
6. Proteção (FAR-02, se contratada) — limpeza final e aplicação; respeitar a cura; registrar produto e data.
7. Controle de qualidade — os dois faróis lado a lado, claridade e uniformidade; foto "depois" idêntica à "antes".
8. Entrega — orientar o cliente sobre a vida útil da proteção.

*Campos específicos FAR:* dano externo/interno · grãos usados · proteção aplicada (qual/data).

### PROCESSO P3D — 3D Parts, OEM & Custom (10 etapas)
Processo mais longo, com um portão de aprovação no meio (etapa 6).
1. Intake — fotos da peça/da ausência dela, local, função e esforços que sofre (calor, vibração, sol, peso); registrar tudo (define material e desenho).
2. Viabilidade e orçamento — separar no orçamento: scan/CAD, impressão, acabamento, instalação. Se a impressão não aguenta a função, registrar inviabilidade aqui, não depois.
3. Scan 3D e/ou medição — conferir medidas críticas com paquímetro.
4. CAD — salvar como v1; toda revisão gera uma versão nova, nunca sobrescrever.
5. Protótipo — impressão rápida, só para forma e encaixe.
6. ⭐⭐ FIT TEST (PORTÃO BLOQUEANTE) — encaixe testado e aprovado (pelo cliente ou no veículo) antes de qualquer impressão final. Se reprovado, o job volta à etapa 4 (nova versão do CAD).
7. Impressão final — material escolhido pela função registrada na etapa 1, não por disponibilidade.
8. Acabamento OEM (P3D-03, se contratado) — lixa, primer, textura e pintura.
9. Instalação (P3D-06, se contratada) — instalar, testar a função no lugar, fotografar instalada.
10. Entrega e arquivo do projeto — arquivar scan, CAD final (versão aprovada), material e configurações de impressão, vinculados ao job. Esse arquivo é reutilizável em jobs futuros da mesma peça.

*Variações:* **P3D-04 (B2B)** = etapas 1–4 apenas; entrega são os arquivos (scan + CAD). **P3D-05 (reparo)** = na etapa 2, decidir reparar a peça existente ou recriar (recriando, segue as etapas 3–10).
*Campos específicos P3D:* função/esforços da peça · material final · versão do CAD aprovada · fit test aprovado (data/por quem) · link da pasta do projeto.

---

## SEÇÃO 4 — ORDEM DE EXECUÇÃO DOS PACOTES
- **PCT-01 Bring It Back:** Processo FAR (restauração) → Processo DET (correção) → trim dentro do DET → proteções por último (FAR-02 + DET-04).
- **PCT-02 Dent + Detail:** Processo PDR **sempre primeiro** (com o carro como chegou); Processo DET depois. Nunca inverter.
- **PCT-03 The Missing Part:** Processo P3D completo, sem pular o fit test.

## SEÇÃO 5 — REGRAS GERAIS
- Nenhum job entra em "Em produção" com custo de material pendente de lançamento.
- Fotos "antes" são obrigatórias para sair de "Avaliação"; fotos "depois", para sair de "Controle de qualidade".
- Serviços fora do cadastro do Documento 1 (PPF, pintura completa, mecânica, eletrônica) não devem ser criados no sistema.
