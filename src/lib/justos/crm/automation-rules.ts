export type CrmAutomationTrigger =
  | "conversation.inbound.created"
  | "contact.stage.changed"
  | "contact.created"
  | "task.due"
  | "case.created"
  | "deadline.approaching";

export type CrmAutomationAction =
  | { type: "create_task"; title: string; dueInHours?: number }
  | { type: "send_whatsapp_template"; templateKey: string }
  | { type: "move_stage"; stage: string }
  | { type: "add_note"; body: string }
  | { type: "notify_owner" }
  | { type: "call_n8n_webhook" };

export type CrmAutomationRule = {
  id: string;
  name: string;
  trigger: CrmAutomationTrigger;
  conditions?: Record<string, unknown>;
  actions: CrmAutomationAction[];
  active: boolean;
};

export const DEFAULT_CRM_AUTOMATION_RULES: CrmAutomationRule[] = [
  {
    id: "welcome-lead",
    name: "Boas-vindas lead",
    trigger: "conversation.inbound.created",
    conditions: { isNewContact: true },
    actions: [{ type: "create_task", title: "Responder novo lead no WhatsApp", dueInHours: 2 }],
    active: true,
  },
  {
    id: "waiting-client-followup",
    name: "Follow-up aguardando cliente",
    trigger: "contact.stage.changed",
    conditions: { stage: "WAITING_CLIENT" },
    actions: [
      { type: "create_task", title: "Follow-up — aguardando cliente", dueInHours: 48 },
      { type: "add_note", body: "Automação: estágio WAITING_CLIENT" },
    ],
    active: true,
  },
  {
    id: "active-on-reply",
    name: "Cliente respondeu",
    trigger: "conversation.inbound.created",
    conditions: { fromStage: "WAITING_CLIENT" },
    actions: [{ type: "move_stage", stage: "ACTIVE" }],
    active: true,
  },
];

export const WA_TEMPLATE_KEYS = [
  "welcome_lead",
  "request_documents",
  "meeting_confirm",
  "no_reply_followup",
  "deadline_reminder",
] as const;
