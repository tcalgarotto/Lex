# Lex Project Audit Report — 2026-05-08

## 1. Executive Summary
The Lex project is in a highly functional state with a robust multi-tenant architecture and a sophisticated legal RAG pipeline. The transition to a "Case-centric" flow is mostly complete, but several legacy routes and technical terms remain. A critical issue is the current production build failure, which must be resolved before deployment. Security and data isolation are strong.

**General Grade: 8.5/10**

## 2. Key Strengths
- **Security & Multi-tenancy:** Rigorous workspace isolation in both Prisma and Qdrant. No cross-tenant leaks identified.
- **RAG Accuracy:** Legal search passed 15/15 in QA, with high precision for Constitutional law.
- **Processing Robustness:** Document ingestion is well-stepped with Inngest, handling errors and "stalled" states gracefully.
- **Architecture:** Clean separation of concerns between Legal Corpus (global) and Workspace Documents (private).

## 3. Critical Issues (P0)
- **Broken Build:** `npm run build` fails with `ENOENT: no such file or directory, rename ... 500.html`. This prevents any production deployment.
- **Test Failure:** `extract-text.test.ts` fails due to an assertion mismatch (`OCR_NOT_AVAILABLE` vs `PDF_NO_TEXT`) when OCR is enabled but fails.

## 4. High Severity Issues (P1)
- **UX Jargon:** Excessive technical terminology in the frontend (Retrieval, Grounding, Intent, Sparse, Dense, Jobs IA, Cockpit). These are alien to legal professionals.
- **Naming Inconsistency:** Sidebar says "Processamentos" for `/processos`, while the page title says "Processos". Status labels are inconsistently English/Portuguese.
- **Missing Translations:** Enum values (e.g., `NormKind`, `CaseStatus`, `IntegrationStatus`) are shown raw in many parts of the UI.

## 5. Medium/Low Severity Issues (P2/P3)
- **Redis Dependency:** Search and dashboard fall back gracefully, but Redis was unreachable in the audit environment.
- **Schema Debt:** `CaseLegalSource` lacks a direct `workspaceId` column (relies on `Case` for isolation). `Document.caseId` lacks `onDelete: Cascade`.
- **Global Search Latency:** Global search includes legal retrieval which adds ~3s to every request, potentially affecting perceived performance for quick lookups.

---

## 6. Detailed Audit Results

### 6.1. Build & Quality Baseline
| Command | Result | Notes |
| :--- | :--- | :--- |
| `npm run lint` | PASSED | Next 15 deprecation warning for `next lint`. |
| `npm run typecheck` | PASSED | |
| `npm test` | FAILED | 1 fail in `extract-text.test.ts`. |
| `qa:search:legal` | PASSED | 15/15 passed. |
| `npm run build` | FAILED | `ENOENT` renaming `500.html`. |

### 6.2. Security & Multi-tenant
- **Verified Endpoints:**
    - `/api/documents/[id]/link-case`: SAFE.
    - `/api/documents/[id]/reprocess`: SAFE.
    - `/api/cases/[id]/legal-sources`: SAFE.
    - `/api/search`: SAFE.
    - `/api/retrieval/search`: SAFE.
- **Vector Isolation:** `workspaceId` filter is correctly applied in `lex_main` searches. `_global_` tenant is used for the legal corpus.

### 6.3. UX & Terminology Audit
| Technical Term | Suggested Replacement | Location(s) |
| :--- | :--- | :--- |
| Retrieval | Pesquisa / Resultados | Sidebar, Strategy, Search |
| Grounding | Embasamento / Apoio | Strategy, Search |
| Intent | Foco / Intenção | Strategy |
| Jobs IA | Processamentos | Sidebar, Dashboard |
| Cockpit | Monitoramento / Painel | Sidebar, Cockpit |
| Sparse/Dense/RRF | (Ocultar do usuário) | Strategy, Retrieval |
| Intake | Triagem / Entrada | Cases, Strategy |
| Pinado | Salvo / Marcado | Case Research |

### 6.4. Functional Flow
- **Stalled Docs:** Correctly identified as "Travado" after thresholds (15-20min).
- **Reprocessing:** Safely clears Prisma and Qdrant states before re-triggering.
- **Case-Doc Link:** Works correctly; documents without cases appear in `/documentos`.

---

## 7. Recommendations

### P0 (Immediate)
1. **Fix Build:** Investigate the `.next` file rename error. Likely related to Next.js 15 standalone output or static page generation.
2. **Fix Unit Test:** Update `extract-text.test.ts` to expect either `PDF_NO_TEXT` or `OCR_NOT_AVAILABLE` depending on environment config.

### P1 (UX & Polishing)
3. **Terminology Scrub:** Perform a global pass to replace AI/Technical jargon with legal-friendly terms.
4. **Enum Mappers:** Implement Portuguese labels for all enums displayed in the UI (`NormKind`, `CaseStatus`, `DocumentStatus`).
5. **Sidebar Sync:** Rename `/processos` label in Sidebar to "Processos" or "Processamentos" consistently across title and label.

### P2 (Refinement)
6. **Schema Update:** Add `workspaceId` to `CaseLegalSource` for better safety and simpler queries.
7. **Search Optimization:** Consider debouncing or splitting global search into parallel streams to avoid waiting for legal retrieval on every keystroke.

## 8. Log of Commands Executed
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run redis:check`
- `npm run qdrant:stats`
- `npm run qdrant:inspect-indexes`
- `npm run qa:search:legal`
- `NODE_ENV=production npm run build`
- Multiple `ls`, `grep_search`, and `read_file` calls for logic verification.

---
*Report generated by Gemini CLI Audit Agent.*
