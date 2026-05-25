import { CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  subscribed: boolean;
  phoneConfigured: boolean;
  operational: boolean;
};

const steps = [
  { key: "subscribe", label: "Assinar JustOS Pro" },
  { key: "phone", label: "Cadastrar WhatsApp do advogado" },
  { key: "active", label: "Operação ativa (eventos → n8n)" },
] as const;

export function JustosSetupSteps({ subscribed, phoneConfigured, operational }: Props) {
  const done = [subscribed, phoneConfigured, operational];

  return (
    <ol className="space-y-2">
      {steps.map((step, i) => {
        const complete = done[i];
        return (
          <li key={step.key} className="flex items-center gap-2 text-sm">
            {complete ? (
              <CheckCircle2 className="size-4 shrink-0 text-violet-400" aria-hidden />
            ) : (
              <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className={cn(complete ? "text-[color:var(--text-primary)]" : "text-muted-foreground")}>
              {i + 1}. {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
