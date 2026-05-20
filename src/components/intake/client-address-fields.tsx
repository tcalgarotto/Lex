"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LegalMaskedInput, LegalTextInput } from "@/components/legal-form/legal-form";
import { UfCombobox } from "@/components/forms/uf-combobox";
import { isValidBrUf } from "@/lib/forms/br-uf";

type AddressPatch = {
  cep?: string;
  address?: string;
  city?: string;
  uf?: string;
};

export function ClientAddressFields({
  idPrefix,
  cep,
  address,
  city,
  uf,
  onPatch,
  ufError,
}: {
  idPrefix: string;
  cep: string;
  address: string;
  city: string;
  uf: string;
  onPatch: (patch: AddressPatch) => void;
  ufError?: React.ReactNode;
}) {
  const [loading, setLoading] = React.useState(false);

  async function lookupCep() {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) {
      toast.error("Informe um CEP com 8 dígitos.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/address/lookup?cep=${encodeURIComponent(digits)}`, {
        credentials: "include",
      });
      const body = (await res.json()) as {
        address?: { street: string; neighborhood: string; city: string; uf: string; cep: string };
        error?: string;
      };
      if (!res.ok) {
        toast.error(body.error ?? "CEP não encontrado.");
        return;
      }
      const a = body.address!;
      const streetLine = [a.street, a.neighborhood].filter(Boolean).join(", ");
      onPatch({
        cep: digits.replace(/(\d{5})(\d{3})/, "$1-$2"),
        address: streetLine || address,
        city: a.city || city,
        uf: a.uf || uf,
      });
      toast.success("Endereço preenchido pelo CEP.");
    } catch {
      toast.error("Não foi possível buscar o CEP. Preencha manualmente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
      <div className="flex flex-col gap-2 md:col-span-2 sm:flex-row sm:items-end">
        <LegalMaskedInput
          id={`${idPrefix}-cep`}
          mask="cep"
          label="CEP"
          value={cep}
          onChange={(v) => onPatch({ cep: v })}
          placeholder="00000-000"
          requirement="optional"
          className="max-w-[10rem]"
        />
        <Button type="button" variant="secondary" size="sm" disabled={loading} onClick={() => void lookupCep()}>
          {loading ? "Buscando…" : "Buscar endereço"}
        </Button>
      </div>
      <LegalTextInput
        id={`${idPrefix}-address`}
        label="Endereço (rua, número, complemento)"
        value={address}
        onChange={(v) => onPatch({ address: v })}
        placeholder="Rua, número, complemento"
        requirement="optional"
        className="md:col-span-2"
      />
      <LegalTextInput
        id={`${idPrefix}-city`}
        label="Cidade"
        value={city}
        onChange={(v) => onPatch({ city: v })}
        placeholder="Cidade"
        requirement="optional"
      />
      <UfCombobox
        id={`${idPrefix}-uf`}
        label="UF"
        value={uf}
        onChange={(v) => onPatch({ uf: v })}
        error={uf && !isValidBrUf(uf) ? ufError ?? "UF inválida." : ufError}
        requirement="optional"
      />
    </div>
  );
}
