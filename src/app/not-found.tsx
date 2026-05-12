import Link from "next/link";

export default function NotFound() {
 return (
 <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center text-foreground">
 <p className="text-sm font-medium text-[color:var(--violet-400)]">404</p>
 <h1 className="mt-2 text-2xl font-semibold tracking-tight">Página não encontrada</h1>
 <p className="mt-2 max-w-sm text-sm text-muted-foreground">
 O recurso pode ter sido movido ou você não tem acesso a este workspace.
 </p>
 <Link
 href="/dashboard"
 className="mt-8 rounded-lg border border-[color:var(--border-default)] bg-[var(--bg-elevated)] px-4 py-2 text-sm text-foreground transition-colors hover:bg-[var(--bg-active)]"
 >
 Ir ao dashboard
 </Link>
 </div>
 );
}
