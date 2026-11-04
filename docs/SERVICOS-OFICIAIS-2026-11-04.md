# DOCUMENTO 1 de 2 — CADASTRO DE SERVIÇOS
## Para: Manus (desenvolvimento do sistema de controle da Reverso Works)
## De: Lincoln Porta, via Jay — 04/11/2026

### Contexto
A Reverso Works é uma empresa automotiva em Fremont, CA, de Lincoln Porta. O sistema de controle (financeiro + processos) foi criado por Lincoln do zero, e você (Manus) é responsável pelo desenvolvimento dele. Este documento é a especificação oficial e aprovada dos serviços da empresa, para cadastro no sistema. O Documento 2 (processos) complementa este: ele define o funil de status dos trabalhos e o checklist operacional de cada categoria abaixo.

### Instruções de implementação
1. Cadastrar exatamente as **4 categorias** e os **21 itens** deste documento — nenhum serviço a mais, nenhum a menos.
2. Cada item tem um **código único** (ex.: DET-01). O código é a chave de referência em todo o sistema (orçamentos, jobs, relatórios) e não deve ser alterado.
3. **Preço: deixar NULO/vazio em todos os itens.** A empresa ainda não definiu a tabela; todo serviço é orçado "por avaliação". NÃO inventar, estimar ou sugerir valores.
4. Campo "tipo" tem 4 valores possíveis: `Principal`, `Add-on`, `Principal B2B`, `Pacote`.
5. Campo "pré-requisito/composição": em itens Add-on, aponta os serviços que precisam existir no mesmo job antes dele; em Pacotes, lista os códigos que o pacote contém. Ao vender um Pacote, o sistema deve lançar os códigos individuais que o compõem (o pacote é o nome comercial, não um serviço executável separado).
6. **NÃO cadastrar:** PPF, pintura completa, mecânica e eletrônica automotiva (dashcam, CarPlay, painel digital). Eles foram excluídos deliberadamente do catálogo. Se um dia entrarem, virão em documento novo.

### Estrutura de dados sugerida por item
`codigo (único)` · `nome (inglês, como vai para o cliente)` · `categoria` · `tipo` · `pre_requisito_ou_composicao` · `preco (nulo por enquanto)` · `ativo (sim)`

---

## CATEGORIA DET — Detailing & Paint Care
Serviços de estética, correção e proteção de pintura e interior.

| Código | Nome | Tipo | Pré-requisito |
|---|---|---|---|
| DET-01 | Interior & Exterior Detailing | Principal | — |
| DET-02 | One-Step Paint Correction | Principal | — |
| DET-03 | Paint Protection — Ceramic Spray Sealant | Add-on | DET-01 ou DET-02 |
| DET-04 | Paint Protection — Ceramic Coating | Add-on | DET-02 |
| DET-05 | Trim & Plastic Restoration | Add-on | — |
| DET-06 | Engine Bay Detailing | Add-on | — |
| DET-07 | Water Spot Removal | Add-on | — |

Descrições (para exibição ao cliente):
- **DET-01** — Full detailing inside and out: deep cleaning, decontamination and finishing.
- **DET-02** — Machine polishing in a single stage: removes light swirls, haze and oxidation, restores gloss.
- **DET-03** — Spray ceramic sealant applied after detailing/correction.
- **DET-04** — Full ceramic coating, premium protection, applied only on corrected paint.
- **DET-05** — Faded exterior plastics and trim restored to a deep factory look.
- **DET-06** — Engine bay degreased, cleaned and dressed.
- **DET-07** — Mineral water spots removed from glass and paint.

## CATEGORIA PDR — Paintless Dent Removal
Remoção de amassados sem pintura.

| Código | Nome | Tipo | Pré-requisito |
|---|---|---|---|
| PDR-01 | Paintless Dent Removal | Principal | — |
| PDR-02 | Paint Chip & Scratch Touch-Up | Add-on | PDR-01 |
| PDR-03 | Localized Polishing | Add-on | PDR-01 |

Descrições:
- **PDR-01** — Dents removed with no paint and no filler; original paint preserved. Orçado por painel/amassado.
- **PDR-02** — Touch-up of paint chips/scratches in the repaired area.
- **PDR-03** — Machine polishing of the repaired area so it blends with the panel.

## CATEGORIA FAR — Headlight Restoration
Restauração de faróis.

| Código | Nome | Tipo | Pré-requisito |
|---|---|---|---|
| FAR-01 | Headlight Restoration | Principal | — |
| FAR-02 | UV / Ceramic Headlight Protection | Add-on | FAR-01 |

Descrições:
- **FAR-01** — Yellowed/cloudy headlights sanded and polished back to clear.
- **FAR-02** — UV/ceramic protection sealed on the restored lens to prevent re-yellowing.

## CATEGORIA P3D — 3D Parts, OEM & Custom
Peças impressas em 3D: reposição de peças descontinuadas, peças customizadas e trabalho digital (scan/CAD).

| Código | Nome | Tipo | Pré-requisito |
|---|---|---|---|
| P3D-01 | Discontinued Part — OEM-Style Replacement | Principal | — |
| P3D-02 | Custom Part / Functional Adaptation | Principal | — |
| P3D-03 | OEM Finish (sanding, primer, texture, paint) | Add-on | P3D-01 ou P3D-02 |
| P3D-04 | 3D Scanning & CAD (B2B) | Principal B2B | — |
| P3D-05 | Broken Plastic Part Repair | Principal | — |
| P3D-06 | Part Installation | Add-on | P3D-01, P3D-02 ou P3D-05 |

Descrições:
- **P3D-01** — A discontinued/unavailable part recreated: scan, CAD, prototype, final part.
- **P3D-02** — A part designed from scratch for a project (adapters, mounts, one-off solutions).
- **P3D-03** — Finishing that makes a printed part look and feel like a factory part.
- **P3D-04** — Scanning and CAD design only, delivered as files to shops and builders.
- **P3D-05** — Broken plastic brackets, tabs, clips and covers repaired or recreated.
- **P3D-06** — Installation of the finished part on the vehicle.

## PACOTES (nome comercial — lançam os códigos individuais)
| Código | Nome | Composição |
|---|---|---|
| PCT-01 | Bring It Back | DET-02 + DET-04 + DET-05 + FAR-01 + FAR-02 |
| PCT-02 | Dent + Detail | PDR-01 + PDR-02 + DET-01 |
| PCT-03 | The Missing Part | P3D-01 ou P3D-02 + P3D-03 + P3D-06 |

---

### Resumo para conferência
- Categorias: 4 (DET, PDR, FAR, P3D)
- Serviços principais e add-ons: 18
- Pacotes: 3
- Total de itens a cadastrar: **21**
- Preços: **todos nulos** — não preencher.
