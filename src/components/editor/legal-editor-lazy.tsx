"use client";

import dynamic from "next/dynamic";

const LegalEditorInner = dynamic(
  () => import("./legal-editor").then((m) => m.LegalEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay-strong)] text-sm text-[color:var(--text-muted)]">
        A carregar editor…
      </div>
    ),
  },
);

export type LegalEditorLazyProps = {
  pieceId: string;
  initialContent: Record<string, unknown>;
  processId: string | null;
  aiMeta?: Record<string, unknown> | null;
};

export function LegalEditorLazy(props: LegalEditorLazyProps) {
  return <LegalEditorInner {...props} />;
}
