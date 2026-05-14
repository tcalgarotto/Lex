# Auditoria de Dívida Técnica e Código Morto — Projeto Lex

## 1. Redundância de Core Engine

### 1.1 O "Cérebro" Duplicado (LegalSource vs. LegalNorm)
- **Evidência:** O sistema mantém duas infraestruturas completas de busca jurídica.
- **Dívida:** 
  - `LegalSource`: Tabela simples, scripts de indexação próprios (`seed/ingest-corpus.ts`), motor de busca `hybrid-retriever.ts`.
  - `LegalNorm`: Tabela complexa, versionada, scripts de sync real (`corpus-sync.ts`), motor de busca `retrieveLegalContext`.
- **Impacto:** Manutenção em dobro. Metade do sistema usa um motor "burro" e a outra metade usa o motor "inteligente". Isso gera resultados inconsistentes e dificulta a evolução da busca indexada.
- **Recomendação:** Deletar `LegalSource` e migrar todas as referências (busca global e chat) para `LegalNorm`.

---

## 2. Funcionalidades "Fachada" (Mocked Features)

### 2.1 Integrações Inexistentes
- **Evidência:** O enum `IntegrationProvider` e a página de Cockpit listam PJe, e-SAJ, etc.
- **Dívida:** Não há código real de integração para esses sistemas. O sistema de integrações hoje é um "esqueleto" sem órgãos.
- **Impacto:** Código morto que ocupa espaço no banco e na UI, criando uma falsa percepção de progresso.

### 2.2 Página de Roteiro de Teste (`/test-guide`)
- **Evidência:** `src/app/(app)/test-guide/page.tsx`.
- **Dívida:** Uma página inteira dedicada a explicar como testar o sistema. Isso deveria ser documentação externa ou um tour de onboarding real, não uma rota fixa no app de produção.

---

## 3. Qualidade do Código e Scripts

### 3.1 Scripts Órfãos ou Obsoletos
- **Evidência:** Pasta `scripts/` e `seed/`.
- **Dívida:** Muitos scripts parecem redundantes. Ex: `corpus-seed.ts` vs `ingest-corpus.ts`. Um usa `LegalNorm`, o outro `LegalSource`. 
- **Impacto:** Confusão para novos desenvolvedores (DX ruim) e risco de rodar seeds que quebram a integridade do novo motor de busca.

### 3.2 Falta de Padronização em Server Actions
- **Evidência:** O projeto mistura rotas de API (`/api/...`) com Server Actions (`processos/actions.ts`) sem um critério claro de quando usar cada um.
- **Impacto:** Lógica de negócio espalhada por múltiplos diretórios, dificultando a auditoria de segurança e performance.

---

## 4. Dependências e Bundle

### 4.1 Bibliotecas Pesadas em Hot Paths
- **Evidência:** `pdfjs`, `tesseract.js`, `mammoth`.
- **Dívida:** Carregamento de bibliotecas de parsing em rotas que deveriam ser leves. 
- **Impacto:** Aumento desnecessário do cold-start das funções serverless no Vercel. Embora haja uso de lazy imports em `ingest-document.ts`, a árvore de dependências continua complexa.
