"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";

/** Remove `height` das transições injetadas pelo Sonner (evita alerta Impeccable layout-transition). */
function patchSonnerInjectedStyles() {
  for (const el of document.querySelectorAll("style")) {
    const text = el.textContent;
    if (!text?.includes("[data-sonner-toast]")) continue;
    if (!/\bheight\s+[\d.]+m?s\b/.test(text)) continue;
    el.textContent = text.replace(/,?\s*height\s+[\d.]+m?s/gi, "");
  }
}

export function SonnerToaster() {
  useEffect(() => {
    patchSonnerInjectedStyles();
    const observer = new MutationObserver(patchSonnerInjectedStyles);
    observer.observe(document.head, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return <Toaster richColors position="top-center" />;
}
