-- JustOS Pro CRM — RLS (defesa em profundidade; app Prisma usa service role)
-- Aplicar no Supabase SQL Editor se migrate deploy não rodar este arquivo.

ALTER TABLE "CrmContact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CrmConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CrmMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JustosWhatsappSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JustosBillingEvent" ENABLE ROW LEVEL SECURITY;

-- Service role bypassa RLS; políticas abaixo protegem acesso anon/authenticated direto.

CREATE POLICY "crm_contact_workspace" ON "CrmContact"
  FOR ALL USING (
    "workspaceId" IN (
      SELECT m."workspaceId" FROM "Membership" m
      WHERE m."userId" = auth.uid()::text
    )
  );

CREATE POLICY "crm_conversation_workspace" ON "CrmConversation"
  FOR ALL USING (
    "workspaceId" IN (
      SELECT m."workspaceId" FROM "Membership" m
      WHERE m."userId" = auth.uid()::text
    )
  );

CREATE POLICY "crm_message_workspace" ON "CrmMessage"
  FOR ALL USING (
    "workspaceId" IN (
      SELECT m."workspaceId" FROM "Membership" m
      WHERE m."userId" = auth.uid()::text
    )
  );

CREATE POLICY "justos_wa_session_workspace" ON "JustosWhatsappSession"
  FOR ALL USING (
    "workspaceId" IN (
      SELECT m."workspaceId" FROM "Membership" m
      WHERE m."userId" = auth.uid()::text
    )
  );

CREATE POLICY "justos_billing_event_deny_anon" ON "JustosBillingEvent"
  FOR ALL USING (false);
