"use client";

import { useEffect } from "react";
import { useAppChromeTitleStore } from "@/stores/app-chrome-title-store";

/** Define o título da topbar para rotas com dados dinâmicos (caso, peça, ficheiro…). */
export function SetPageTitle({ title }: { title: string }) {
  const setTitleOverride = useAppChromeTitleStore((s) => s.setTitleOverride);
  useEffect(() => {
    setTitleOverride(title);
    return () => setTitleOverride(null);
  }, [title, setTitleOverride]);
  return null;
}
