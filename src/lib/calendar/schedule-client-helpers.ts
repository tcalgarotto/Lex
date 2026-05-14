/** Normaliza HH:mm para a API da agenda. */
export function normalizeTimeHm(raw: string): string {
  const s = raw.trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return s;
  let h = Number(m[1]);
  let min = Number(m[2]);
  if (!Number.isFinite(h)) h = 0;
  if (!Number.isFinite(min)) min = 0;
  h = Math.max(0, Math.min(23, h));
  min = Math.max(0, Math.min(59, min));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export async function readScheduleApiError(res: Response): Promise<string> {
  const t = await res.text();
  try {
    const j = JSON.parse(t) as { error?: string; detail?: string };
    return (j.error || j.detail || t).trim() || `Erro ${res.status}`;
  } catch {
    return t.trim() || `Erro ${res.status}`;
  }
}
