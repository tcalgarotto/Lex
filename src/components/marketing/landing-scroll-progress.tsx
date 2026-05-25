"use client";

import { useEffect, useState } from "react";

/** Barra fina no topo — visibilidade de progresso na página longa (heurística #1). */
export function LandingScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);

      const marker = document.getElementById("hero-scroll-marker");
      const root = document.querySelector(".lex-marketing-page");
      if (marker && root) {
        root.classList.toggle("lex-past-hero", marker.getBoundingClientRect().top < 72);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    const interval = window.setInterval(onScroll, 200);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.clearInterval(interval);
      document.querySelector(".lex-marketing-page")?.classList.remove("lex-past-hero");
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[110] h-0.5 bg-[color:var(--border-subtle)]"
      role="progressbar"
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Progresso de leitura da página"
    >
      <div
        className="landing-scroll-progress-bar h-full origin-left bg-[color:var(--brand-primary)]"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
