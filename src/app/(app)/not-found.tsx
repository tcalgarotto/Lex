import Link from "next/link";
import { Compass, FolderSearch, FileSearch, BookOpen } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * 404 dentro do grupo (app) — substitui o not-found global quando o usuário
 * já está autenticado. Mostra atalhos para as rotas centrais da jornada
 * jurídica (Casos, Documentos, Pesquisa, Início) em vez de só um "voltar".
 */
export default function AppNotFound() {
 return (
 <AppShell title="Página não encontrada">
 <div className="mx-auto max-w-3xl space-y-6">
 <Card className="flex flex-col items-center gap-3 p-8 text-center">
 <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[color:var(--violet-400)]">
 <Compass className="size-6" />
 </div>
 <p className="text-sm font-medium uppercase tracking-wide text-[color:var(--violet-400)]">
 404
 </p>
 <h1 className="text-xl font-semibold">Não encontramos esta página</h1>
 <p className="max-w-md text-sm text-muted-foreground">
 O recurso pode ter sido movido, arquivado ou pertence a outro workspace. Você pode
 voltar ao início ou ir direto para uma das áreas principais do Lex.
 </p>
 <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
 <Button asChild>
 <Link href="/dashboard">Ir ao início</Link>
 </Button>
 <Button asChild variant="outline">
 <Link href="/cases">Casos</Link>
 </Button>
 </div>
 </Card>

 <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
 <Shortcut
 href="/cases"
 icon={<FolderSearch className="size-4" />}
 title="Casos"
 description="Centro da jornada jurídica."
 />
 <Shortcut
 href="/documentos"
 icon={<FileSearch className="size-4" />}
 title="Documentos"
 description="Petições, contratos e provas."
 />
 <Shortcut
 href="/pesquisa-juridica"
 icon={<BookOpen className="size-4" />}
 title="Pesquisa jurídica"
 description="Legislação e fundamentos."
 />
 </div>
 </div>
 </AppShell>
 );
}

function Shortcut({
 href,
 icon,
 title,
 description,
}: {
 href: string;
 icon: React.ReactNode;
 title: string;
 description: string;
}) {
 return (
 <Link href={href} className="block">
 <Card className="h-full p-4 transition-colors hover:border-violet-500/30">
 <div className="flex items-center gap-2 text-sm font-medium text-foreground">
 <span className="text-violet-300">{icon}</span>
 {title}
 </div>
 <p className="mt-1 text-xs text-muted-foreground">{description}</p>
 </Card>
 </Link>
 );
}
