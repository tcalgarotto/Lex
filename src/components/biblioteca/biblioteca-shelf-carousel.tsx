"use client";

import { Children, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Igual a `gap-4` na grelha. */
const GAP_PX = 16;
/** Mínimo de cada coluna (`minmax(148px, 172px)`). */
const COL_MIN_PX = 148;

function maxFullColumns(containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth < COL_MIN_PX) return 1;
  return Math.max(1, Math.floor((containerWidth + GAP_PX) / (COL_MIN_PX + GAP_PX)));
}

/**
 * Prateleira horizontal sem scroll: mostra só capas que cabem inteiras na largura;
 * o resto fica nas páginas «Ver mais» / «Ver todos».
 */
export function BibliotecaShelfCarousel({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const outerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const update = () => {
      const cols = maxFullColumns(el.clientWidth);
      setVisibleCount(Math.min(cols, items.length));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length]);

  const shown = items.slice(0, visibleCount);

  return (
    <div ref={outerRef} className="relative -mx-1 min-w-0">
      <div className="grid auto-cols-[minmax(148px,172px)] grid-flow-col gap-4 overflow-x-hidden px-1 pb-2 pt-1">
        {shown}
      </div>
    </div>
  );
}
