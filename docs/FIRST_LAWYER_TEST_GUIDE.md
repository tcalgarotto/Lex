# Primeiro teste com advogado — guia operacional

## Objetivo

Receber feedback **honesto e útil** de 1 advogado sobre se o Lex resolve dor real,
sem expor informação sensível e sem prometer mais do que o produto entrega hoje.

> **Não substitui revisão humana.** Toda peça gerada exige conferência do advogado
> antes de protocolo.

---

## 1. Preparar o ambiente

Antes de enviar a URL:

- [ ] `npm run vercel:check` em produção: 0 fail.
- [ ] `/api/health` retorna `status=ok` ou `status=degraded` (com flags claras).
- [ ] Workspace demo criado: `npm run seed:demo-legal` em staging.
- [ ] Convidar o advogado pelo painel do Lex (`/settings/team`).
- [ ] Compartilhar o link `https://lex-navy.vercel.app/test-guide`.

---

## 2. Roteiro sugerido para o advogado

### Passo 1: criar conta
- Abra `https://lex-navy.vercel.app`.
- Clique em "Entrar" → "Criar conta" ou aceite o convite recebido por email.
- Confirme o email.

### Passo 2: visitar o dashboard
- Veja KPIs.
- Olhe o sidebar — Lex tem 4 espaços principais: **Casos · Cockpit · Estratégia · Processos**.

### Passo 3: criar um caso
- `/cases/new` → cole um case fictício (1-2 parágrafos com fatos, partes e pedidos).
- O Lex extrai automaticamente: partes, fatos numerados, pedidos, tribunal alvo, UF.

### Passo 4: rodar estratégia
- `/strategy` → cole a mesma consulta jurídica (ex.: "boa-fé objetiva CDC art. 422").
- Veja:
  - **TrustUxOverview**: confiança, divergência, força argumentativa, grounding heatmap.
  - **Research Engine**: teses dominantes, divergências, precedentes líderes.
  - **Raciocínio**: favorabilidade do tribunal, riscos, próximos passos.
  - **Explainability**: árvore de raciocínio + pontos jurídicos.

### Passo 5: gerar minuta
- Volte ao caso → botão "Gerar minuta".
- Lex monta uma minuta Markdown estruturada com fundamentação ancorada em chunks.

### Passo 6: rodar review
- Botão "Rodar review" → checklist 0..1 com 8 critérios.

### Passo 7: cockpit operacional
- `/cockpit` → veja alertas (vazio se não houver integração ativa), notificações.

### Passo 8: upload de documento
- `/processos` → criar processo → upload de PDF → ingestion roda em background.

### Passo 9: enviar feedback
- Use o formulário no rodapé de `/test-guide` ou envie por email/WhatsApp.

---

## 3. Perguntas para o advogado

Cole estas perguntas no formulário ou peça por mensagem:

1. **O que ficou claro?** Quais partes da UI fazem sentido sem explicação?
2. **O que ficou confuso?** Onde travou ou achou ambíguo?
3. **Qual feature pareceu mais útil?** (intake, retrieval, minuta, cockpit, alertas, lawyer brain)
4. **Qual feature pareceu arriscada/perigosa?** (algo que poderia gerar erro grave?)
5. **A resposta jurídica parece confiável?** Confiaria em apresentar para um cliente?
6. **As fontes ajudam?** Os chunks/URNs são suficientes para auditar?
7. **O que falta para usar no escritório?** (integrações, áreas, tribunais)
8. **Quais áreas jurídicas devemos priorizar?** (cível, trabalhista, tributário, penal…)
9. **Quais tribunais/fontes são obrigatórios?** (TJSP, TST, STF…)
10. **Pagaria por isso? Quanto/mês?**

---

## 4. Orientações ao advogado

> **Não use dados reais sensíveis no teste inicial.** Use casos fictícios ou anonimizados.
>
> O Lex é um copiloto operacional, **não substitui a revisão humana**. Toda minuta
> exige conferência antes de protocolo.
>
> Tudo o que o Lex faz é **explicável**: cada resposta carrega URNs, chunks e
> traceIds que podem ser auditados.

---

## 5. O que coletar internamente

Mesmo que o advogado não preencha tudo:
- [ ] Tempo total da sessão (Vercel logs).
- [ ] Erros 5xx em rotas críticas (Sentry).
- [ ] Latência média do retrieval.
- [ ] Se o advogado voltou no dia seguinte (sinal de utilidade real).
- [ ] Feature que ele usou mais (Sentry breadcrumbs / Vercel logs).

---

## 6. Próximos passos depois do feedback

Use o feedback para priorizar entre:
1. **Cross-case Knowledge Graph** (Fase 10 do roadmap).
2. **Integrações reais com tribunais** (PJe/e-SAJ live).
3. **Áreas jurídicas adicionais** (trabalhista, penal).
4. **Refinamento de UI** se vários advogados travaram no mesmo lugar.
