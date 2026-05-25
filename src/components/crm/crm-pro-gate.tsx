import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JUSTOS_PRO_NAME } from "@/lib/justos/product-copy";

export function CrmProGateEmptyState() {
  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>{JUSTOS_PRO_NAME} necessário</CardTitle>
        <CardDescription>
          O CRM profissional (contatos, pipeline e conversas) está disponível com assinatura{" "}
          {JUSTOS_PRO_NAME}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Ative o plano em integrações para liberar contatos, pipeline e, em breve, inbox WhatsApp do
          escritório.
        </p>
        <Button asChild>
          <Link href="/settings/integracoes/justos">Ver planos JustOS</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
