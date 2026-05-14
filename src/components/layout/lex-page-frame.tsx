import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Modelo futuro (V1+): widgets por zona, sem drag/resize nesta versão.
 *
 * Zonas: `leftRail` | `center` | `rightRail`.
 * Regras previstas: cada widget tem `zone`, `x`, `y`, `w`, `h`; no center `x ∈ [0,3]`, `w ∈ [1,4]`;
 * nos rails `x = 0`, `w = 1`; variantes `compact` | `normal` | `expanded`; sem atravessar zonas;
 * sem card ocupando rail esquerdo + coluna 1 do center. Persistência sugerida:
 * `{ id, zone, x, y, w, h, variant? }`.
 */

export type LexPageFrameCenterWidth = "default" | "wide" | "full";

export type LexPageFrameProps = {
  leftRail?: ReactNode;
  children: ReactNode;
  rightRail?: ReactNode;
  centerWidth?: LexPageFrameCenterWidth;
  /** Rotas em bleed (área útil larga): grelha `1fr | centro | 1fr` alinhada ao header. */
  bleed?: boolean;
  className?: string;
  centerClassName?: string;
  leftRailClassName?: string;
  rightRailClassName?: string;
};

type Tracks = "lcr" | "cr" | "lc" | "c";

function resolveTracks(hasLeft: boolean, hasRight: boolean): Tracks {
  if (hasLeft && hasRight) return "lcr";
  if (hasLeft) return "lc";
  if (hasRight) return "cr";
  return "c";
}

export function LexPageFrame({
  leftRail,
  children,
  rightRail,
  centerWidth = "default",
  bleed = false,
  className,
  centerClassName,
  leftRailClassName,
  rightRailClassName,
}: LexPageFrameProps) {
  const hasLeft = leftRail != null;
  const hasRight = rightRail != null;
  const tracks = resolveTracks(hasLeft, hasRight);

  const widthMod =
    centerWidth === "wide"
      ? "lex-layout-three-well--center-wide"
      : centerWidth === "full"
        ? "lex-layout-three-well--center-full"
        : null;

  const centerCell = (
    <div
      className={cn(
        "lex-layout-three-well__center min-w-0",
        bleed && tracks !== "c" && "flex min-h-0 flex-1 flex-col",
        centerClassName,
      )}
    >
      {children}
    </div>
  );

  if (bleed) {
    return (
      <div data-lex-tracks={tracks} className={cn("lex-layout-three-well", widthMod, className)}>
        {hasLeft ? leftRail : null}
        {centerCell}
        {hasRight ? rightRail : null}
      </div>
    );
  }

  if (tracks === "lcr") {
    return (
      <div className={cn("lex-layout-constrained-lcr", className)}>
        <div className={cn("min-w-0 max-w-full", leftRailClassName)}>{leftRail}</div>
        <div className={cn("min-w-0 max-w-full", centerClassName)}>{children}</div>
        <div className={cn("min-w-0 max-w-full", rightRailClassName)}>{rightRail}</div>
      </div>
    );
  }

  if (tracks === "cr") {
    return (
      <div className={cn("lex-layout-constrained-cr", className)}>
        <div className={cn("min-w-0 max-w-full", centerClassName)}>{children}</div>
        <div className={cn("min-w-0 max-w-full xl:max-w-[var(--lex-rail-right-max)]", rightRailClassName)}>
          {rightRail}
        </div>
      </div>
    );
  }

  if (tracks === "lc") {
    return (
      <div className={cn("lex-layout-constrained-lc", className)}>
        <div className={cn("min-w-0 max-w-full", leftRailClassName)}>{leftRail}</div>
        <div className={cn("min-w-0 max-w-full", centerClassName)}>{children}</div>
      </div>
    );
  }

  return (
    <div className={cn("w-full min-w-0", className)}>
      <div
        className={cn(
          "mx-auto w-full min-w-0 max-w-[var(--lex-content-default)]",
          centerWidth === "wide" && "max-w-[var(--lex-content-wide)]",
          centerWidth === "full" && "max-w-none",
          centerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
