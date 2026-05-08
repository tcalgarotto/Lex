# Auditoria de UX e Produto — Projeto Lex

## 1. Consistência e Linguagem

### 1.1 Conflito de Nomenclatura (Processos vs. Casos)
- **Evidência:** O dashboard e a navegação principal usam "Processos" (`/processos`). O motor jurídico interno e as tabelas do banco usam "Cases" (`Case`, `CaseFact`).
- **Problema:** Inconsistência semântica. Para um advogado, um "Processo" é uma entidade judicial (com número CNJ), enquanto um "Caso" é uma entidade interna do escritório. O Lex mistura os dois sem distinção clara.
- **Impacto:** Confusão no entendimento do fluxo de trabalho (Workflow).

### 1.2 Jargão Técnico "Vazado"
- **Evidência:** Dashboards e listas de documentos exibem termos como `INDEXED`, `CHUNKING`, `tokenEstimate`, `qdrantPointId`.
- **Problema:** Exposição de detalhes de implementação (Leakage of abstraction). Um advogado não deveria precisar saber o que é um "chunk" ou um "token" para usar a ferramenta.
- **Impacto:** Perda de polimento profissional e sensação de "produto de desenvolvedor para desenvolvedor".

---

## 2. Promessas vs. Realidade (Feature Gaps)

### 2.1 Cockpit de Integrações "Fantasma"
- **Evidência:** A página `/cockpit` lista PJe, e-SAJ, Projudi, EPROC, WhatsApp e Diário Oficial.
- **Problema:** No backend, essas integrações são apenas Enums sem adaptadores reais implementados. A interface sugere uma maturidade que o produto ainda não possui.
- **Impacto:** Frustração imediata do usuário ao tentar conectar seu tribunal e descobrir que "não há integração configurada". Quebra total de confiança.

### 2.2 Dashboard "Zero-State" Frio
- **Evidência:** O dashboard inicial (`/dashboard`) é repleto de cards vazios.
- **Problema:** Não há um guia de "Primeiros Passos" ou um fluxo de onboarding interativo (apesar de haver uma flag `onboardingCompleted` no banco). O usuário cai em um sistema complexo sem saber por onde começar.
- **Impacto:** Alta taxa de churn no primeiro uso.

---

## 3. Trust UX (Interface de Confiança)

### 3.1 Métricas Potencialmente Enganosas
- **Evidência:** Componentes como `ConfidenceMeter` e `ForceBar` exibem scores "Alta", "Média", "Baixa".
- **Problema:** Essas métricas são calculadas sobre uma base de dados (Corpus) que o próprio sistema admite estar "extremamente pequena". Um score "Alta" pode ser perigoso se a base de dados estiver incompleta ou desatualizada.
- **Impacto:** Risco jurídico. O advogado pode confiar excessivamente em um score que não reflete a realidade da jurisprudência nacional.

---

## 4. Navegação e Fluxo

### 4.1 "Becos Sem Saída"
- **Evidência:** Algumas CTAs levam a páginas que ainda parecem mocks ou listagens puras sem ação clara (ex.: `/settings/jobs` mostra falhas técnicas mas não permite re-tentar manualmente de forma fácil para o usuário leigo).
- **Impacto:** Sensação de produto quebrado ou incompleto.

### 4.2 Excesso de Texto Explicativo
- **Evidência:** Cabeçalhos de páginas como `/retrieval/explain` e `/cockpit` possuem parágrafos longos explicando o que a página faz.
- **Problema:** "Show, don't tell". Se você precisa de 3 linhas de texto para explicar o que é um "Cockpit", a interface falhou em ser intuitiva.
- **Impacto:** UI poluída e cansativa.
