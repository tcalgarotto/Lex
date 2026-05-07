/**
 * Tipos canônicos do motor de alertas (timeline jurídica viva).
 *
 * Alertas representam mudanças jurídicas / operacionais relevantes
 * para um caso ou para o workspace inteiro.
 */

import type { CaseAlertKind, CaseAlertSeverity } from "@prisma/client";

export type AlertInput = {
  kind: CaseAlertKind;
  severity: CaseAlertSeverity;
  title: string;
  message: string;
  /** Caso opcional. `null` significa alerta no nível do workspace. */
  caseId?: string | null;
  /** URN-LEX, processo, ou outra referência opcional. */
  reference?: string | null;
  /** Campos a incluir no fingerprint além de kind+ref+caseId. */
  fingerprintExtras?: ReadonlyArray<unknown>;
  payload?: Record<string, unknown>;
};
