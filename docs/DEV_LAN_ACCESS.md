# Acesso ao Lex na rede local (dev)

Use quando quiser abrir o app no celular/tablet na mesma Wi‑Fi (`http://192.168.x.x:3000`), sem expor o servidor na internet.

## 1. Next.js — `allowedDevOrigins`

No Next 16, acessar o dev server por IP (diferente de `localhost`) bloqueia assets `/_next/*` até liberar o host.

No `.env` (ou `.env.local`):

```bash
# Host do seu PC na LAN — **sem porta** (só o IP ou hostname)
ALLOWED_DEV_ORIGINS=192.168.0.27
```

Vários hosts (vírgula):

```bash
ALLOWED_DEV_ORIGINS=192.168.0.27,192.168.0.28
```

Reinicie `npm run dev`. No terminal deve aparecer:

```text
[next.config] allowedDevOrigins: 192.168.0.27
```

Se ainda surgir `cross-origin blocked` ao assinar JustOS ou salvar WhatsApp pelo IP da LAN, confira `ALLOWED_DEV_ORIGINS` no `.env` e **reinicie** o dev server — o middleware agora honra essa variável em mutações POST/PATCH.

O valor só é aceito se for **IP privado** (10.x, 172.16–31.x, 192.168.x), `127.0.0.1` ou `localhost`. IPs públicos são ignorados.

Isso **não** afeta `next build` / produção na Vercel.

### WebSocket HMR (`webpack-hmr` recusado)

Com `allowedDevOrigins` correto, o Firefox deve conectar em `ws://192.168.0.27:3000/_next/webpack-hmr`. Sem isso, o hot reload falha, mas **login e navegação continuam funcionando** após recarregar a página (F5).

## 2. Supabase — Redirect URLs (OAuth)

Para Google/GitHub (e links de recuperação de senha) funcionarem pelo IP, no painel Supabase → **Authentication → URL Configuration**, adicione **apenas em dev**:

```text
http://192.168.0.27:3000/auth/callback
http://192.168.0.27:3000/**
```

Substitua pelo IP que aparece em `Network:` ao rodar `npm run dev`.

Não use IP de LAN em produção; mantenha `https://lex-navy.vercel.app/...` como hoje.

## 3. Login e-mail/senha

Não depende de redirect URL extra no Supabase, mas ainda precisa do passo 1 para o JavaScript do login carregar no IP.

## 4. Checklist rápido

1. `ALLOWED_DEV_ORIGINS` no `.env` = IP do terminal (`Network:`)
2. Reiniciar `npm run dev`
3. Abrir `http://<IP>:3000/login` no outro dispositivo
4. Se usar OAuth: redirect URLs no Supabase com o mesmo IP
