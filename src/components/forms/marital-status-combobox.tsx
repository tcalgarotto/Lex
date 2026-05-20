"use client";

import { LegalSelect } from "@/components/legal-form/legal-form";
import { MARITAL_STATUS_OPTIONS } from "@/lib/forms/marital-status";

export function MaritalStatusCombobox({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  error?: React.ReactNode;
}) {
  return (
    <LegalSelect
      id={id}
      label="Estado civil"
      value={value || "nao_informado"}
      onChange={onChange}
      requirement="optional"
      error={error}
      options={MARITAL_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
    />
  );
}
