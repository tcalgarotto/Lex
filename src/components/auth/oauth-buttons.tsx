"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const GoogleIcon = () => (
 <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
 <path
 fill="#FFC107"
 d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
 />
 <path
 fill="#FF3D00"
 d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
 />
 <path
 fill="#4CAF50"
 d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 34.7 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
 />
 <path
 fill="#1976D2"
 d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.6l6.2 5.2C41.4 36 44 30.5 44 24c0-1.2-.1-2.4-.4-3.5z"
 />
 </svg>
);

const GitHubIcon = () => (
 <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
 <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.92.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17a10.95 10.95 0 0 1 5.74 0c2.19-1.48 3.15-1.17 3.15-1.17.62 1.58.23 2.75.11 3.04.73.8 1.18 1.82 1.18 3.07 0 4.4-2.7 5.36-5.27 5.65.41.36.78 1.06.78 2.13v3.16c0 .31.21.67.79.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
 </svg>
);

type Provider = "google" | "github";

export function OAuthButtons({ next = "/dashboard" }: { next?: string }) {
 const [pending, setPending] = useState<Provider | null>(null);

 async function signIn(provider: Provider) {
 setPending(provider);
 try {
 const supabase = createSupabaseBrowserClient();
 const { error } = await supabase.auth.signInWithOAuth({
 provider,
 options: {
 redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
 },
 });
 if (error) {
 toast.error(error.message);
 setPending(null);
 }
 // Em sucesso o navegador redireciona; não mexe em pending.
 } catch (err) {
 const msg = err instanceof Error ? err.message : String(err);
 toast.error(msg);
 setPending(null);
 }
 }

 return (
 <div className="space-y-2">
 <div className="relative my-4">
 <div className="absolute inset-0 flex items-center">
 <span className="w-full border-t border-[color:var(--border-default)]" />
 </div>
 <div className="relative flex justify-center text-xs">
 <span className="bg-[color:var(--surface-elevated)]/95 backdrop-blur-xl px-2 text-muted-foreground">ou continue com</span>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-2">
 <Button
 type="button"
 variant="outline"
 className="border-[color:var(--border-default)] bg-white/5"
 onClick={() => void signIn("google")}
 disabled={pending !== null}
 >
 <GoogleIcon />
 <span className="ml-2">Google</span>
 </Button>
 <Button
 type="button"
 variant="outline"
 className="border-[color:var(--border-default)] bg-white/5"
 onClick={() => void signIn("github")}
 disabled={pending !== null}
 >
 <GitHubIcon />
 <span className="ml-2">GitHub</span>
 </Button>
 </div>
 </div>
 );
}
