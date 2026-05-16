import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

const PUBLIC_PREFIXES = ["/", "/pricing", "/manifesto", "/termos", "/privacidade", "/docs"];
const AUTH_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
] as const;

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith("/auth/callback")) return true;
  if (pathname.startsWith("/api/inngest")) return true;
  if (pathname.startsWith("/api/health")) return true;
  if (pathname.startsWith("/api/ready")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  // /invite/<token> precisa ser acessível pra disparar o login com next=
  // (a página em si exige login internamente; só não queremos que o middleware
  // bloqueie antes do componente decidir).
  if (pathname.startsWith("/invite/")) return true;
  if (PUBLIC_PREFIXES.some((p) => (p === "/" ? pathname === "/" : pathname.startsWith(p))))
    return true;
  if (AUTH_ROUTES.some((p) => pathname.startsWith(p))) return true;
  return false;
}

/**
 * Headers de segurança aplicados a TODAS as respostas do app.
 * - CSP intencionalmente permite `'unsafe-inline'` em styles (Tailwind/Tiptap) e
 *   `'unsafe-eval'` em dev (Turbopack). Apertar no futuro com nonce.
 * - HSTS só em produção (não queremos pinagem em http://localhost).
 */
function applySecurityHeaders(response: NextResponse, request: NextRequest): void {
  const isProd = process.env["NODE_ENV"] === "production";
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "";
  const supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : "";

  // Nonce para CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const connectSrc = [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    supabaseHost ? `https://${supabaseHost}` : "",
    "https://api.deepseek.com",
    "https://api.deepinfra.com",
    "https://api.openai.com",
    "https://api.anthropic.com",
    "https://openrouter.ai",
    "https://*.qdrant.io",
    "https://*.langfuse.com",
    "https://o.ingest.sentry.io",
  ]
    .filter(Boolean)
    .join(" ");

  const csp = [
    "default-src 'self'",
    `connect-src ${connectSrc}`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProd ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'self'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("x-nonce", nonce);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );
  if (isProd) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  // Origin check: para mutations cross-origin retornamos 403 se Origin não bate com host.
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    if (origin) {
      const url = new URL(request.url);
      try {
        const originHost = new URL(origin).host;
        if (originHost !== url.host) {
          response.headers.set("X-Origin-Mismatch", "1");
        }
      } catch {
        // origin malformado — ignora
      }
    }
  }
}

export async function proxy(request: NextRequest) {
  // Origin validation cedo: bloquear mutações cross-origin que não vêm do próprio host.
  if (request.method !== "GET" && request.method !== "HEAD") {
    const origin = request.headers.get("origin");
    if (origin) {
      try {
        const url = new URL(request.url);
        const originHost = new URL(origin).host;
        // Permite quando vem do mesmo host. Cross-origin mutations são bloqueadas (CSRF guard).
        if (originHost !== url.host) {
          // Exceção: webhooks externos que não usam cookie (ex.: Inngest, Stripe) precisam
          // estar abaixo de `/api/inngest`, `/api/stripe/webhook`, etc., e usar verificação
          // de assinatura própria — aqui só bloqueamos mutações que tentariam sequestrar a sessão.
          const path = url.pathname;
          const isWebhook =
            path.startsWith("/api/inngest") || path.startsWith("/api/stripe/webhook");
          if (!isWebhook) {
            return new NextResponse(JSON.stringify({ error: "cross-origin blocked" }), {
              status: 403,
              headers: { "content-type": "application/json" },
            });
          }
        }
      } catch {
        // url/origin malformado — segue
      }
    }
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as never),
          );
        },
      },
    },
  );

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (err) {
    console.warn("[middleware] supabase.auth.getUser falhou:", (err as Error).message);
  }
  // Fallback: alguns browsers/estados devolvem user null em getUser() mas sessão válida em cookie
  // (ex.: refresh pendente). Evita 401 falso em POST /api/* para utilizador com sessão ativa na UI.
  if (!user) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      user = sessionData.session?.user ?? null;
    } catch (err) {
      console.warn("[middleware] supabase.auth.getSession falhou:", (err as Error).message);
    }
  }

  const pathname = request.nextUrl.pathname;

  // /api/* exigem auth, exceto webhooks/health
  if (pathname.startsWith("/api")) {
    const isPublicApi =
      pathname.startsWith("/api/inngest") ||
      pathname.startsWith("/api/health") ||
      pathname.startsWith("/api/ready") ||
      pathname.startsWith("/api/marketing/") ||
      pathname.startsWith("/api/stripe/webhook");
    if (!isPublicApi && !user) {
      const res = NextResponse.json(
        {
          error: "Sessão não encontrada ou expirou. Entre novamente para continuar.",
          code: "SESSION_REQUIRED",
        },
        { status: 401 },
      );
      // Supabase pode ter atualizado cookies em `response` durante getUser();
      // devolver 401 sem estes Set-Cookie deixa o browser com sessão stale e 401 em loop.
      for (const c of response.cookies.getAll()) {
        res.cookies.set(c.name, c.value);
      }
      applySecurityHeaders(res, request);
      return res;
    }
    applySecurityHeaders(response, request);
    return response;
  }

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(url);
    applySecurityHeaders(redirect, request);
    return redirect;
  }

  if (
    user &&
    (pathname === "/login" ||
      pathname === "/register" ||
      pathname === "/forgot-password")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    const redirect = NextResponse.redirect(url);
    applySecurityHeaders(redirect, request);
    return redirect;
  }

  applySecurityHeaders(response, request);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
