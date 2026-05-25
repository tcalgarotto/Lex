"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export const THEME_STORAGE_KEY = "justos-theme";
const LEGACY_THEME_STORAGE_KEY = "lex-theme";

export type ThemePreference = "light" | "dark" | "auto";

export function resolveDataTheme(pref: ThemePreference): "light" | "dark" {
 if (pref === "light" || pref === "dark") return pref;
 if (typeof window === "undefined") return "light";
 return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function readThemePreference(): ThemePreference {
 if (typeof window === "undefined") return "light";
 try {
 const t =
 localStorage.getItem(THEME_STORAGE_KEY) ?? localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
 if (t === "light" || t === "dark" || t === "auto") return t;
 } catch {
 /* ignore */
 }
 return "light";
}

function installAutoThemeListenerOnce() {
 if (typeof window === "undefined") return;
 const w = window as Window & { __lexThemeAutoListen?: boolean };
 if (w.__lexThemeAutoListen) return;
 w.__lexThemeAutoListen = true;
 const mq = window.matchMedia("(prefers-color-scheme: dark)");
 mq.addEventListener("change", () => {
 try {
 if (localStorage.getItem(THEME_STORAGE_KEY) !== "auto") return;
 document.documentElement.setAttribute("data-theme", mq.matches ? "dark" : "light");
 } catch {
 /* ignore */
 }
 });
}

export function applyThemePreference(pref: ThemePreference) {
 const dataTheme = resolveDataTheme(pref);
 document.documentElement.setAttribute("data-theme", dataTheme);
 try {
 localStorage.setItem(THEME_STORAGE_KEY, pref);
 } catch {
 /* ignore */
 }
 if (pref === "auto") installAutoThemeListenerOnce();
}

/** Três modos, só ícones — para a sidebar ou menu da conta (`compact` = cabe em largura estreita). */
export function LexSidebarThemeToggle({
 collapsed,
 compact = false,
}: {
 collapsed: boolean;
 /** Sem `w-full`: encaixa no ancho do trigger (ex.: popup da conta). */
 compact?: boolean;
}) {
 const [preference, setPreference] = useState<ThemePreference>("light");

 useEffect(() => {
 setPreference(readThemePreference());
 const p = readThemePreference();
 applyThemePreference(p);
 }, []);

 function apply(next: ThemePreference) {
 applyThemePreference(next);
 setPreference(next);
 }

 const row = collapsed ? "flex flex-col items-center gap-0.5" : "flex max-w-full min-w-0 flex-row gap-0.5";
 const rowClass = compact ? "flex max-w-full min-w-0 flex-row gap-0.5" : row;

 return (
 <div
 role="radiogroup"
 aria-label="Tema da interface"
 className={cn("rounded-lg border-[0.5px] border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-0.5",
 rowClass,
 )}
 >
 <button
 type="button"
 role="radio"
 aria-checked={preference === "light"}
 aria-label="Tema claro"
 onClick={() => apply("light")}
 className={cn("flex flex-1 basis-0 items-center justify-center rounded-md lex-transition",
 compact ? "min-w-0 p-1.5" : "min-w-0 flex-1 p-2",
 preference === "light"
 ? "bg-[color:var(--surface-card)] text-[color:var(--text-primary)] shadow-sm"
 : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-overlay)] hover:text-[color:var(--text-secondary)]",
 collapsed && "w-full flex-none p-2",
 )}
 >
 <Sun className={cn("shrink-0", compact ? "size-4" : "size-5")} aria-hidden />
 </button>
 <button
 type="button"
 role="radio"
 aria-checked={preference === "dark"}
 aria-label="Tema escuro"
 onClick={() => apply("dark")}
 className={cn("flex flex-1 basis-0 items-center justify-center rounded-md lex-transition",
 compact ? "min-w-0 p-1.5" : "min-w-0 flex-1 p-2",
 preference === "dark"
 ? "bg-[color:var(--surface-card)] text-[color:var(--text-primary)] shadow-sm"
 : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-overlay)] hover:text-[color:var(--text-secondary)]",
 collapsed && "w-full flex-none p-2",
 )}
 >
 <Moon className={cn("shrink-0", compact ? "size-4" : "size-5")} aria-hidden />
 </button>
 <button
 type="button"
 role="radio"
 aria-checked={preference === "auto"}
 aria-label="Tema conforme o dispositivo"
 onClick={() => apply("auto")}
 className={cn("flex flex-1 basis-0 items-center justify-center rounded-md lex-transition",
 compact ? "min-w-0 p-1.5" : "min-w-0 flex-1 p-2",
 preference === "auto"
 ? "bg-[color:var(--surface-card)] text-[color:var(--text-primary)] shadow-sm"
 : "text-[color:var(--text-muted)] hover:bg-[color:var(--surface-overlay)] hover:text-[color:var(--text-secondary)]",
 collapsed && "w-full flex-none p-2",
 )}
 >
 <Monitor className={cn("shrink-0", compact ? "size-4" : "size-5")} aria-hidden />
 </button>
 </div>
 );
}

export function LexThemeToggle({ className }: { className?: string }) {
 const [preference, setPreference] = useState<ThemePreference>("light");

 useEffect(() => {
 const p = readThemePreference();
 setPreference(p);
 applyThemePreference(p);
 }, []);

 function apply(next: "light" | "dark") {
 applyThemePreference(next);
 setPreference(next);
 }

 const resolved = resolveDataTheme(preference);
 const darkPressed = preference === "dark" || (preference === "auto" && resolved === "dark");
 const lightPressed = preference === "light" || (preference === "auto" && resolved === "light");

 return (
 <div
 role="group"
 aria-label="Alternar tema claro ou escuro"
 className={cn("inline-flex items-center gap-0.5 rounded-full border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-0.5",
 "lex-transition",
 className,
 )}
 >
 <button
 type="button"
 onClick={() => apply("dark")}
 aria-pressed={darkPressed}
 className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium lex-transition",
 darkPressed
 ? "bg-[color:var(--surface-card)] text-[color:var(--text-primary)] shadow-sm"
 : "text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]",
 )}
 >
 <Moon className="size-3.5" aria-hidden />
 Escuro
 </button>
 <button
 type="button"
 onClick={() => apply("light")}
 aria-pressed={lightPressed}
 className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium lex-transition",
 lightPressed
 ? "bg-[color:var(--surface-card)] text-[color:var(--text-primary)] shadow-sm"
 : "text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)]",
 )}
 >
 <Sun className="size-3.5" aria-hidden />
 Claro
 </button>
 </div>
 );
}
