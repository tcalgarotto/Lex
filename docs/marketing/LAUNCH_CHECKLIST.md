# Checklist de lançamento — Landing e funil beta

Use este documento antes de apresentar a investidores ou abrir campanhas pagas.

## 1. Variáveis de ambiente (Vercel)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `NEXT_PUBLIC_APP_URL` | **Sim** | URL canônica (`https://seu-dominio.com`). Evita OG/canonical com localhost. |
| `DATABASE_URL` / `DIRECT_URL` | **Sim** | Postgres Supabase (pooler + session para migrate). |
| `RESEND_API_KEY` | Recomendada | Notificação por e-mail de novos leads. |
| `BETA_LEAD_NOTIFY_TO` | Recomendada | Destino do alerta (ex.: comercial@…). |
| `BETA_LEAD_NOTIFY_FROM` ou `EMAIL_FROM` | Recomendada | Remetente verificado no Resend. |
| `LEX_BETA_LEADS_ADMIN_EMAILS` | Opcional | E-mails com acesso ao painel além de OWNER. |
| `REDIS_URL` + `REDIS_REQUIRED=true` | **Sim (prod)** | Rate limit do formulário. |

Após alterar env na Vercel: **Redeploy** (env não atualiza deploy ativo).

Referência completa: `.env.production.example`, `docs/PRODUCTION_ENV_SETUP.md`.

## 2. Migration

```bash
npx prisma migrate deploy
```

Confirme que a migration `20260516140000_beta_lead_attribution_status` foi aplicada (campos UTM, `status`, `notes`, `contactedAt`).

## 3. Testar formulário (staging/produção)

1. Abra `/?utm_source=test&utm_medium=checklist&utm_campaign=launch`.
2. Preencha o formulário em `#beta` com consentimento marcado.
3. Confirme toast de sucesso e e-mail interno (se Resend configurado).
4. Tente enviar sem consentimento → deve falhar no cliente/API.
5. Preencha o campo honeypot via DevTools → API retorna 201 sem criar lead.

## 4. Consultar leads

- **UI:** `/settings/admin/beta-leads` (OWNER do workspace ou e-mail em `LEX_BETA_LEADS_ADMIN_EMAILS`).
- **API:** `GET /api/admin/beta-leads` (autenticado, mesma regra).

Atualize status (Novo → Contatado → Qualificado / Descartado) e notas internas na tabela.

## 5. OG image e metadata

- Abra `https://<dominio>/` e inspecione `<meta property="og:url">` — deve usar o domínio público.
- Teste compartilhamento: [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) ou preview do LinkedIn.
- Imagem: `/opengraph-image` (gerada pelo App Router).

## 6. Termos e Privacidade

- `/termos` e `/privacidade` acessíveis sem login.
- Privacidade menciona leads beta, UTM e contato comercial (sem certificações inexistentes).

## 7. Comandos antes do deploy

```bash
npm run lint
npm run typecheck
npm run build:clean
npm test -- src/lib/marketing src/app/api/marketing/beta-lead src/app/api/admin/beta-leads
npx playwright test tests/e2e/02-landing.spec.ts
```

## 8. Checklist Vercel / Supabase

- [ ] `NEXT_PUBLIC_APP_URL` = domínio final (não preview, salvo ambiente de staging dedicado).
- [ ] Migrations aplicadas no banco de produção.
- [ ] Resend: domínio verificado, `BETA_LEAD_NOTIFY_*` testado.
- [ ] Redis ativo (`RATE_LIMIT_FAIL_CLOSED` conforme `.env.production.example`).
- [ ] Rota pública apenas `POST /api/marketing/*` (listagem só em `/api/admin/*` autenticado).

## 9. Analytics

Eventos (Vercel Analytics, se habilitado):

- `landing_beta_form_view`
- `landing_beta_form_submit_success` / `_error`
- `landing_demo_click`

Falha de analytics **não** bloqueia o formulário.

## 10. Pendências legais / comerciais (decisão humana)

- [ ] Revisão jurídica final de Termos e Privacidade (CNPJ, DPO, endereço).
- [ ] SLA de resposta comercial ao lead (ex.: 3 dias úteis).
- [ ] Processo CRM/export se sair do painel interno.
- [ ] Política de retenção e exclusão de leads após X meses.
