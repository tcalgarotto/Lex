import type { CrmPipelineStage } from "@prisma/client";
import { readJustosWorkspaceConfig } from "@/lib/justos/workspace-config";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_CRM_AUTOMATION_RULES,
  type CrmAutomationRule,
  type CrmAutomationTrigger,
} from "./automation-rules";
import { createCrmTask, recordCrmActivity } from "./timeline-service";

export type AutomationContext = {
  workspaceId: string;
  contactId: string;
  trigger: CrmAutomationTrigger;
  caseId?: string | null;
  conversationId?: string | null;
  stage?: CrmPipelineStage;
  isNewContact?: boolean;
};

function rulesForWorkspace(onboardingJson: unknown): CrmAutomationRule[] {
  const cfg = readJustosWorkspaceConfig(onboardingJson);
  const custom = (cfg as { crmAutomationRules?: CrmAutomationRule[] }).crmAutomationRules;
  if (Array.isArray(custom) && custom.length > 0) return custom;
  return DEFAULT_CRM_AUTOMATION_RULES;
}

function matchesConditions(rule: CrmAutomationRule, ctx: AutomationContext): boolean {
  const c = rule.conditions ?? {};
  if (c["stage"] && ctx.stage !== c["stage"]) return false;
  if (c["isNewContact"] && !ctx.isNewContact) return false;
  if (c["fromStage"] && ctx.stage !== c["fromStage"]) return false;
  return true;
}

export async function runCrmAutomations(ctx: AutomationContext): Promise<{ ran: number }> {
  const ws = await prisma.workspace.findUnique({
    where: { id: ctx.workspaceId },
    select: { onboardingJson: true },
  });
  if (!ws) return { ran: 0 };

  const contact = await prisma.crmContact.findFirst({
    where: { id: ctx.contactId, workspaceId: ctx.workspaceId, deletedAt: null },
  });
  if (!contact?.phoneE164 || contact.optOutWhatsapp) return { ran: 0 };

  const rules = rulesForWorkspace(ws.onboardingJson).filter(
    (r) => r.active && r.trigger === ctx.trigger && matchesConditions(r, ctx),
  );

  let ran = 0;
  for (const rule of rules) {
    for (const action of rule.actions) {
      if (action.type === "create_task") {
        const dueAt = action.dueInHours
          ? new Date(Date.now() + action.dueInHours * 3600_000)
          : undefined;
        await createCrmTask(ctx.workspaceId, ctx.contactId, {
          title: action.title,
          dueAt,
          caseId: ctx.caseId ?? undefined,
          type: "FOLLOW_UP",
        });
        ran++;
      } else if (action.type === "add_note") {
        await recordCrmActivity(ctx.workspaceId, ctx.contactId, {
          type: "NOTE",
          title: "Nota automática",
          body: action.body,
          caseId: ctx.caseId,
          conversationId: ctx.conversationId,
          metadataJson: { ruleId: rule.id, automation: true },
        });
        ran++;
      } else if (action.type === "move_stage") {
        await prisma.crmContact.update({
          where: { id: ctx.contactId },
          data: { pipelineStage: action.stage as CrmPipelineStage },
        });
        ran++;
      }
    }
  }
  return { ran };
}
