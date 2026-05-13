# Dashboard — metodologias por trás da home (`/dashboard`)

A página **Hoje no escritório** organiza o trabalho do advogado sem expor jargão de gestão (Kanban, GTD, Scrum, OKR, etc.). Os nomes na interface são sempre em **linguagem de escritório jurídico**.

## O que aparece na UI (e o que significa por trás)

| UI | Ideia de apoio (só produto/documentação) |
|----|---------------------------------------------|
| O que fazer agora | Captura de entradas + próxima ação + triagem por impacto |
| Prioridade máxima / Importante / Aguardando terceiros | Urgência e importância relativas ao fluxo do caso |
| Casos por fluxo | Fases do trabalho como o caso avança |
| Fluxo de documentos | Onde está cada documento no escritório |
| Atividade recente | Registo curto do que mudou |
| Planejamento da semana | Objetivo simples da semana + fila de tarefas que **não** nascem só de caso/documento/minuta |
| Meta da semana (dentro do planejamento) | Objetivo qualitativo/quantitativo quando existir persistência |
| Tarefas avulsas (dentro do planejamento) | Itens manuais (ligação, cobrança, reunião interna, etc.) |

Não existe cartão ou título **“Scrumban”** na interface.

## Automático (Lex)

Gerado a partir de dados já existentes no Postgres (sem prometer o que não existe):

- Casos sem nome / entrevista incompleta → prioridade e fase **Coleta inicial**
- Casos nomeados sem documento → **Aguardando documentos** e ações de envio
- Documentos por estado → **Fluxo de documentos**
- Minuta com revisão pedida → fila de **O que fazer agora**
- Documentos com leitura lenta ou erro → alertas e pendências
- Atividades recentes → lista curta (limite já aplicado no payload)

Origem na lista de prioridades (texto discreto):

- **Sugerido pelo Lex** — regra automática a partir de caso, documento ou minuta
- **Aguardando cliente** — depende de prova ou dado que tipicamente vem do cliente
- **Aguardando responsável** — passo que o escritório conclui (ex.: nomear caso, concluir entrevista)

## Manual (advogado / equipa)

Previsto no produto; **persistência dedicada ainda não está ligada** na home atual:

- Definir **meta da semana** com indicadores (CTA honesto para configurações até existir modelo)
- **Adicionar tarefa** avulsa (botão desativado com explicação — sem inventar dados nem gravar sem API)
- Atribuir responsável, prazo e vínculo com caso — quando existir tabela ou canal seguro (ex.: metadata já usada no projeto)

## Por que não mostrar jargão ao advogado

O utilizador final pensa em **casos, prazos, clientes e peças**. Termos de método de trabalho geram ruído e não mudam o comportamento do sistema. O Lex traduz metodologia em **rótulos jurídicos** e **ações concretas**.

## Modelo de dados (auditoria)

- **Activity** — eventos de auditoria; não substituem tarefas editáveis com responsável/prazo.
- **CaseAlert**, **Case**, **Document**, **CaseDraft**, **DraftApproval** — alimentam prioridades automáticas.
- **Workspace** — `onboardingJson` etc.; não há hoje campo dedicado a “meta da semana” ou “tarefas avulsas” no schema principal consultado pelo briefing.

Qualquer persistência nova (metas semanais, tarefas avulsas) deve passar por **decisão explícita** (migrations, RLS, escopo por `workspaceId`).

## Como evoluir

1. Modelo `WorkspaceWeeklyGoal` ou JSON versionado em `Workspace` com validação.
2. Modelo `OfficeTask` (título, descrição, prioridade, `assigneeId`, `dueAt`, `caseId?`, `documentId?`, `draftId?`, `status`, `source`: `lex` | `manual`).
3. Na home: mesclar tarefas manuais **abaixo** dos bloqueadores automáticos ou numa sublista fixa dentro de **Planejamento da semana**, nunca escondendo gargalos reais de caso.

## Ficheiros relevantes

- `src/lib/dashboard/morning-briefing-data.ts` — agregações e prioridades.
- `src/components/dashboard/morning-briefing.tsx` — layout e copy.
- `src/app/(app)/dashboard/page.tsx` — shell rápido + Suspense do corpo.
