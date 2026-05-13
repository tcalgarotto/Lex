"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarEventStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";

export function CalendarEventCompleteButton({
  eventId,
  status,
}: {
  eventId: string;
  status: CalendarEventStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (status !== CalendarEventStatus.PENDING) return null;

  async function markDone(ev: React.MouseEvent) {
    ev.preventDefault();
    ev.stopPropagation();
    setBusy(true);
    try {
      const res = await fetch(`/api/calendar/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: CalendarEventStatus.DONE }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" size="sm" variant="outline" className="shrink-0 text-xs" disabled={busy} onClick={markDone}>
      {busy ? "…" : "Concluir"}
    </Button>
  );
}
