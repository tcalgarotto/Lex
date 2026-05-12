"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
 WorkspaceSwitcher,
 type WorkspaceOption,
} from "@/components/app/workspace-switcher";

export function AppTopbar({
 title,
 current,
 workspaces,
}: {
 title: string;
 current?: WorkspaceOption;
 workspaces?: WorkspaceOption[];
}) {
 const router = useRouter();

 async function signOut() {
 const supabase = createSupabaseBrowserClient();
 await supabase.auth.signOut();
 router.replace("/login");
 router.refresh();
 }

 return (
 <header className="lex-glass sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-[color:var(--glass-border)] px-6">
 <div className="flex min-w-0 items-center gap-3">
 {current && workspaces && workspaces.length > 0 ? (
 <WorkspaceSwitcher current={current} workspaces={workspaces} />
 ) : null}
 <h1 className="truncate text-sm font-medium text-foreground">{title}</h1>
 </div>
 <Button
 variant="ghost"
 size="sm"
 className="gap-2 text-muted-foreground"
 onClick={() => void signOut()}
 >
 <LogOut className="size-4" />
 Sair
 </Button>
 </header>
 );
}
