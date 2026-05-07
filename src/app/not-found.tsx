import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-center text-zinc-100">
      <p className="text-sm font-medium text-violet-400">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Página não encontrada</h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-400">
        O recurso pode ter sido movido ou você não tem acesso a este workspace.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
      >
        Ir ao dashboard
      </Link>
    </div>
  );
}
