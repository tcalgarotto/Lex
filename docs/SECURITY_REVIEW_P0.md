# Security Review P0 — Lex (LGPD + Multi-tenant)

> Documento final de auditoria de reconciliação de segurança (OWASP, LGPD, Multi-tenant).
> Última atualização: 14 de Maio de 2026.

## 1. Sumário Executivo
Esta auditoria P0 verificou a fundo o isolamento multi-tenant (Anti-IDOR), dependências, vazamento de PII/segredos, e proteções de endpoints. Foram mitigadas vulnerabilidades críticas em pacotes, aplicadas travas em profundidade no banco de dados e introduzidos testes simulados iniciais. A camada de Proxy Edge foi reconciliada e o documento reflete o estado empírico, sem otimismo.

## 2. Status Final
**Status**: **READY para beta controlado com dados reais de teste/usuários piloto, condicionado a revisão contínua de novas rotas.**
*Nota: Não afirmamos estar "100% livre de falhas", o risco foi mitigado nas rotas cobertas, mas novos fluxos exigem os mesmos controles.*

## 3. NPM Audit (Antes vs Depois)
- **Antes**: 19 vulnerabilidades (16 High, 3 Moderate), incluindo falhas críticas no Next.js (Middleware Bypass) e `postcss` (XSS).
- **Depois**: **0 vulnerabilidades**. 
*(Next foi atualizado para >= 16.2.6, corrigindo vulnerabilidades conhecidas)*

## 4. Mitigações Estruturais e Proxies
- **Proxy Boundary**: A camada de segurança de borda (origin guard, session guard) foi corretamente migrada de `middleware.ts` para `proxy.ts`, adotando o padrão atualizado do Next.js. O matcher está preservado, impedindo duplicação de regras.
- **Prevenção de XSS**: Header CSP com `nonce` dinâmico (buffer base64) está ativo por requisição na borda via `proxy.ts`. O nível restritivo requer teste E2E futuro para assegurar ausência de quebras no client (Turbo/Webpack hydration).
- **IDOR Defense-in-Depth**: Várias operações de deleção/atualização (`/api/cases/[id]/delete`, `/api/office-memory/[id]`, `/api/pieces/[id]`) que antes validavam a posse apenas na etapa inicial (`findFirst`), agora forçam a restrição de `workspaceId` ativamente nas chamadas de `update`/`deleteMany`.
- **Vazamento de Documentos Órfãos**: Lógica `userCanReadDocument` bloqueada para impedir vazamento horizontal (cross-tenant) global.

## 5. Testes Simulado e Falsos Positivos Removidos
A cobertura de segurança tem sido iterada. Foram preservados e testados com prova empírica de falhas os cenários de:
- **`simulated-idor.test.ts`**: (Simulação Real) Oposto a placeholder, intercepta e simula acesso para BOLA/IDOR para Cases GET, Cases DELETE e Memberships PATCH.
- **`anti-idor-documents.test.ts` & `anti-idor-drafts.test.ts`**: (Simulação Real) Comprova que `document.findFirst` nulo resulta em HTTP 404 e rejeita invasor.
- Vários testes que atuavam como "placeholders" puros (ex: testavam `expect(true).toBe(true)`) foram marcados como `.skip()` com menções claras `(pendente: implementar simulação real)`. Isso abrange mass-assignment, armazenamento e admin-access, os quais **ainda requerem provas** de automação, muito embora a infra implementada possua regras explícitas nos Handlers.

## 6. Rotas e APIs Auditadas (Check Server-Side)
Todas as rotas sob:
- **Casos**: `/api/cases`
- **Documentos**: `/api/documents`
- **Memória**: `/api/office-memory`
- **Membros**: `/api/memberships`

Tais endpoints utilizam os provedores de autenticação server-side: `getWorkspaceContext()`, `requirePermission()`. Essa defesa no Handler existe *em adição* à do proxy, atuando sob defesa em múltiplas camadas. Webhooks como o `/api/inngest` ignoram verificação de usuário mas validam assinaturas criptográficas (`INNGEST_SIGNING_KEY`).

## 7. Decisão Final e Pendências Reais
- **Pode lidar com dados reais?** **SIM (reduz o risco drásticamente)**. A blindagem multi-tenant atinge a camada de banco de dados por validação atrelada (`id` + `workspaceId`).
- **Pode lidar com pagamentos reais?** **NÃO VALIDADO**. Nenhuma rota oficial de pagamentos foi avaliada por não estar acoplada e exposta neste ciclo.
- **E2E Autenticado**: Não Validado em CI contínua contra banco persistente multi-user na rodada atual. Cobertura se foca em Unit/Integration.
- **Plano de Correção Contínuo**: Desenvolver os testes `.skip()` de mass assignment, access-levels puros e file properties upload para materializar todas as matrizes da OWASP API.
