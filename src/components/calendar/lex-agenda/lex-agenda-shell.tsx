"use client";

import Link from "next/link";
import { LexPageFrame } from "@/components/layout/lex-page-frame";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { LexAgendaEventDialog, type LexAgendaEventFormSeed } from "@/components/calendar/lex-agenda/lex-agenda-event-dialog";
import { readScheduleApiError } from "@/lib/calendar/schedule-client-helpers";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { LexAgendaView } from "@/lib/calendar/lex-agenda-range";
import { parseDateKeyLocal, scheduleRangeForView, weekDaysMondayStart } from "@/lib/calendar/lex-agenda-range";
import { buildAgendaListSections } from "@/lib/calendar/agenda-list-buckets";
import { CALENDAR_DISPLAY_TIMEZONE, calendarDateKeyInTimeZone } from "@/lib/calendar/calendar-labels";
import { SCHEDULE_PORTAL_DISCLAIMER, SCHEDULE_TYPE_LABEL, scheduleNeedsPortalDisclaimer } from "@/lib/calendar/schedule-event-present";
import {
  SCHEDULE_EVENT_TYPES,
  type ScheduleEventDto,
  type ScheduleEventType,
} from "@/lib/calendar/schedule-shapes";
import {
  buildScheduleFetchKey,
  eventDtoInFetchedRange,
  mergeEventIntoList,
  removeEventFromList,
  SCHEDULE_RANGE_CACHE_TTL_MS,
  type ScheduleRangeCacheEntry,
} from "@/lib/calendar/agenda-fetch-cache";
import { LexAgendaEventRow } from "@/components/calendar/lex-agenda/lex-agenda-event-row";
import { agendaEventDateTime as eventDateTime } from "@/components/calendar/lex-agenda/lex-agenda-event-datetime";
import {
  LEX_AGENDA_GRID_END_H as GRID_END_H,
  LEX_AGENDA_GRID_LINE_H_SOFT,
  LEX_AGENDA_GRID_START_H as GRID_START_H,
  LEX_AGENDA_MONTH_WEEK_HDR as MONTH_WEEK_HDR,
  LEX_AGENDA_PX_PER_H as PX_PER_H,
  LEX_AGENDA_WEEK_TIME_COL_PX as WEEK_TIME_COL_PX,
} from "@/components/calendar/lex-agenda/lex-agenda-grid-constants";
import { LexAgendaMonthGrid } from "@/components/calendar/lex-agenda/lex-agenda-month-grid";
import { LEX_AGENDA_TYPE_STYLE as TYPE_STYLE, LexAgendaTypeIcon as TypeIcon } from "@/components/calendar/lex-agenda/lex-agenda-type-icons";

type MetaUser = { id: string; name: string | null; email: string };
type MetaCase = { id: string; title: string };
type MetaLegalProcess = { id: string; label: string; caso_id: string | null; caso_title: string | null };
type MetaInternalProcess = { id: string; label: string; number: string };

function agendaFetchDebug(message: string, extra?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return;
  if (extra) console.debug(`[agenda] ${message}`, extra);
  else console.debug(`[agenda] ${message}`);
}

function monthKeyFromDate(d: Date): string {
  return format(d, "yyyy-MM");
}

function dateKeyFromDate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function hmToMinutes(hm: string): number {
  const [hStr = "0", mStr = "0"] = hm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return Math.max(0, Math.min(23 * 60 + 59, h * 60 + m));
}

function minutesToHm(totalMin: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMin)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function snapMinutes15(totalMin: number): number {
  return Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMin / 15) * 15));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function parseMonthStartDate(monthStr: string): Date {
  const parts = monthStr.split("-");
  if (parts.length !== 2) return startOfMonth(new Date());
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return startOfMonth(new Date());
  return new Date(y, m - 1, 1);
}

function gridDaysForMonth(monthStr: string): { days: Date[]; anchor: Date } {
  if (!/^\d{4}-\d{2}$/.test(monthStr)) {
    const a = new Date();
    const ms = startOfMonth(a);
    const me = endOfMonth(a);
    return {
      days: eachDayOfInterval({ start: startOfWeek(ms, { weekStartsOn: 0 }), end: endOfWeek(me, { weekStartsOn: 0 }) }),
      anchor: a,
    };
  }
  const [yStr, mStr] = monthStr.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const anchor = new Date(y, m - 1, 15);
  const ms = startOfMonth(anchor);
  const me = endOfMonth(anchor);
  return {
    days: eachDayOfInterval({ start: startOfWeek(ms, { weekStartsOn: 0 }), end: endOfWeek(me, { weekStartsOn: 0 }) }),
    anchor,
  };
}

function defaultLexAgendaDialogSeed(): LexAgendaEventFormSeed {
  return {
    title: "",
    type: "interno",
    date: format(new Date(), "yyyy-MM-dd"),
    start: "09:00",
    end: "10:00",
    all_day: false,
    local: "",
    obs: "",
    caso_id: "",
    responsavel_id: "",
    processo_id: "",
    legal_process_id: "",
    document_id: "",
  };
}

export function LexAgendaShell() {
  const [view, setView] = useState<LexAgendaView>("month");
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [selectedKey, setSelectedKey] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [miniMonth, setMiniMonth] = useState(() => format(new Date(), "yyyy-MM"));

  const [casoId, setCasoId] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [eventTypeSlug, setEventTypeSlug] = useState<"" | ScheduleEventType>("");
  const deferredCaso = useDeferredValue(casoId);
  const deferredResp = useDeferredValue(responsavelId);

  const [includeDone, setIncludeDone] = useState(false);
  const [includeCancelled, setIncludeCancelled] = useState(false);

  const [cases, setCases] = useState<MetaCase[]>([]);
  const [users, setUsers] = useState<MetaUser[]>([]);
  const [legalProcesses, setLegalProcesses] = useState<MetaLegalProcess[]>([]);
  const [internalProcesses, setInternalProcesses] = useState<MetaInternalProcess[]>([]);
  const [events, setEvents] = useState<ScheduleEventDto[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<ScheduleEventDto[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [upcomingRefreshKey, setUpcomingRefreshKey] = useState(0);
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const eventsCacheRef = useRef(new Map<string, ScheduleRangeCacheEntry>());
  const fetchAbortRef = useRef<AbortController | null>(null);
  const eventsRef = useRef<ScheduleEventDto[]>([]);
  eventsRef.current = events;
  const metaLoadedRef = useRef(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogEditingId, setDialogEditingId] = useState<string | null>(null);
  const [dialogSession, setDialogSession] = useState<{ key: number; seed: LexAgendaEventFormSeed }>(() => ({
    key: 0,
    seed: defaultLexAgendaDialogSeed(),
  }));
  const [dayCreateDraft, setDayCreateDraft] = useState<{ startMin: number; endMin: number } | null>(null);
  const [weekCreateDraft, setWeekCreateDraft] = useState<{ startDay: number; endDay: number; startMin: number; endMin: number } | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [mobileListDefault, setMobileListDefault] = useState(false);
  const [, startViewTransition] = useTransition();
  useEffect(() => {
    if (typeof window === "undefined" || mobileListDefault) return;
    if (window.matchMedia("(max-width: 767px)").matches) {
      startViewTransition(() => setView("list"));
    }
    setMobileListDefault(true);
  }, [mobileListDefault, startViewTransition]);

  const loadMeta = useCallback(async () => {
    if (metaLoadedRef.current) return;
    const r = await fetch("/api/schedule/meta");
    if (!r.ok) throw new Error(await r.text());
    const j = (await r.json()) as {
      cases: MetaCase[];
      users: MetaUser[];
      legal_processes: MetaLegalProcess[];
      internal_processes: MetaInternalProcess[];
    };
    setCases(j.cases);
    setUsers(j.users);
    setLegalProcesses(j.legal_processes ?? []);
    setInternalProcesses(j.internal_processes ?? []);
    metaLoadedRef.current = true;
  }, []);

  /** Dia focado na UI (grade semana/dia/painel). Em week/day/list, a âncora de intervalo segue selectedKey, não só cursorDate. */
  const focusDate = useMemo(() => parseDateKeyLocal(selectedKey) ?? cursorDate, [selectedKey, cursorDate]);

  const rangeBundle = useMemo(() => {
    let anchor: Date;
    if (view === "month") {
      anchor = startOfMonth(parseMonthStartDate(miniMonth));
    } else if (view === "week") {
      anchor = startOfWeek(focusDate, { weekStartsOn: 1 });
    } else if (view === "day") {
      anchor = startOfDay(focusDate);
    } else {
      anchor = startOfDay(cursorDate);
    }
    const { from, to } = scheduleRangeForView(view, anchor);
    const fetchKey = buildScheduleFetchKey({
      from,
      to,
      casoId: deferredCaso,
      responsavelId: deferredResp,
      eventTypeSlug,
      includeDone,
      includeCancelled,
    });
    return { from, to, fetchKey };
  }, [view, miniMonth, focusDate, cursorDate, deferredCaso, deferredResp, eventTypeSlug, includeDone, includeCancelled]);

  const rangeBundleRef = useRef(rangeBundle);
  rangeBundleRef.current = rangeBundle;

  const writeCacheEntry = useCallback((fetchKey: string, list: ScheduleEventDto[]) => {
    const now = Date.now();
    eventsCacheRef.current.set(fetchKey, {
      events: list,
      fetchedAt: now,
      expiresAt: now + SCHEDULE_RANGE_CACHE_TTL_MS,
    });
  }, []);
  const bumpUpcomingRefresh = useCallback(() => setUpcomingRefreshKey((v) => v + 1), []);

  const handleEventSaved = useCallback((ev: ScheduleEventDto, wasEdit: boolean) => {
    setErr(null);
    setEvents((prev) => {
      const { from, to } = rangeBundleRef.current;
      const fetchKey = rangeBundleRef.current.fetchKey;
      let next: ScheduleEventDto[];
      if (wasEdit) {
        if (!eventDtoInFetchedRange(ev, from, to)) next = removeEventFromList(prev, ev.id);
        else next = mergeEventIntoList(prev, ev);
      } else if (!eventDtoInFetchedRange(ev, from, to)) {
        writeCacheEntry(fetchKey, prev);
        return prev;
      } else {
        next = mergeEventIntoList(prev, ev);
      }
      writeCacheEntry(fetchKey, next);
      return next;
    });
    setDialogEditingId(null);
    bumpUpcomingRefresh();
  }, [writeCacheEntry, bumpUpcomingRefresh]);

  const fetchEventsForBundle = useCallback(
    async (bundle: typeof rangeBundle, signal: AbortSignal, reason: "primary" | "background" | "prefetch"): Promise<ScheduleEventDto[]> => {
      const t0 = typeof performance !== "undefined" ? performance.now() : 0;
      const { from, to, fetchKey } = bundle;
      const p = new URLSearchParams();
      p.set("from", from.toISOString());
      p.set("to", to.toISOString());
      if (deferredCaso.trim()) p.set("caso_id", deferredCaso.trim());
      if (deferredResp.trim()) p.set("responsavel_id", deferredResp.trim());
      if (eventTypeSlug) p.set("event_type", eventTypeSlug);
      if (!includeDone) p.set("include_done", "false");
      if (includeCancelled) p.set("include_cancelled", "true");
      const url = `/api/schedule/events?${p.toString()}`;
      agendaFetchDebug("fetch start", { fetchKey: fetchKey.slice(0, 120), reason });
      const r = await fetch(url, { signal });
      if (!r.ok) throw new Error(await readScheduleApiError(r));
      const j = (await r.json()) as { events: ScheduleEventDto[] };
      const dt = typeof performance !== "undefined" ? performance.now() - t0 : 0;
      agendaFetchDebug("fetch end", { ms: Math.round(dt), reason, count: j.events.length });
      return j.events;
    },
    [deferredCaso, deferredResp, eventTypeSlug, includeDone, includeCancelled],
  );

  useEffect(() => {
    /** Metadados (casos, utilizadores, …) e eventos arrancam em paralelo: mesmo tick, sem await cruzado. */
    void loadMeta().catch((e) => setErr(e instanceof Error ? e.message : String(e)));

    const bundle = rangeBundleRef.current;
    const { fetchKey } = bundle;
    const cache = eventsCacheRef.current;
    const now = Date.now();
    const cached = cache.get(fetchKey);

    if (cached && cached.expiresAt > now) {
      setEvents(cached.events);
      setInitialFetchDone(true);
      agendaFetchDebug("cache hit", { fetchKey: fetchKey.slice(0, 120) });
      const stale = now - cached.fetchedAt > SCHEDULE_RANGE_CACHE_TTL_MS / 2;
      if (stale) {
        const bg = new AbortController();
        void (async () => {
          try {
            const list = await fetchEventsForBundle(bundle, bg.signal, "background");
            if (list && !bg.signal.aborted && rangeBundleRef.current.fetchKey === fetchKey) {
              writeCacheEntry(fetchKey, list);
              setEvents(list);
            }
          } catch {
            /* ignore background */
          }
        })();
      }
      return;
    }

    fetchAbortRef.current?.abort();
    const ac = new AbortController();
    fetchAbortRef.current = ac;

    void (async () => {
      try {
        const list = await fetchEventsForBundle(bundle, ac.signal, "primary");
        if (ac.signal.aborted || rangeBundleRef.current.fetchKey !== fetchKey) return;
        writeCacheEntry(fetchKey, list);
        setEvents(list);
        setErr(null);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        if (rangeBundleRef.current.fetchKey === fetchKey) {
          setErr(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!ac.signal.aborted && rangeBundleRef.current.fetchKey === fetchKey) {
          setInitialFetchDone(true);
        }
      }
    })();

    return () => {
      ac.abort();
    };
  }, [rangeBundle.fetchKey, fetchEventsForBundle, writeCacheEntry, loadMeta]);

  useEffect(() => {
    const runPrefetch = () => {
      const prefetch = (anchor: Date) => {
        const { from, to } = scheduleRangeForView(view, anchor);
        const key = buildScheduleFetchKey({
          from,
          to,
          casoId: deferredCaso,
          responsavelId: deferredResp,
          eventTypeSlug,
          includeDone,
          includeCancelled,
        });
        const hit = eventsCacheRef.current.get(key);
        if (hit && hit.expiresAt > Date.now()) return;
        const ac = new AbortController();
        void (async () => {
          try {
            const list = await fetchEventsForBundle({ from, to, fetchKey: key }, ac.signal, "prefetch");
            if (!list) return;
            writeCacheEntry(key, list);
            agendaFetchDebug("prefetch ok", { key: key.slice(0, 80) });
          } catch {
            /* ignore */
          }
        })();
      };
      try {
        if (view === "month") {
          const base = parseMonthStartDate(miniMonth);
          prefetch(startOfMonth(addMonths(base, -1)));
          prefetch(startOfMonth(addMonths(base, 1)));
        } else if (view === "week") {
          const mon = startOfWeek(focusDate, { weekStartsOn: 1 });
          prefetch(addDays(mon, -7));
          prefetch(addDays(mon, 7));
        } else if (view === "day") {
          prefetch(addDays(focusDate, -1));
          prefetch(addDays(focusDate, 1));
        }
      } catch {
        /* ignore */
      }
    };

    let idleId: ReturnType<typeof requestIdleCallback> | undefined;
    let timeoutId: number | undefined;
    if (typeof requestIdleCallback !== "undefined") {
      idleId = requestIdleCallback(runPrefetch, { timeout: 2500 });
    } else {
      timeoutId = window.setTimeout(runPrefetch, 600);
    }
    return () => {
      if (idleId !== undefined) cancelIdleCallback(idleId);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [rangeBundle.fetchKey, view, miniMonth, focusDate, deferredCaso, deferredResp, eventTypeSlug, includeDone, includeCancelled, fetchEventsForBundle, writeCacheEntry]);

  useEffect(() => {
    const ac = new AbortController();
    setUpcomingLoading(true);
    void (async () => {
      try {
        const from = new Date();
        const to = addDays(from, 365);
        const p = new URLSearchParams();
        p.set("from", from.toISOString());
        p.set("to", to.toISOString());
        p.set("status", "PENDING");
        if (deferredCaso.trim()) p.set("caso_id", deferredCaso.trim());
        if (deferredResp.trim()) p.set("responsavel_id", deferredResp.trim());
        if (eventTypeSlug) p.set("event_type", eventTypeSlug);
        const r = await fetch(`/api/schedule/events?${p.toString()}`, { signal: ac.signal });
        if (!r.ok) throw new Error(await readScheduleApiError(r));
        const j = (await r.json()) as { events: ScheduleEventDto[] };
        if (ac.signal.aborted) return;
        const next = [...j.events]
          .filter((e) => e.status === "PENDING" && eventDateTime(e).getTime() >= from.getTime())
          .sort((a, b) => eventDateTime(a).getTime() - eventDateTime(b).getTime())
          .slice(0, 5);
        setUpcomingEvents(next);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setUpcomingEvents([]);
      } finally {
        if (!ac.signal.aborted) setUpcomingLoading(false);
      }
    })();
    return () => ac.abort();
  }, [deferredCaso, deferredResp, eventTypeSlug, upcomingRefreshKey]);

  const visibleEvents = useMemo(
    () => (includeCancelled ? events : events.filter((e) => e.status !== "CANCELLED")),
    [events, includeCancelled],
  );

  const eventsByDate = useMemo(() => {
    const m = new Map<string, ScheduleEventDto[]>();
    for (const e of visibleEvents) {
      const list = m.get(e.date);
      if (list) list.push(e);
      else m.set(e.date, [e]);
    }
    for (const [, list] of m) {
      list.sort((a, b) => a.start.localeCompare(b.start));
    }
    return m;
  }, [visibleEvents]);

  const dayPanelEvents = useMemo(() => {
    const key = format(focusDate, "yyyy-MM-dd");
    return eventsByDate.get(key) ?? [];
  }, [eventsByDate, focusDate]);

  const { days: monthGridDays, anchor: monthAnchor } = useMemo(() => gridDaysForMonth(miniMonth), [miniMonth]);

  const weekDays = useMemo(() => weekDaysMondayStart(focusDate), [focusDate]);

  const overdueEvents = useMemo(() => {
    const now = Date.now();
    return visibleEvents.filter((e) => {
      if (e.status !== "PENDING") return false;
      return eventDateTime(e).getTime() < now;
    });
  }, [visibleEvents]);

  useEffect(() => {
    setSelectedEventId(null);
  }, [view]);

  const listSections = useMemo(() => {
    const now = new Date();
    const todayKey = calendarDateKeyInTimeZone(now, CALENDAR_DISPLAY_TIMEZONE);
    const td = parseDateKeyLocal(todayKey);
    if (!td) return buildAgendaListSections(visibleEvents, overdueEvents, todayKey, todayKey, todayKey);
    const tomorrowKey = calendarDateKeyInTimeZone(addDays(td, 1), CALENDAR_DISPLAY_TIMEZONE);
    const weekEndKey = calendarDateKeyInTimeZone(endOfWeek(td, { weekStartsOn: 1 }), CALENDAR_DISPLAY_TIMEZONE);
    return buildAgendaListSections(visibleEvents, overdueEvents, todayKey, tomorrowKey, weekEndKey);
  }, [visibleEvents, overdueEvents]);

  const selectedEvent = useMemo(
    () => visibleEvents.find((e) => e.id === selectedEventId) ?? null,
    [visibleEvents, selectedEventId],
  );

  function goToday() {
    startViewTransition(() => {
      const n = new Date();
      setCursorDate(n);
      setSelectedKey(dateKeyFromDate(n));
      setMiniMonth(format(n, "yyyy-MM"));
    });
  }

  function navPrev() {
    startViewTransition(() => {
      if (view === "month") {
        const base = parseMonthStartDate(miniMonth);
        const d = addMonths(base, -1);
        setCursorDate(d);
        setMiniMonth(format(d, "yyyy-MM"));
        return;
      }
      if (view === "week") {
        const mon = startOfWeek(focusDate, { weekStartsOn: 1 });
        const n = addDays(mon, -7);
        setSelectedKey(format(n, "yyyy-MM-dd"));
        setCursorDate(n);
        return;
      }
      if (view === "day") {
        const n = addDays(focusDate, -1);
        setSelectedKey(format(n, "yyyy-MM-dd"));
        setCursorDate(n);
        return;
      }
      const n = addDays(cursorDate, -7);
      setCursorDate(n);
      setSelectedKey(dateKeyFromDate(n));
    });
  }

  function navNext() {
    startViewTransition(() => {
      if (view === "month") {
        const base = parseMonthStartDate(miniMonth);
        const d = addMonths(base, 1);
        setCursorDate(d);
        setMiniMonth(format(d, "yyyy-MM"));
        return;
      }
      if (view === "week") {
        const mon = startOfWeek(focusDate, { weekStartsOn: 1 });
        const n = addDays(mon, 7);
        setSelectedKey(format(n, "yyyy-MM-dd"));
        setCursorDate(n);
        return;
      }
      if (view === "day") {
        const n = addDays(focusDate, 1);
        setSelectedKey(format(n, "yyyy-MM-dd"));
        setCursorDate(n);
        return;
      }
      const n = addDays(cursorDate, 7);
      setCursorDate(n);
      setSelectedKey(dateKeyFromDate(n));
    });
  }

  const openCreate = useCallback((
    dateKey: string,
    startHm?: string,
    preset?: { type?: ScheduleEventType; title?: string },
    extra?: { endHm?: string; allDay?: boolean },
  ) => {
    const allDay = extra?.allDay === true;
    const start = allDay ? "00:00" : (startHm ?? "09:00");
    const end = allDay ? "23:59" : (extra?.endHm ?? "10:00");
    setDialogEditingId(null);
    setDialogSession((s) => ({
      key: s.key + 1,
      seed: {
        title: preset?.title ?? "",
        type: preset?.type ?? "interno",
        date: dateKey,
        start,
        end,
        all_day: allDay,
        local: "",
        obs: "",
        caso_id: "",
        responsavel_id: "",
        processo_id: "",
        legal_process_id: "",
        document_id: "",
      },
    }));
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((e: ScheduleEventDto) => {
    setSelectedEventId(e.id);
    setDialogEditingId(e.id);
    setDialogSession((s) => ({
      key: s.key + 1,
      seed: {
        title: e.title,
        type: e.type,
        date: e.date,
        start: e.start,
        end: e.end ?? "",
        all_day: e.all_day,
        local: e.local ?? "",
        obs: e.obs ?? "",
        caso_id: e.caso_id ?? "",
        responsavel_id: e.responsavel_id ?? "",
        processo_id: e.processo_id ?? "",
        legal_process_id: e.legal_process_id ?? "",
        document_id: e.document_id ?? "",
      },
    }));
    setDialogOpen(true);
  }, []);

  const moveEventInMonth = (e: ScheduleEventDto, targetDateKey: string) => {
    void patchEventSchedule(e.id, {
      date: targetDateKey,
      start: e.all_day ? "00:00" : e.start,
      end: e.all_day ? "23:59" : (e.end ?? e.start),
      allDay: e.all_day,
    });
  };

  const onMonthCellPick = useCallback(
    (d: Date) => {
      startViewTransition(() => {
        const key = format(d, "yyyy-MM-dd");
        setSelectedKey(key);
        setMiniMonth(format(d, "yyyy-MM"));
      });
    },
    [startViewTransition],
  );

  const pickWeekDay = useCallback(
    (d: Date) => {
      startViewTransition(() => {
        setSelectedKey(format(d, "yyyy-MM-dd"));
      });
    },
    [startViewTransition],
  );

  async function patchEventStatus(id: string, status: "DONE" | "PENDING"): Promise<boolean> {
    setErr(null);
    try {
      const r = await fetch(`/api/schedule/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) {
        const msg = await readScheduleApiError(r);
        setErr(msg);
        return false;
      }
      const j = (await r.json()) as { event: ScheduleEventDto };
      const ev = j.event;
      setEvents((prev) => {
        const { from, to } = rangeBundleRef.current;
        const fetchKey = rangeBundleRef.current.fetchKey;
        let next: ScheduleEventDto[];
        if (status === "DONE" && !includeDone) next = removeEventFromList(prev, id);
        else if (!eventDtoInFetchedRange(ev, from, to)) next = removeEventFromList(prev, ev.id);
        else next = mergeEventIntoList(prev, ev);
        writeCacheEntry(fetchKey, next);
        return next;
      });
      bumpUpcomingRefresh();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  async function patchEventCancelled(id: string): Promise<boolean> {
    setErr(null);
    try {
      const r = await fetch(`/api/schedule/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (!r.ok) {
        const msg = await readScheduleApiError(r);
        setErr(msg);
        return false;
      }
      const j = (await r.json()) as { event: ScheduleEventDto };
      const ev = j.event;
      setEvents((prev) => {
        const fetchKey = rangeBundleRef.current.fetchKey;
        let next: ScheduleEventDto[];
        if (!includeCancelled) next = removeEventFromList(prev, id);
        else next = mergeEventIntoList(prev, ev);
        writeCacheEntry(fetchKey, next);
        return next;
      });
      bumpUpcomingRefresh();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  async function patchEventSchedule(id: string, args: { date: string; start: string; end: string; allDay?: boolean }): Promise<boolean> {
    setErr(null);
    try {
      const r = await fetch(`/api/schedule/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: args.date,
          start: args.start,
          end: args.end,
          all_day: args.allDay ?? false,
        }),
      });
      if (!r.ok) {
        const msg = await readScheduleApiError(r);
        setErr(msg);
        return false;
      }
      const j = (await r.json()) as { event: ScheduleEventDto };
      const ev = j.event;
      setEvents((prev) => {
        const { from, to } = rangeBundleRef.current;
        const fetchKey = rangeBundleRef.current.fetchKey;
        let next: ScheduleEventDto[];
        if (!eventDtoInFetchedRange(ev, from, to)) next = removeEventFromList(prev, ev.id);
        else next = mergeEventIntoList(prev, ev);
        writeCacheEntry(fetchKey, next);
        return next;
      });
      bumpUpcomingRefresh();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  async function createEventQuick(args: {
    title: string;
    date: string;
    start: string;
    end: string;
    all_day: boolean;
    type?: ScheduleEventType;
  }): Promise<boolean> {
    setErr(null);
    try {
      const r = await fetch("/api/schedule/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: args.title,
          type: args.type ?? "interno",
          date: args.date,
          start: args.start,
          end: args.end,
          all_day: args.all_day,
          local: null,
          obs: null,
          caso_id: null,
          responsavel_id: null,
          processo_id: null,
          legal_process_id: null,
          document_id: null,
        }),
      });
      if (!r.ok) {
        const msg = await readScheduleApiError(r);
        setErr(msg);
        return false;
      }
      const j = (await r.json()) as { event: ScheduleEventDto };
      const ev = j.event;
      setEvents((prev) => {
        const { from, to } = rangeBundleRef.current;
        const fetchKey = rangeBundleRef.current.fetchKey;
        const next = eventDtoInFetchedRange(ev, from, to) ? mergeEventIntoList(prev, ev) : prev;
        writeCacheEntry(fetchKey, next);
        return next;
      });
      bumpUpcomingRefresh();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  function dayMinutesFromPointer(clientY: number): number {
    const el = dayGridAreaRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const y = clamp(clientY - rect.top, 0, rect.height);
    const raw = (y / Math.max(rect.height, 1)) * 24 * 60;
    return snapMinutes15(raw);
  }

  function weekDragPoint(clientX: number, clientY: number): { dayIndex: number; minutes: number } | null {
    const el = weekGridAreaRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    if (relX < WEEK_TIME_COL_PX) return null;
    const daysW = rect.width - WEEK_TIME_COL_PX;
    if (daysW <= 1) return null;
    const dayW = daysW / 7;
    const idx = clamp(Math.floor((relX - WEEK_TIME_COL_PX) / dayW), 0, 6);
    const y = clamp(relY, 0, rect.height);
    const min = snapMinutes15((y / Math.max(rect.height, 1)) * 24 * 60);
    return { dayIndex: idx, minutes: min };
  }

  const topTitle = useMemo(() => {
    if (view === "month") return format(parseMonthStartDate(miniMonth), "MMMM yyyy", { locale: ptBR });
    if (view === "week") {
      const s = weekDays[0];
      const e = weekDays[6];
      if (!s || !e) return "";
      return `${format(s, "d MMM", { locale: ptBR })} – ${format(e, "d MMM yyyy", { locale: ptBR })}`;
    }
    if (view === "day") return format(focusDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR });
    return `Próximos 45 dias · ${format(cursorDate, "d MMM yyyy", { locale: ptBR })}`;
  }, [view, miniMonth, weekDays, cursorDate, focusDate]);

  const hours = useMemo(() => {
    const h: number[] = [];
    for (let i = GRID_START_H; i <= GRID_END_H; i++) h.push(i);
    return h;
  }, []);

  const timedGridHeight = hours.length * PX_PER_H;

  const agendaDayKey = format(focusDate, "yyyy-MM-dd");
  const dayTimedEvents = useMemo(
    () => visibleEvents.filter((e) => e.date === agendaDayKey && !e.all_day),
    [visibleEvents, agendaDayKey],
  );
  const dayTimelineEmpty = dayTimedEvents.length === 0;
  const dayDraft = useMemo(() => {
    if (!dayCreateDraft) return null;
    const a = Math.min(dayCreateDraft.startMin, dayCreateDraft.endMin);
    const b = Math.max(dayCreateDraft.startMin, dayCreateDraft.endMin);
    return { start: a, end: Math.max(a + 15, b) };
  }, [dayCreateDraft]);
  const weekDraft = useMemo(() => {
    if (!weekCreateDraft) return null;
    const dayA = Math.min(weekCreateDraft.startDay, weekCreateDraft.endDay);
    const dayB = Math.max(weekCreateDraft.startDay, weekCreateDraft.endDay);
    const minA = Math.min(weekCreateDraft.startMin, weekCreateDraft.endMin);
    const minB = Math.max(weekCreateDraft.startMin, weekCreateDraft.endMin);
    return { dayA, dayB, start: minA, end: Math.max(minA + 15, minB) };
  }, [weekCreateDraft]);

  const dayTimelineMeasureRef = useRef<HTMLDivElement>(null);
  const dayGridAreaRef = useRef<HTMLDivElement>(null);
  const weekGridAreaRef = useRef<HTMLDivElement>(null);
  const [daySlotPx, setDaySlotPx] = useState(PX_PER_H);

  useLayoutEffect(() => {
    if (view !== "day") return;
    const el = dayTimelineMeasureRef.current;
    if (!el) return;
    const measure = () => {
      const ch = el.clientHeight;
      if (ch < 48) return;
      setDaySlotPx(Math.max(26, Math.floor(ch / hours.length)));
    };
    measure();
    const t = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(t);
      ro.disconnect();
    };
  }, [view, agendaDayKey, hours.length]);

  return (
    <div className="lex-agenda-root flex h-[calc(100svh-var(--app-header-h))] min-h-0 w-full min-w-0 flex-col overflow-hidden bg-transparent text-[color:var(--text-primary)]">
      <LexPageFrame
        bleed
        leftRail={(
          <>
        {/* Coluna 1: rail — em lg+ mesmo trilho `1fr` que a coluna 3 (simétrico ao header). */}
        <aside className="flex min-h-0 min-w-0 w-full flex-col gap-3 overflow-y-auto overflow-x-auto p-3">
          <Button type="button" className="w-full shrink-0" onClick={() => openCreate(agendaDayKey)}>
            Novo compromisso
          </Button>
          {/* Mini mês */}
          <div className="w-full min-w-0 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-2">
            <div className="mb-1.5 flex items-center justify-between gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={() =>
                  startViewTransition(() => setMiniMonth(format(addMonths(parseMonthStartDate(miniMonth), -1), "yyyy-MM")))
                }
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="min-w-0 flex-1 truncate px-0.5 text-center text-xs font-semibold capitalize sm:text-sm">
                {format(parseMonthStartDate(miniMonth), "MMMM yyyy", { locale: ptBR })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={() =>
                  startViewTransition(() => setMiniMonth(format(addMonths(parseMonthStartDate(miniMonth), 1), "yyyy-MM")))
                }
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-px text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
              {MONTH_WEEK_HDR.map((w) => (
                <span key={w} className="py-0.5">
                  {w.slice(0, 3)}
                </span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-px sm:gap-0.5">
              {monthGridDays.map((d) => {
                const key = format(d, "yyyy-MM-dd");
                const inM = isSameMonth(d, monthAnchor);
                const sel = key === selectedKey;
                const td = isToday(d);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onMonthCellPick(d)}
                    className={cn(
                      "flex aspect-square w-full min-w-0 max-w-full items-center justify-center rounded-md text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-0 sm:rounded-lg sm:text-sm",
                      !inM && "text-muted-foreground/65 hover:bg-[color:var(--surface-elevated)]/70",
                      inM && !sel && !td && "text-[color:var(--text-primary)] hover:bg-[color:var(--surface-elevated)]",
                      td && !sel && "bg-violet-500/14 text-violet-800 ring-1 ring-violet-400/35 dark:bg-violet-500/20 dark:text-violet-100 dark:ring-violet-400/25",
                      sel && !td && "bg-violet-600 text-white shadow-sm ring-2 ring-violet-500/50 hover:bg-violet-600",
                      sel && td && "bg-violet-600 text-white shadow-sm ring-2 ring-violet-200/90 hover:bg-violet-600 dark:ring-violet-300/50",
                    )}
                  >
                    {format(d, "d")}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-micro font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {view === "list" || view === "week" ? "Dia em foco" : "Compromisso do dia"}
            </h3>
            <ul className="mt-2 space-y-2">
              {!initialFetchDone ? (
                <li className="rounded-lg border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)]/40 p-3 text-sm text-muted-foreground">
                  atualizando
                </li>
              ) : dayPanelEvents.length === 0 ? (
                <li className="rounded-lg border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)]/40 p-3 text-sm text-muted-foreground">
                  <p>Nenhum compromisso em {format(focusDate, "d MMM", { locale: ptBR })}.</p>
                  <p className="mt-2 text-xs font-medium text-[color:var(--text-primary)]">Ações úteis</p>
                  <ul className="mt-1 space-y-1.5 text-xs">
                    <li>
                      <button type="button" className="text-violet-600 underline" onClick={() => openCreate(agendaDayKey)}>
                        Novo compromisso
                      </button>
                    </li>
                    <li>
                      <Link href="/cases" className="text-violet-600 underline">
                        Casos e próximas ações
                      </Link>
                    </li>
                    <li>
                      <Link href="/publicacoes" className="text-violet-600 underline">
                        Comunicações para revisar
                      </Link>
                    </li>
                    <li>
                      <Link href="/processos" className="text-violet-600 underline">
                        Processos monitorados
                      </Link>
                    </li>
                  </ul>
                </li>
              ) : (
                dayPanelEvents.map((e) => (
                  <li key={e.id} className={cn("rounded-lg border border-[color:var(--border-subtle)] p-2 text-sm", TYPE_STYLE[e.type].chip)}>
                    <LexAgendaEventRow
                      e={e}
                      onDone={() => void patchEventStatus(e.id, "DONE")}
                      onCancel={() => void patchEventCancelled(e.id)}
                      onEdit={() => openEdit(e)}
                      layout="day-focus"
                    />
                    {scheduleNeedsPortalDisclaimer(e) ? (
                      <p className="mt-2 border-t border-[color:var(--border-subtle)] pt-2 text-[10px] leading-snug text-muted-foreground">{SCHEDULE_PORTAL_DISCLAIMER}</p>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </div>

          <div>
            <h3 className="text-micro font-semibold uppercase tracking-[0.14em] text-muted-foreground">Próximos</h3>
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
              {upcomingLoading ? <li>atualizando</li> : null}
              {!upcomingLoading && upcomingEvents.length === 0 ? <li>Nada pendente à frente.</li> : null}
              {upcomingEvents.map((e) => (
                <li key={e.id} className="group relative flex gap-1.5 truncate rounded-md border border-transparent px-1 py-0.5 hover:border-[color:var(--border-subtle)]">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="absolute right-0.5 top-0.5 z-10 size-5 rounded-sm opacity-0 transition-opacity hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      void patchEventCancelled(e.id);
                    }}
                    aria-label="Cancelar compromisso"
                  >
                    <X className="size-3" />
                  </Button>
                  <TypeIcon kind={TYPE_STYLE[e.type].icon} />
                  <span className="shrink-0 tabular-nums text-muted-foreground">{e.date}</span>
                  <span className="min-w-0 truncate pr-5 text-[color:var(--text-primary)]">{e.title}</span>
                </li>
              ))}
            </ul>
          </div>

          {err ? <p className="text-xs text-rose-500">{err}</p> : null}
        </aside>

          </>
        )}
        rightRail={(
          <>
        <aside className="flex min-h-0 min-w-0 w-full flex-col gap-3 overflow-y-auto overflow-x-auto p-3">
          <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]/70 p-2 shadow-sm sm:p-3">
            <p className="mb-3 text-micro font-semibold uppercase tracking-[0.14em] text-muted-foreground">Filtros</p>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="lex-caso" className="text-xs font-medium text-[color:var(--text-primary)]">
                  Caso
                </Label>
                <select
                  id="lex-caso"
                  className="flex h-10 w-full cursor-pointer rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)] px-3 text-sm text-[color:var(--text-primary)] shadow-sm transition-colors hover:bg-[color:var(--surface-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/45 focus-visible:ring-offset-0"
                  value={casoId}
                  onChange={(e) => setCasoId(e.target.value)}
                >
                  <option value="">Todos</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lex-resp" className="text-xs font-medium text-[color:var(--text-primary)]">
                  Responsável
                </Label>
                <select
                  id="lex-resp"
                  className="flex h-10 w-full cursor-pointer rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)] px-3 text-sm text-[color:var(--text-primary)] shadow-sm transition-colors hover:bg-[color:var(--surface-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/45 focus-visible:ring-offset-0"
                  value={responsavelId}
                  onChange={(e) => setResponsavelId(e.target.value)}
                >
                  <option value="">Toda a equipe</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name?.trim() || u.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-2 text-micro font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tipo</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEventTypeSlug("")}
                    className={cn(
                      "min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium leading-tight transition-colors",
                      !eventTypeSlug ? "border-violet-500 bg-violet-500/15 text-[color:var(--text-primary)]" : "border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)] text-muted-foreground hover:border-violet-500/40",
                    )}
                  >
                    Todos
                  </button>
                  {SCHEDULE_EVENT_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEventTypeSlug(t)}
                      className={cn(
                        "min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium leading-tight transition-colors",
                        eventTypeSlug === t
                          ? "border-violet-500 bg-violet-500/15 text-[color:var(--text-primary)]"
                          : "border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)] text-muted-foreground hover:border-violet-500/40",
                      )}
                    >
                      {SCHEDULE_TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 border-t border-[color:var(--border-subtle)]/80 pt-3">
                <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-0.5 py-1 text-xs text-[color:var(--text-primary)] hover:bg-[color:var(--surface-elevated)]/50">
                  <input type="checkbox" checked={includeDone} onChange={(e) => setIncludeDone(e.target.checked)} className="size-4 rounded border-input text-violet-600 focus:ring-violet-500/40" />
                  Mostrar concluídos
                </label>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-0.5 py-1 text-xs text-[color:var(--text-primary)] hover:bg-[color:var(--surface-elevated)]/50">
                  <input type="checkbox" checked={includeCancelled} onChange={(e) => setIncludeCancelled(e.target.checked)} className="size-4 rounded border-input text-violet-600 focus:ring-violet-500/40" />
                  Mostrar cancelados
                </label>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setCasoId("");
                  setResponsavelId("");
                  setEventTypeSlug("");
                  setIncludeCancelled(false);
                }}
              >
                Limpar filtros
              </Button>
            </div>
          </div>

          {selectedEvent ? (
            <div className="max-h-[min(52vh,28rem)] overflow-y-auto rounded-xl border border-violet-500/30 bg-violet-500/8 p-3 text-sm shadow-sm">
              <p className="text-micro font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-100">Evento selecionado</p>
              <p className="mt-1 text-base font-semibold leading-snug">{selectedEvent.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {SCHEDULE_TYPE_LABEL[selectedEvent.type]}
                {selectedEvent.all_day ? " · Dia inteiro" : ` · ${selectedEvent.start}${selectedEvent.end ? `–${selectedEvent.end}` : ""}`}
              </p>
              {selectedEvent.local ? <p className="mt-1 text-xs">Local: {selectedEvent.local}</p> : null}
              {selectedEvent.caso_title ? <p className="mt-1 text-xs text-muted-foreground">Caso: {selectedEvent.caso_title}</p> : null}
              {selectedEvent.process_label ? <p className="mt-1 text-xs text-muted-foreground">{selectedEvent.process_label}</p> : null}
              {selectedEvent.cnj ? <p className="mt-1 font-mono text-xs text-muted-foreground">{selectedEvent.cnj}</p> : null}
              {selectedEvent.obs ? <p className="mt-2 line-clamp-4 text-xs text-muted-foreground">{selectedEvent.obs}</p> : null}
              {scheduleNeedsPortalDisclaimer(selectedEvent) ? (
                <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] leading-snug text-amber-950 dark:text-amber-50">{SCHEDULE_PORTAL_DISCLAIMER}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => openEdit(selectedEvent)}>
                  Editar
                </Button>
                {selectedEvent.status === "PENDING" ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => void patchEventStatus(selectedEvent.id, "DONE")}>
                    Concluir
                  </Button>
                ) : null}
                {selectedEvent.status === "PENDING" ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => void patchEventCancelled(selectedEvent.id)}>
                    Cancelar
                  </Button>
                ) : null}
                {selectedEvent.caso_id ? (
                  <Button type="button" size="sm" variant="ghost" asChild>
                    <Link href={`/cases/${selectedEvent.caso_id}`}>Abrir caso</Link>
                  </Button>
                ) : null}
                {selectedEvent.legal_process_id ? (
                  <Button type="button" size="sm" variant="ghost" asChild>
                    <Link href={`/processos/${selectedEvent.legal_process_id}`}>Processo judicial</Link>
                  </Button>
                ) : null}
                {selectedEvent.processo_id ? (
                  <Button type="button" size="sm" variant="ghost" asChild>
                    <Link href={`/processos/${selectedEvent.processo_id}`}>Abrir processo</Link>
                  </Button>
                ) : null}
                {selectedEvent.document_id ? (
                  <Button type="button" size="sm" variant="ghost" asChild>
                    <Link href={`/biblioteca/documentos/${selectedEvent.document_id}`}>Abrir documento</Link>
                  </Button>
                ) : null}
                {selectedEvent.caso_id ? (
                  <Button type="button" size="sm" variant="ghost" asChild>
                    <Link href={`/cases/${selectedEvent.caso_id}/documentos`}>Documentos do caso</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {overdueEvents.length > 0 ? (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-rose-600">Atrasados ({overdueEvents.length})</h3>
              <p className="mt-1 text-[10px] text-muted-foreground">Pendentes com data/hora já passadas. Concluídos não entram aqui.</p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
                {overdueEvents.slice(0, 10).map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      className="w-full rounded-md border border-rose-500/25 bg-rose-500/5 px-2 py-1.5 text-left transition-colors hover:bg-rose-500/10"
                      onClick={() => {
                        startViewTransition(() => {
                          const d = parseDateKeyLocal(e.date);
                          setSelectedKey(e.date);
                          if (d) setCursorDate(d);
                          setMiniMonth(e.date.slice(0, 7));
                          setView("day");
                        });
                      }}
                    >
                      <span className="tabular-nums text-muted-foreground">{e.date}</span>
                      <span className="mx-1 text-muted-foreground">·</span>
                      <span className="font-medium text-[color:var(--text-primary)]">{e.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
          </>
        )}
      >
        {/* Centro: barra + vistas — largura = var(--lex-app-central-well-max), alinhada à busca / poço. */}
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 bg-[color:var(--surface-card)]/50 py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <Button type="button" variant="outline" size="sm" onClick={goToday}>
                Hoje
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-8" onClick={navPrev} aria-label="Anterior">
                <ChevronLeft className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="size-8" onClick={navNext} aria-label="Próximo período">
                <ChevronRight className="size-4" />
              </Button>
              <span className="min-w-0 truncate px-1 text-sm font-semibold capitalize md:text-base">{topTitle}</span>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <div className="flex rounded-lg border border-[color:var(--border-subtle)] p-0.5">
                {(
                  [
                    ["day", "Dia"],
                    ["week", "Semana"],
                    ["month", "Mês"],
                    ["list", "Lista"],
                  ] as const
                ).map(([k, lab]) => (
                  <Button
                    key={k}
                    type="button"
                    size="sm"
                    variant={view === k ? "secondary" : "ghost"}
                    className="h-8 w-28 min-w-28 max-w-28 shrink-0 px-2 text-xs md:px-3"
                    onClick={() => {
                      startViewTransition(() => {
                        if (k === "month") setMiniMonth(monthKeyFromDate(cursorDate));
                        setView(k);
                      });
                    }}
                  >
                    {lab}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {view === "month" ? (
              <LexAgendaMonthGrid
                monthGridDays={monthGridDays}
                monthAnchor={monthAnchor}
                eventsByDate={eventsByDate}
                selectedKey={selectedKey}
                initialFetchDone={initialFetchDone}
                visibleEventsLength={visibleEvents.length}
                agendaDayKey={agendaDayKey}
                onMonthCellPick={onMonthCellPick}
                openCreate={openCreate}
                openEdit={openEdit}
                onMoveEvent={moveEventInMonth}
              />
            ) : null}

            {view === "week" ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-auto py-2">
                <div className="w-full min-w-0 flex-1 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] shadow-sm">
                  <div className="grid border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)]/40" style={{ gridTemplateColumns: `${WEEK_TIME_COL_PX}px repeat(7, minmax(0, 1fr))` }}>
                    <div />
                    {weekDays.map((d) => {
                      const dk = format(d, "yyyy-MM-dd");
                      const sel = dk === selectedKey;
                      const td = isToday(d);
                      return (
                        <button
                          key={dk}
                          type="button"
                          className={cn(
                            "border-l border-[color:var(--border-subtle)] px-1 py-2 text-center transition-colors hover:bg-[color:var(--surface-elevated)]",
                            sel && "bg-violet-500/18 ring-1 ring-inset ring-violet-500/40",
                            td && !sel && "bg-violet-500/10 dark:bg-violet-500/12",
                          )}
                          onClick={() => pickWeekDay(d)}
                        >
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{format(d, "EEE", { locale: ptBR })}</div>
                          <div className={cn("text-sm font-semibold tabular-nums", td && !sel && "text-violet-800 dark:text-violet-100", sel && "text-violet-900 dark:text-violet-50")}>{format(d, "d")}</div>
                        </button>
                      );
                    })}
                  </div>
                  <div
                    ref={weekGridAreaRef}
                    className="relative grid"
                    style={{ gridTemplateColumns: `${WEEK_TIME_COL_PX}px repeat(7, minmax(0, 1fr))`, minHeight: timedGridHeight }}
                    onPointerMove={(ev) => {
                      if (!weekCreateDraft || ev.buttons !== 1) return;
                      const p = weekDragPoint(ev.clientX, ev.clientY);
                      if (!p) return;
                      setWeekCreateDraft((prev) => (prev ? { ...prev, endDay: p.dayIndex, endMin: Math.max(15, p.minutes + 15) } : prev));
                    }}
                    onPointerUp={() => {
                      if (!weekDraft) return;
                      const dayCount = weekDraft.dayB - weekDraft.dayA + 1;
                      const fullDay = weekDraft.start === 0 && weekDraft.end >= 23 * 60 + 45;
                      if (dayCount === 1) {
                        const base = weekDays[weekDraft.dayA];
                        if (base) {
                          const dateKey = format(base, "yyyy-MM-dd");
                          openCreate(
                            dateKey,
                            minutesToHm(weekDraft.start),
                            undefined,
                            {
                              endHm: minutesToHm(weekDraft.end),
                              allDay: fullDay,
                            },
                          );
                        }
                        setWeekCreateDraft(null);
                        return;
                      }
                      const suggestedTitle =
                        fullDay
                          ? dayCount >= 7
                            ? "Prazo sugerido: 1 semana"
                            : `Prazo sugerido: ${dayCount} dias`
                          : "Compromisso";
                      const dates: string[] = [];
                      for (let i = weekDraft.dayA; i <= weekDraft.dayB; i++) {
                        const d = weekDays[i];
                        if (d) dates.push(format(d, "yyyy-MM-dd"));
                      }
                      setWeekCreateDraft(null);
                      void (async () => {
                        for (const dateKey of dates) {
                          // Cria um compromisso por dia, mantendo a mesma faixa horária.
                          // A API atual ainda não suporta um único payload com duração multi-dia.
                          await createEventQuick({
                            title: suggestedTitle,
                            date: dateKey,
                            start: fullDay ? "00:00" : minutesToHm(weekDraft.start),
                            end: fullDay ? "23:59" : minutesToHm(weekDraft.end),
                            all_day: fullDay,
                          });
                        }
                      })();
                    }}
                  >
                    <div className="border-r border-[color:var(--border-subtle)] text-[11px] font-medium text-muted-foreground">
                      {hours.map((h) => (
                        <div key={h} style={{ height: PX_PER_H }} className="pr-2 pt-0 text-right tabular-nums">
                          {String(h).padStart(2, "0")}:00
                        </div>
                      ))}
                    </div>
                    {weekDays.map((d) => {
                      const dk = format(d, "yyyy-MM-dd");
                      const dayEvents = visibleEvents.filter((e) => e.date === dk && !e.all_day);
                      return (
                        <div
                          key={dk}
                          className="relative border-l border-[color:var(--border-subtle)]"
                          onPointerDown={(ev) => {
                            if (ev.button !== 0) return;
                            const p = weekDragPoint(ev.clientX, ev.clientY);
                            if (!p) return;
                            setWeekCreateDraft({
                              startDay: p.dayIndex,
                              endDay: p.dayIndex,
                              startMin: p.minutes,
                              endMin: Math.max(15, p.minutes + 15),
                            });
                          }}
                          onDragOver={(ev) => ev.preventDefault()}
                          onDrop={(ev) => {
                            ev.preventDefault();
                            const payloadRaw = ev.dataTransfer.getData("application/x-lex-schedule-move");
                            if (!payloadRaw) return;
                            try {
                              const payload = JSON.parse(payloadRaw) as { id: string; durationMin: number };
                              const p = weekDragPoint(ev.clientX, ev.clientY);
                              if (!p) return;
                              const startMin = snapMinutes15(p.minutes);
                              const endMin = Math.min(startMin + Math.max(payload.durationMin, 15), 23 * 60 + 59);
                              const targetDate = weekDays[p.dayIndex];
                              if (!targetDate) return;
                              void patchEventSchedule(payload.id, {
                                date: format(targetDate, "yyyy-MM-dd"),
                                start: minutesToHm(startMin),
                                end: minutesToHm(endMin),
                              });
                            } catch {
                              /* ignore malformed payload */
                            }
                          }}
                        >
                          {hours.map((h) => (
                            <div
                              key={h}
                              className={cn(
                                "absolute left-0 right-0",
                                LEX_AGENDA_GRID_LINE_H_SOFT,
                              )}
                              style={{ top: (h - GRID_START_H) * PX_PER_H, height: PX_PER_H }}
                            />
                          ))}
                          {weekDraft && weekDays[weekDraft.dayA] && weekDays[weekDraft.dayB] ? (
                            (() => {
                              const thisIdx = weekDays.findIndex((x) => format(x, "yyyy-MM-dd") === dk);
                              if (thisIdx < weekDraft.dayA || thisIdx > weekDraft.dayB) return null;
                              const top = (weekDraft.start / 60 - GRID_START_H) * PX_PER_H;
                              const height = Math.max(((weekDraft.end - weekDraft.start) / 60) * PX_PER_H, 10);
                              return (
                                <div
                                  className="pointer-events-none absolute left-0.5 right-0.5 rounded-md border border-violet-500/55 bg-violet-500/18"
                                  style={{ top, height }}
                                />
                              );
                            })()
                          ) : null}
                          {dayEvents.map((e) => {
                            const sp = e.start.split(":").map(Number);
                            const ep = (e.end ?? e.start).split(":").map(Number);
                            const hh = sp[0] ?? 0;
                            const mm = sp[1] ?? 0;
                            const eh = ep[0] ?? hh;
                            const em = ep[1] ?? mm;
                            const top = ((hh ?? 0) - GRID_START_H + (mm ?? 0) / 60) * PX_PER_H;
                            const hEnd = (eh ?? hh ?? 0) + (em ?? 0) / 60;
                            const hStart = (hh ?? 0) + (mm ?? 0) / 60;
                            const height = Math.max((hEnd - hStart) * PX_PER_H, 22);
                            return (
                              <div
                                key={e.id}
                                role="button"
                                tabIndex={0}
                                style={{ top, height }}
                                draggable
                                className={cn(
                                  "absolute left-0.5 right-0.5 cursor-pointer overflow-hidden rounded-md border px-1 py-0.5 text-left text-[10px] shadow-sm ring-1 ring-transparent hover:ring-violet-500/30",
                                  TYPE_STYLE[e.type].chip,
                                  e.status === "DONE" && "opacity-50 line-through",
                                  e.status === "CANCELLED" && "opacity-45 grayscale",
                                )}
                                onDragStart={(ev) => {
                                  const startMin = hmToMinutes(e.start);
                                  const endMin = hmToMinutes(e.end ?? e.start);
                                  const durationMin = Math.max(15, endMin - startMin);
                                  ev.dataTransfer.setData("application/x-lex-schedule-move", JSON.stringify({ id: e.id, durationMin }));
                                }}
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setSelectedKey(dk);
                                  openEdit(e);
                                }}
                                onKeyDown={(ev) => {
                                  if (ev.key === "Enter" || ev.key === " ") {
                                    ev.preventDefault();
                                    setSelectedKey(dk);
                                    openEdit(e);
                                  }
                                }}
                              >
                                <span className="font-semibold tabular-nums">{e.start}</span> {e.title}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {view === "day" ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden py-2">
                <div className="flex min-h-0 w-full min-w-0 max-w-none flex-1 flex-col overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] shadow-sm">
                  <div className="border-b border-[color:var(--border-subtle)] px-3 py-2.5">
                    <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground">Dia</p>
                    <p className="text-base font-semibold capitalize leading-tight">{format(focusDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR })}</p>
                    <button
                      type="button"
                      className="mt-2 inline-flex rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)] px-2 py-1 text-xs font-medium text-muted-foreground hover:text-[color:var(--text-primary)]"
                      onClick={() => openCreate(agendaDayKey, "00:00", { title: "Dia todo" }, { endHm: "23:59", allDay: true })}
                    >
                      Dia todo
                    </button>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
                    <div
                      ref={dayTimelineMeasureRef}
                      className="relative min-h-0 flex-1 overflow-hidden border-b border-[color:var(--border-subtle)] lg:border-b-0 lg:border-r"
                    >
                      <div className="relative min-h-0 w-full" style={{ height: hours.length * daySlotPx }}>
                        <div className="absolute inset-y-0 left-0 w-14 border-r border-[color:var(--border-subtle)] text-[11px] font-medium text-muted-foreground">
                          {hours.map((h) => (
                            <div key={h} style={{ height: daySlotPx }} className="pr-2 pt-0 text-right tabular-nums">
                              {String(h).padStart(2, "0")}:00
                            </div>
                          ))}
                        </div>
                        <div
                          ref={dayGridAreaRef}
                          className="absolute inset-y-0 left-14 right-0"
                          onPointerDown={(ev) => {
                            if (ev.button !== 0) return;
                            const start = dayMinutesFromPointer(ev.clientY);
                            setDayCreateDraft({ startMin: start, endMin: Math.max(15, start + 15) });
                          }}
                          onPointerMove={(ev) => {
                            if (!dayCreateDraft || ev.buttons !== 1) return;
                            const cur = dayMinutesFromPointer(ev.clientY);
                            setDayCreateDraft((prev) => (prev ? { ...prev, endMin: Math.max(15, cur + 15) } : prev));
                          }}
                          onPointerUp={() => {
                            if (!dayDraft) return;
                            const fullDay = dayDraft.start === 0 && dayDraft.end >= 23 * 60 + 45;
                            openCreate(
                              agendaDayKey,
                              minutesToHm(dayDraft.start),
                              fullDay ? { title: "Dia todo" } : undefined,
                              { endHm: minutesToHm(dayDraft.end), allDay: fullDay },
                            );
                            setDayCreateDraft(null);
                          }}
                          onDragOver={(ev) => ev.preventDefault()}
                          onDrop={(ev) => {
                            ev.preventDefault();
                            const payloadRaw = ev.dataTransfer.getData("application/x-lex-schedule-move");
                            if (!payloadRaw) return;
                            try {
                              const payload = JSON.parse(payloadRaw) as { id: string; durationMin: number };
                              const startMin = snapMinutes15(dayMinutesFromPointer(ev.clientY));
                              const endMin = Math.min(startMin + Math.max(payload.durationMin, 15), 23 * 60 + 59);
                              void patchEventSchedule(payload.id, {
                                date: agendaDayKey,
                                start: minutesToHm(startMin),
                                end: minutesToHm(endMin),
                              });
                            } catch {
                              /* ignore malformed payload */
                            }
                          }}
                        >
                          {hours.map((h) => (
                            <div
                              key={h}
                              className="absolute left-0 right-0 border-b border-zinc-400/35 dark:border-zinc-500/40"
                              style={{ top: (h - GRID_START_H) * daySlotPx, height: daySlotPx }}
                            />
                          ))}
                          {dayDraft ? (
                            <div
                              className="pointer-events-none absolute left-1 right-2 rounded-lg border border-violet-500/55 bg-violet-500/18"
                              style={{
                                top: (dayDraft.start / 60 - GRID_START_H) * daySlotPx,
                                height: Math.max(((dayDraft.end - dayDraft.start) / 60) * daySlotPx, 10),
                              }}
                            />
                          ) : null}
                          {dayTimedEvents.map((e) => {
                            const sp = e.start.split(":").map(Number);
                            const ep = (e.end ?? e.start).split(":").map(Number);
                            const hh = sp[0] ?? 0;
                            const mm = sp[1] ?? 0;
                            const eh = ep[0] ?? hh;
                            const em = ep[1] ?? mm;
                            const top = ((hh ?? 0) - GRID_START_H + (mm ?? 0) / 60) * daySlotPx;
                            const hEnd = (eh ?? hh ?? 0) + (em ?? 0) / 60;
                            const hStart = (hh ?? 0) + (mm ?? 0) / 60;
                            const height = Math.max((hEnd - hStart) * daySlotPx, 28);
                            return (
                              <button
                                key={e.id}
                                type="button"
                                style={{ top, height }}
                                draggable
                                className={cn(
                                  "absolute left-1 right-2 overflow-hidden rounded-lg border px-2 py-1 text-left text-xs shadow-sm ring-1 ring-transparent hover:ring-violet-500/25",
                                  TYPE_STYLE[e.type].chip,
                                  e.status === "DONE" && "line-through opacity-55",
                                  e.status === "CANCELLED" && "opacity-45 grayscale",
                                )}
                                onDragStart={(ev) => {
                                  const startMin = hmToMinutes(e.start);
                                  const endMin = hmToMinutes(e.end ?? e.start);
                                  const durationMin = Math.max(15, endMin - startMin);
                                  ev.dataTransfer.setData("application/x-lex-schedule-move", JSON.stringify({ id: e.id, durationMin }));
                                }}
                                onClick={() => openEdit(e)}
                              >
                                <div className="font-semibold tabular-nums">
                                  {e.start}
                                  {e.end ? `–${e.end}` : ""}
                                </div>
                                <div className="truncate font-medium">{e.title}</div>
                                {e.caso_title ? <div className="truncate text-[11px] text-muted-foreground">{e.caso_title}</div> : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    {initialFetchDone && dayTimelineEmpty ? (
                      <div className="flex w-full shrink-0 flex-col justify-center gap-3 border-t border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)]/25 p-4 lg:max-w-sm lg:border-l lg:border-t-0">
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--text-primary)]">Nenhum compromisso com horário</p>
                          <p className="mt-1 text-xs text-muted-foreground">A grelha à esquerda cria por slot. Use as ações para tipos comuns.</p>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button type="button" size="sm" className="w-full justify-start" onClick={() => openCreate(agendaDayKey)}>
                            Novo compromisso
                          </Button>
                          <Button type="button" size="sm" variant="secondary" className="w-full justify-start" onClick={() => openCreate(agendaDayKey, "09:00", { type: "intimacao" })}>
                            Criar revisão de comunicação
                          </Button>
                          <Button type="button" size="sm" variant="secondary" className="w-full justify-start" onClick={() => openCreate(agendaDayKey, "10:00", { type: "followup" })}>
                            Criar follow-up
                          </Button>
                          <Button type="button" size="sm" variant="secondary" className="w-full justify-start" asChild>
                            <Link href="/cases">Casos sem próxima ação</Link>
                          </Button>
                          <Button type="button" size="sm" variant="secondary" className="w-full justify-start" asChild>
                            <Link href="/publicacoes">Comunicações para revisar</Link>
                          </Button>
                          <Button type="button" size="sm" variant="secondary" className="w-full justify-start" asChild>
                            <Link href="/processos">Processos monitorados</Link>
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            {view === "list" ? (
              <div className="flex min-h-[min(55vh,520px)] flex-col gap-5 py-5">
                {listSections.map((sec) => (
                  <section key={sec.id}>
                    <div className="flex items-baseline justify-between gap-2 border-b border-[color:var(--border-subtle)] pb-1">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{sec.label}</h3>
                      <span className="text-[10px] font-medium text-muted-foreground">{sec.events.length}</span>
                    </div>
                    <ul className="mt-2 space-y-2">
                      {sec.events.map((e) => (
                        <li
                          key={e.id}
                          className={cn(
                            "flex gap-3 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-3 text-sm shadow-sm",
                            TYPE_STYLE[e.type].chip,
                          )}
                        >
                          <div className="flex shrink-0 flex-col items-center pt-0.5">
                            <span className="flex size-5 items-center justify-center rounded border border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)]" aria-hidden>
                              {e.status === "DONE" ? <Check className="size-3.5 text-emerald-600" /> : null}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <LexAgendaEventRow
                              e={e}
                              onDone={() => void patchEventStatus(e.id, "DONE")}
                              onCancel={() => void patchEventCancelled(e.id)}
                              onEdit={() => openEdit(e)}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                {initialFetchDone && visibleEvents.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)]/35 px-4 py-10 text-center">
                    <p className="text-base font-semibold text-[color:var(--text-primary)]">Nenhum compromisso neste período</p>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">
                      Ajuste os filtros ou crie compromissos ligados a casos, processos e revisões oficiais.
                    </p>
                    <div className="mt-6 flex w-full max-w-xs flex-col gap-2">
                      <Button type="button" onClick={() => openCreate(agendaDayKey)}>
                        Novo compromisso
                      </Button>
                      <Button type="button" variant="secondary" asChild>
                        <Link href="/cases">Casos sem próxima ação</Link>
                      </Button>
                      <Button type="button" variant="secondary" asChild>
                        <Link href="/publicacoes">Comunicações para revisar</Link>
                      </Button>
                      <Button type="button" variant="secondary" asChild>
                        <Link href="/processos">Processos monitorados</Link>
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </LexPageFrame>

      <LexAgendaEventDialog
        mode={dialogEditingId ? "edit" : "create"}
        open={dialogOpen}
        sessionKey={dialogSession.key}
        seed={dialogSession.seed}
        editingEventId={dialogEditingId}
        onOpenChange={(v) => {
          if (!v) setDialogEditingId(null);
          setDialogOpen(v);
        }}
        onSaved={handleEventSaved}
        onMarkDone={dialogEditingId ? (id) => patchEventStatus(id, "DONE") : undefined}
        onMarkCancelled={dialogEditingId ? (id) => patchEventCancelled(id) : undefined}
        cases={cases}
        users={users}
        legalProcesses={legalProcesses}
        internalProcesses={internalProcesses}
      />

      {/* FAB mobile */}
      <Button
        type="button"
        size="icon"
        className="fixed bottom-6 right-4 z-40 h-12 w-12 rounded-full shadow-lg md:hidden"
        onClick={() => openCreate(agendaDayKey)}
        aria-label="Novo compromisso"
      >
        <Plus className="size-6" />
      </Button>
    </div>
  );
}
