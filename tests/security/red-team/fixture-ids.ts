/**
 * IDs fixos das fixtures red-team (dados obviamente falsos).
 * Usar apenas em ambiente local/staging com `npm run security:red-team:seed`.
 */

export const RT = {
  slugPrefix: "redteam-",
  workspaces: {
    a: { id: "rt_workspace_a", slug: "redteam-workspace-a", name: "[REDTEAM] Escritório Alfa Falso" },
    b: { id: "rt_workspace_b", slug: "redteam-workspace-b", name: "[REDTEAM] Escritório Bravo Falso" },
  },
  users: {
    adminA: { id: "rt_user_admin_a", email: "redteam-admin-a@fixture.lex.invalid" },
    commonA: { id: "rt_user_common_a", email: "redteam-common-a@fixture.lex.invalid" },
    commonB: { id: "rt_user_common_b", email: "redteam-common-b@fixture.lex.invalid" },
  },
  memberships: {
    adminA: { id: "rt_membership_admin_a" },
    commonA: { id: "rt_membership_common_a" },
    commonB: { id: "rt_membership_common_b" },
  },
  clients: {
    a: { id: "rt_client_a", name: "[REDTEAM] Cliente Alfa Falso Ltda" },
    b: { id: "rt_client_b", name: "[REDTEAM] Cliente Bravo Falso S.A." },
  },
  cases: {
    a: { id: "rt_case_a", title: "[REDTEAM] Caso Alfa — dados fictícios" },
    b: { id: "rt_case_b", title: "[REDTEAM] Caso Bravo — segredo fictício" },
  },
  processes: {
    a: { id: "rt_process_a", number: "1111111-11.1111.1.11.1111" },
    b: { id: "rt_process_b", number: "2222222-22.2222.2.22.2222" },
  },
  legalProcesses: {
    a: { id: "rt_legal_process_a", cnj: "11111111111111111111" },
    b: { id: "rt_legal_process_b", cnj: "22222222222222222222" },
  },
  documents: {
    a: {
      id: "rt_document_a",
      name: "redteam-doc-a-fake.pdf",
      marker: "Documento A: Cliente Alfa, caso Alfa.",
    },
    b: {
      id: "rt_document_b",
      name: "redteam-doc-b-fake.pdf",
      marker: "Documento B: Cliente Bravo, segredo ultra confidencial Bravo.",
    },
  },
  chunks: {
    a: { id: "rt_chunk_a" },
    b: { id: "rt_chunk_b" },
  },
  threads: {
    a: { id: "rt_thread_a" },
    b: { id: "rt_thread_b" },
  },
  calendar: {
    a: { id: "rt_calendar_a", title: "[REDTEAM] Audiência Alfa Falsa" },
    b: { id: "rt_calendar_b", title: "[REDTEAM] Audiência Bravo Falsa" },
  },
  integrations: {
    a: { id: "rt_integration_a", label: "redteam-fake-integration-a" },
    b: { id: "rt_integration_b", label: "redteam-fake-integration-b" },
  },
} as const;

/** Marcador que não deve vazar para respostas do workspace A. */
export const RT_SECRET_MARKER_B = "segredo ultra confidencial Bravo";
