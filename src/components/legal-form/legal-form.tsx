"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, AlertTriangle, Circle } from "lucide-react";
import {
  maskCepInput,
  maskCnjInput,
  maskCnpjInput,
  maskCpfInput,
  maskCurrencyBrlInput,
  maskDateBrInput,
  maskPhoneBrInput,
  parseBrDateToIso,
  formatIsoToBrDate,
  digitsOnly,
} from "@/lib/forms/legal-input-masks";

export type FieldRequirement = "required" | "optional" | "lacuna";

export function LegalValidationMessage({ children, id }: { children: React.ReactNode; id?: string }) {
  if (children == null || children === false) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs text-rose-300">
      {children}
    </p>
  );
}

export function LegalFieldHint({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="mt-1 text-[11px] leading-snug text-[color:var(--text-secondary)]">{children}</p>
  );
}

export function LegalFieldGroup({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("space-y-1.5", className)}>{children}</div>;
}

export type SectionStatus = "complete" | "incomplete" | "lacuna";

const statusIcon = {
  complete: <Check className="size-3.5 text-emerald-400" aria-hidden />,
  incomplete: <Circle className="size-3.5 text-muted-foreground/50" aria-hidden />,
  lacuna: <AlertTriangle className="size-3.5 text-amber-400" aria-hidden />,
};

export function LegalSectionCard({
  id,
  step,
  title,
  subtitle,
  requirementNote,
  status,
  children,
  className,
  footer,
}: {
  id: string;
  step: number | string;
  title: string;
  subtitle?: string;
  requirementNote?: string;
  status: SectionStatus;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}) {
  return (
    <Card
      id={id}
      className={cn(
        "scroll-mt-[calc(var(--app-header-h,5.5rem)+5.25rem)] p-4 shadow-none md:p-5",
        "transition-shadow hover:shadow-md",
        className,
      )}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-[color:var(--border-default)]/80 pb-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
              {step}
            </Badge>
            <h2 className="text-base font-semibold tracking-tight text-[color:var(--text-primary)] md:text-[17px]">
              {title}
            </h2>
          </div>
          {subtitle ? (
            <p className="text-sm leading-relaxed text-[color:var(--text-secondary)]">{subtitle}</p>
          ) : null}
          {requirementNote ? (
            <p className="text-[11px] leading-relaxed text-[color:var(--text-muted)]">{requirementNote}</p>
          ) : null}
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-md border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] px-2 py-1 text-[10px] uppercase tracking-wide text-[color:var(--text-muted)]">
          {statusIcon[status]}
          {status === "complete" ? "Completo" : status === "lacuna" ? "Lacunas" : "Incompleto"}
        </span>
      </header>
      <div className="space-y-4">{children}</div>
      {footer ? <div className="mt-4 border-t border-[color:var(--border-default)]/60 pt-3">{footer}</div> : null}
    </Card>
  );
}

const labelClass =
  "text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]";

export function LegalTextInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  requirement = "optional",
  disabled,
  className,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  requirement?: FieldRequirement;
  disabled?: boolean;
  className?: string;
  type?: React.HTMLInputTypeAttribute;
  autoComplete?: string;
}) {
  const reqLabel =
    requirement === "required" ? "Obrigatório" : requirement === "lacuna" ? "Opcional / lacuna permitida" : "Opcional";
  return (
    <LegalFieldGroup>
      <Label htmlFor={id} className={cn(labelClass, "flex flex-wrap items-center gap-2")}>
        {label}
        <span className="font-normal normal-case text-[10px] text-[color:var(--text-muted)]">({reqLabel})</span>
      </Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className={cn(error && "border-rose-500/50 focus-visible:ring-rose-500/40", className)}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-[11px] text-[color:var(--text-secondary)]">
          {hint}
        </p>
      ) : null}
      <LegalValidationMessage id={`${id}-err`}>{error}</LegalValidationMessage>
    </LegalFieldGroup>
  );
}

export function LegalMaskedInput({
  id,
  label,
  mask,
  value,
  onChange,
  placeholder,
  hint,
  error,
  requirement = "optional",
  disabled,
  className,
}: {
  id: string;
  label: string;
  mask: "cnj" | "cpf" | "cnpj" | "phone" | "cep" | "currency";
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  requirement?: FieldRequirement;
  disabled?: boolean;
  className?: string;
}) {
  const apply = (raw: string) => {
    switch (mask) {
      case "cnj":
        return maskCnjInput(raw);
      case "cpf":
        return maskCpfInput(raw);
      case "cnpj":
        return maskCnpjInput(raw);
      case "phone":
        return maskPhoneBrInput(raw);
      case "cep":
        return maskCepInput(raw);
      case "currency":
        return maskCurrencyBrlInput(raw);
      default:
        return raw;
    }
  };

  const reqLabel =
    requirement === "required" ? "Obrigatório" : requirement === "lacuna" ? "Opcional / lacuna permitida" : "Opcional";

  return (
    <LegalFieldGroup>
      <Label htmlFor={id} className={cn(labelClass, "flex flex-wrap items-center gap-2")}>
        {label}
        <span className="font-normal normal-case text-[10px] text-[color:var(--text-muted)]">({reqLabel})</span>
      </Label>
      <Input
        id={id}
        inputMode={mask === "currency" ? "decimal" : "numeric"}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(apply(e.target.value))}
        className={cn(
          "font-mono text-[13px]",
          error && "border-rose-500/50 focus-visible:ring-rose-500/40",
          className,
        )}
      />
      {hint ? <p className="text-[11px] text-[color:var(--text-secondary)]">{hint}</p> : null}
      <LegalValidationMessage>{error}</LegalValidationMessage>
    </LegalFieldGroup>
  );
}

export function LegalTextarea({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  requirement = "optional",
  minHeightPx = 88,
  disabled,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  requirement?: FieldRequirement;
  minHeightPx?: number;
  disabled?: boolean;
  className?: string;
}) {
  const reqLabel =
    requirement === "required" ? "Obrigatório" : requirement === "lacuna" ? "Opcional / lacuna permitida" : "Opcional";
  return (
    <LegalFieldGroup>
      <Label htmlFor={id} className={cn(labelClass, "flex flex-wrap items-center gap-2")}>
        {label}
        <span className="font-normal normal-case text-[10px] text-[color:var(--text-muted)]">({reqLabel})</span>
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        style={{ minHeight: minHeightPx }}
        className={cn(
          "resize-y text-sm leading-relaxed",
          error && "border-rose-500/50 focus-visible:ring-rose-500/40",
          className,
        )}
      />
      {hint ? <p className="text-[11px] text-[color:var(--text-secondary)]">{hint}</p> : null}
      <LegalValidationMessage>{error}</LegalValidationMessage>
    </LegalFieldGroup>
  );
}

const selectClass = cn(
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
);

export function LegalSelect<T extends string>({
  id,
  label,
  value,
  onChange,
  options,
  hint,
  error,
  requirement = "optional",
  disabled,
}: {
  id: string;
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  requirement?: FieldRequirement;
  disabled?: boolean;
}) {
  const reqLabel =
    requirement === "required" ? "Obrigatório" : requirement === "lacuna" ? "Opcional / lacuna permitida" : "Opcional";
  return (
    <LegalFieldGroup>
      <Label htmlFor={id} className={cn(labelClass, "flex flex-wrap items-center gap-2")}>
        {label}
        <span className="font-normal normal-case text-[10px] text-[color:var(--text-muted)]">({reqLabel})</span>
      </Label>
      <select
        id={id}
        className={selectClass}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <p className="text-[11px] text-[color:var(--text-secondary)]">{hint}</p> : null}
      <LegalValidationMessage>{error}</LegalValidationMessage>
    </LegalFieldGroup>
  );
}

/** Valor ISO yyyy-mm-dd no formulário; exibição dd/mm/aaaa. */
export function LegalDateInput({
  id,
  label,
  isoValue,
  onIsoChange,
  hint,
  error,
  requirement = "optional",
  disabled,
}: {
  id: string;
  label: string;
  isoValue: string;
  onIsoChange: (iso: string) => void;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  requirement?: FieldRequirement;
  disabled?: boolean;
}) {
  const [br, setBr] = React.useState(() => (isoValue ? formatIsoToBrDate(isoValue) : ""));
  React.useEffect(() => {
    setBr(isoValue ? formatIsoToBrDate(isoValue) : "");
  }, [isoValue]);

  const reqLabel =
    requirement === "required" ? "Obrigatório" : requirement === "lacuna" ? "Opcional / lacuna permitida" : "Opcional";

  return (
    <LegalFieldGroup>
      <Label htmlFor={id} className={cn(labelClass, "flex flex-wrap items-center gap-2")}>
        {label}
        <span className="font-normal normal-case text-[10px] text-[color:var(--text-muted)]">({reqLabel})</span>
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        autoComplete="off"
        disabled={disabled}
        value={br}
        onChange={(e) => {
          const m = maskDateBrInput(e.target.value);
          setBr(m);
          const iso = parseBrDateToIso(m);
          onIsoChange(iso);
        }}
        onBlur={() => {
          const iso = parseBrDateToIso(br);
          if (iso) {
            setBr(formatIsoToBrDate(iso));
            onIsoChange(iso);
          } else if (digitsOnly(br).length === 0) {
            onIsoChange("");
          }
        }}
        className={cn("w-full max-w-[11rem] font-mono text-[13px]", error && "border-rose-500/50")}
      />
      {hint ? <p className="text-[11px] text-[color:var(--text-secondary)]">{hint}</p> : null}
      <LegalValidationMessage>{error}</LegalValidationMessage>
    </LegalFieldGroup>
  );
}

export function LegalCurrencyInput({
  id,
  label,
  value,
  onChange,
  hint,
  error,
  requirement = "optional",
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  requirement?: FieldRequirement;
  disabled?: boolean;
}) {
  const reqLabel =
    requirement === "required" ? "Obrigatório" : requirement === "lacuna" ? "Opcional / lacuna permitida" : "Opcional";
  return (
    <LegalFieldGroup>
      <Label htmlFor={id} className={cn(labelClass, "flex flex-wrap items-center gap-2")}>
        {label}
        <span className="font-normal normal-case text-[10px] text-[color:var(--text-muted)]">({reqLabel})</span>
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="R$ 0,00"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(maskCurrencyBrlInput(e.target.value))}
        className={cn("font-mono text-[13px]", error && "border-rose-500/50")}
      />
      {hint ? <p className="text-[11px] text-[color:var(--text-secondary)]">{hint}</p> : null}
      <LegalValidationMessage>{error}</LegalValidationMessage>
    </LegalFieldGroup>
  );
}
