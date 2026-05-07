## syntax=docker/dockerfile:1.7

# ============================================================================
# Lex — imagem de produção multi-stage.
#
# Stages:
#   - deps:       instala devDependencies (precisa pra build) com cache de npm.
#   - builder:    gera Prisma Client + roda `next build` (Next standalone).
#   - runner:     imagem mínima com apenas o output standalone + .next/static.
#
# Tamanho final esperado: ~200-250 MB (alpine + node + standalone bundle).
# ============================================================================

ARG NODE_VERSION=22.12.0

# ----------------------------------------------------------------------------
# 1) deps — instala dependências pra build
# ----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund --prefer-offline

# ----------------------------------------------------------------------------
# 2) builder — gera Prisma Client e build Next
# ----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variáveis públicas Next são embutidas no bundle no momento do build.
# Em CI/Vercel passe via --build-arg ou docker compose `args`.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_TELEMETRY_DISABLED=1

# `prisma generate` requer schema; build chama internamente também,
# mas executamos cedo para falhar rápido em caso de schema inválido.
RUN npx prisma generate
RUN npm run build

# Limpa cache de build (mantém só artefatos)
RUN rm -rf .next/cache

# ----------------------------------------------------------------------------
# 3) runner — imagem final, mínima, non-root
# ----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runner
RUN apk add --no-cache libc6-compat openssl wget
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Usuário sem privilégio para rodar o server
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copia apenas o standalone output + assets estáticos + Prisma engines
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma          ./prisma
# Engines do Prisma já vêm dentro de node_modules/@prisma/client em standalone,
# mas garantimos o schema pra `prisma migrate deploy` em entrypoint custom.

USER nextjs

EXPOSE 3000

# Healthcheck nativo do Docker — usa /api/ready (liveness puro).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/ready || exit 1

CMD ["node", "server.js"]
