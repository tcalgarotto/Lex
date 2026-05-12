import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completeOnboardingAction } from "@/app/onboarding/actions";

export default async function OnboardingPage() {
 return (
 <AppShell title="Configuração inicial">
 <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
 <Card>
 <CardHeader>
 <CardTitle className="text-base">Comece em 2 minutos</CardTitle>
 <p className="text-sm text-muted-foreground">
 O Lex funciona com <span className="text-[color:var(--text-primary)]">memória + fontes</span>. Quando a base for insuficiente, ele avisa e evita “chutes”.
 </p>
 </CardHeader>
 <CardContent>
 <form action={completeOnboardingAction} className="space-y-4">
 <div className="grid gap-3 sm:grid-cols-2">
 <div className="space-y-1">
 <Label htmlFor="lawyerName">Seu nome</Label>
 <Input id="lawyerName" name="lawyerName" placeholder="Ex.: Dra. Ana Lima" />
 </div>
 <div className="space-y-1">
 <Label htmlFor="officeName">Nome do workspace</Label>
 <Input id="officeName" name="officeName" placeholder="Ex.: Lima Advocacia" />
 </div>
 </div>

 <div className="space-y-1">
 <Label htmlFor="areas">Áreas de atuação (vírgula)</Label>
 <Input id="areas" name="areas" placeholder="cível, consumidor, trabalhista" />
 </div>

 <div className="space-y-2">
 <Label>Estilo de escrita</Label>
 <div className="grid gap-2 sm:grid-cols-2">
 <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] p-3 text-sm">
 <input type="radio" name="stylePreset" value="tecnico_objetivo" defaultChecked />
 <div>
 <p className="font-medium">Técnico e objetivo</p>
 <p className="text-xs text-muted-foreground">Direto ao ponto, sem floreios.</p>
 </div>
 </label>
 <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] p-3 text-sm">
 <input type="radio" name="stylePreset" value="tecnico_robusto" />
 <div>
 <p className="font-medium">Técnico e robusto</p>
 <p className="text-xs text-muted-foreground">Mais fundamentação e estrutura.</p>
 </div>
 </label>
 <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] p-3 text-sm">
 <input type="radio" name="stylePreset" value="altamente_formal" />
 <div>
 <p className="font-medium">Altamente formal</p>
 <p className="text-xs text-muted-foreground">Tom mais solene e conservador.</p>
 </div>
 </label>
 <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] p-3 text-sm">
 <input type="radio" name="stylePreset" value="combativo" />
 <div>
 <p className="font-medium">Combativo</p>
 <p className="text-xs text-muted-foreground">Mais incisivo (com cautela).</p>
 </div>
 </label>
 <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] p-3 text-sm">
 <input type="radio" name="stylePreset" value="conciliador" />
 <div>
 <p className="font-medium">Conciliador</p>
 <p className="text-xs text-muted-foreground">Foco em solução e acordo.</p>
 </div>
 </label>
 </div>
 <p className="text-xs text-muted-foreground">
 Você pode ajustar depois em{" "}
 <Link className="text-violet-300 hover:underline" href="/settings/estilo">
 Estilo
 </Link>
 .
 </p>
 </div>

 <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
 <Button type="submit">Concluir e ir para o dashboard</Button>
 <Button asChild variant="outline" type="button">
 <Link href="/apresentacao">Ver apresentação</Link>
 </Button>
 </div>
 </form>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="text-base">Próximos passos</CardTitle>
 </CardHeader>
 <CardContent className="space-y-3 text-sm text-muted-foreground">
 <div className="rounded-lg border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-3">
 <p className="font-medium text-[color:var(--text-primary)]">1) Abrir processo demo</p>
 <p className="text-xs">Ideal para entender fontes e guardrails em 5 minutos.</p>
 </div>
 <div className="rounded-lg border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-3">
 <p className="font-medium text-[color:var(--text-primary)]">2) Carregar o primeiro documento</p>
 <p className="text-xs">O Lex extrai, segmenta e indexa para recuperação semântica.</p>
 </div>
 <div className="rounded-lg border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-3">
 <p className="font-medium text-[color:var(--text-primary)]">3) Perguntar e gerar peça</p>
 <p className="text-xs">Respostas sempre com fontes; se base for insuficiente, ele avisa.</p>
 </div>
 </CardContent>
 </Card>
 </div>
 </AppShell>
 );
}

