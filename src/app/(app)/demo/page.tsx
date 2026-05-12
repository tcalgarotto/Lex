import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function DemoPage() {
 const { workspaceId } = await getWorkspaceContext();
 const proc = await prisma.process.findFirst({
 where: { workspaceId, OR: [{ title: { contains: "DEMO" } }, { tags: { has: "demo" } }] },
 orderBy: { updatedAt: "desc" },
 select: { id: true, title: true, number: true, documents: { take: 6, orderBy: { updatedAt: "desc" } } },
 });

 const dispatchDoc = proc?.documents.find((d) => d.originalName.toLowerCase().includes("despacho")) ?? proc?.documents[0];

 return (
 <AppShell title="Modo demonstração">
 <div className="space-y-6">
 <Card>
 <CardHeader>
 <CardTitle className="text-base">Demo guiada — narrativa (5 minutos)</CardTitle>
 <p className="text-sm text-muted-foreground">
 Objetivo: mostrar que o Lex não é “chat com PDF”: ele mantém <span className="text-[color:var(--text-primary)]">fontes</span>, <span className="text-[color:var(--text-primary)]">confiança jurídica</span> e <span className="text-[color:var(--text-primary)]">guardrails</span>.
 </p>
 </CardHeader>
 <CardContent className="space-y-3 text-sm">
 <div className="grid gap-3 md:grid-cols-2">
 <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-4">
 <p className="text-xs font-medium uppercase text-muted-foreground">PASSO 1</p>
 <p className="mt-1 font-medium">Abrir processo demo</p>
 <p className="mt-1 text-xs text-muted-foreground">
 Se não existir, rode <span className="text-[color:var(--text-primary)]">npm run seed:demo-legal</span>.
 </p>
 <div className="mt-3">
 <Button asChild disabled={!proc}>
 <Link href={proc ? `/processos/${proc.id}` : "/dashboard"}>Abrir processo demo</Link>
 </Button>
 </div>
 </div>

 <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-4">
 <p className="text-xs font-medium uppercase text-muted-foreground">PASSO 2</p>
 <p className="mt-1 font-medium">Abrir despacho demo</p>
 <p className="mt-1 text-xs text-muted-foreground">
 Mostre texto extraído, chunks e seções detectadas (base verificável).
 </p>
 <div className="mt-3">
 <Button asChild disabled={!proc || !dispatchDoc}>
 <Link href={proc && dispatchDoc ? `/processos/${proc.id}/documentos/${dispatchDoc.id}` : "/dashboard"}>
 Abrir despacho
 </Link>
 </Button>
 </div>
 </div>
 </div>

 <div className="grid gap-3 md:grid-cols-3">
 <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-4">
 <p className="text-xs font-medium uppercase text-muted-foreground">PASSO 3</p>
 <p className="mt-1 font-medium">Perguntar “o que devo fazer”</p>
 <p className="mt-1 text-xs text-muted-foreground">
 Mostre resposta em blocos + confiança jurídica.
 </p>
 </div>
 <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-4">
 <p className="text-xs font-medium uppercase text-muted-foreground">PASSO 4</p>
 <p className="mt-1 font-medium">Ver fontes usadas</p>
 <p className="mt-1 text-xs text-muted-foreground">
 Tipo, seção, score e link “abrir” — sem alucinação.
 </p>
 </div>
 <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-4">
 <p className="text-xs font-medium uppercase text-muted-foreground">PASSO 5</p>
 <p className="mt-1 font-medium">Gerar manifestação → editar → exportar</p>
 <p className="mt-1 text-xs text-muted-foreground">
 Editor com autosave e DOCX/PDF.
 </p>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="text-base">Perguntas prontas</CardTitle>
 <p className="text-sm text-muted-foreground">
 Clique para abrir o chat já com a pergunta preenchida.
 </p>
 </CardHeader>
 <CardContent className="flex flex-wrap gap-2">
 {proc ? (
 <>
 <Button asChild variant="outline">
 <Link href={`/processos/${proc.id}?chat=1&q=${encodeURIComponent("O que devo fazer diante deste despacho?")}`}>
 O que devo fazer diante deste despacho?
 </Link>
 </Button>
 <Button asChild variant="outline">
 <Link href={`/processos/${proc.id}?chat=1&q=${encodeURIComponent("Há prazo ou providência imediata? Se houver, cite a fonte.")}`}>
 Há prazo ou providência imediata?
 </Link>
 </Button>
 <Button asChild variant="outline">
 <Link href={`/processos/${proc.id}?chat=1&q=${encodeURIComponent("Gere uma manifestação com base neste despacho.")}`}>
 Gere uma manifestação com base neste despacho
 </Link>
 </Button>
 </>
 ) : (
 <p className="text-sm text-muted-foreground">
 Nenhum processo demo encontrado. Rode <span className="text-[color:var(--text-primary)]">npm run seed:demo-legal</span>.
 </p>
 )}
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle className="text-base">O que mostrar (rápido)</CardTitle>
 </CardHeader>
 <CardContent className="space-y-2 text-sm text-muted-foreground">
 <p>
 - <span className="text-[color:var(--text-primary)]">Fontes usadas pela IA</span>: tipo (documento/lei/jurisprudência), seção e link “abrir”.
 </p>
 <p>
 - <span className="text-[color:var(--text-primary)]">Confiança jurídica</span>: label + justificativa curta.
 </p>
 <p>
 - <span className="text-[color:var(--text-primary)]">Guardrail</span>: se a base for insuficiente, o Lex inicia avisando e evita afirmar artigos/prazos.
 </p>
 </CardContent>
 </Card>
 </div>
 </AppShell>
 );
}

