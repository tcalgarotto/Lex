import { cn } from "@/lib/utils";

/** Grid padrão para campos curtos/largos na entrevista. */
export function IntakeFieldGrid({
  children,
  className,
  cols = 2,
}: {
  children: React.ReactNode;
  className?: string;
  cols?: 1 | 2;
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        cols === 2 && "md:grid-cols-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function IntakeFieldSpan({ children, full }: { children: React.ReactNode; full?: boolean }) {
  return <div className={cn(full && "md:col-span-2")}>{children}</div>;
}

export function IntakeSubheading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>
  );
}
