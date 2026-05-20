"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { BR_UF_ENTRIES, findUfByQuery, formatUfLabel, isValidBrUf } from "@/lib/forms/br-uf";
import { LegalFieldGroup, LegalValidationMessage } from "@/components/legal-form/legal-form";
import { Label } from "@/components/ui/label";
import type { FieldRequirement } from "@/components/legal-form/legal-form";
import { ChevronDown } from "lucide-react";

const labelClass = "text-sm font-semibold leading-snug text-[color:var(--text-secondary)]";

export function UfCombobox({
  id,
  label,
  value,
  onChange,
  error,
  requirement = "optional",
  disabled,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (uf: string) => void;
  error?: React.ReactNode;
  requirement?: FieldRequirement;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState(() => (value ? formatUfLabel(value) : ""));
  const listRef = React.useRef<HTMLUListElement>(null);

  React.useEffect(() => {
    setQuery(value ? formatUfLabel(value) : "");
  }, [value]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...BR_UF_ENTRIES];
    return BR_UF_ENTRIES.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.uf.toLowerCase().includes(q) ||
        `${e.name} — ${e.uf}`.toLowerCase().includes(q),
    );
  }, [query]);

  function pick(uf: string) {
    onChange(uf);
    setQuery(formatUfLabel(uf));
    setOpen(false);
  }

  function onBlurInput() {
    window.setTimeout(() => {
      if (!open) {
        const found = findUfByQuery(query);
        if (found) {
          onChange(found.uf);
          setQuery(formatUfLabel(found.uf));
        } else if (!query.trim()) {
          onChange("");
        } else if (value && isValidBrUf(value)) {
          setQuery(formatUfLabel(value));
        }
      }
      setOpen(false);
    }, 150);
  }

  return (
    <LegalFieldGroup className={className}>
      <Label htmlFor={id} className={cn(labelClass, "flex flex-wrap items-center gap-x-1")}>
        {label}
        {requirement === "required" ? (
          <span className="font-semibold text-rose-400/95" aria-hidden>
            {" "}
            *
          </span>
        ) : null}
      </Label>
      <div className="relative max-w-[14rem]">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          disabled={disabled}
          autoComplete="off"
          value={query}
          placeholder="Ex.: São Paulo — SP"
          onFocus={() => setOpen(true)}
          onBlur={onBlurInput}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            const direct = findUfByQuery(e.target.value);
            if (direct && e.target.value.trim().toUpperCase() === direct.uf) {
              onChange(direct.uf);
            }
          }}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-transparent py-2 pl-3 pr-9 text-base shadow-sm",
            "placeholder:text-[color:var(--placeholder-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            error && "border-rose-500/50",
            className,
          )}
        />
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        {open && filtered.length > 0 ? (
          <ul
            id={`${id}-listbox`}
            ref={listRef}
            role="listbox"
            className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-[color:var(--border-default)] bg-[color:var(--surface-elevated)] py-1 shadow-lg"
          >
            {filtered.map((e) => (
              <li key={e.uf} role="option" aria-selected={value === e.uf}>
                <button
                  type="button"
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-white/[0.06]",
                    value === e.uf && "bg-violet-500/15 text-violet-100",
                  )}
                  onMouseDown={(ev) => {
                    ev.preventDefault();
                    pick(e.uf);
                  }}
                >
                  {e.name} — {e.uf}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <LegalValidationMessage>{error}</LegalValidationMessage>
    </LegalFieldGroup>
  );
}
