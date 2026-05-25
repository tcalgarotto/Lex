"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DEFAULT_CRM_AUTOMATION_RULES } from "@/lib/justos/crm/automation-rules";

type RuleRow = (typeof DEFAULT_CRM_AUTOMATION_RULES)[number] & { active?: boolean };

export function CrmAutomationsClient() {
  const [rules, setRules] = useState<RuleRow[]>([]);

  useEffect(() => {
    setRules(
      DEFAULT_CRM_AUTOMATION_RULES.map((r) => ({
        ...r,
        active: true,
      })),
    );
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Templates iniciais (armazenamento em onboardingJson em breve). Ative/desative conforme o fluxo do escritório.
      </p>
      <ul className="divide-y rounded-lg border">
        {rules.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">
                {r.trigger} → {r.actions.map((a) => a.type).join(", ")}
              </p>
            </div>
            <Button
              variant={r.active ? "secondary" : "outline"}
              size="sm"
              onClick={() =>
                setRules((prev) =>
                  prev.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)),
                )
              }
            >
              {r.active ? "Ativa" : "Inativa"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
