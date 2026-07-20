# Eterniza Gestão — Front (Next.js 14) — build multi-stage
# ATENÇÃO: NEXT_PUBLIC_API_URL é embutido no bundle no BUILD.
# No EasyPanel, defina-o como BUILD ARG apontando para a URL PÚBLICA da API.
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG NEXT_PUBLIC_API_URL=http://localhost:3333/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# ---- imagem final (só o necessário pra rodar) ----
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# também no runtime (o rewrite /files do next.config lê NEXT_PUBLIC_API_URL)
ARG NEXT_PUBLIC_API_URL=http://localhost:3333/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
RUN npm ci --omit=dev

EXPOSE 3000
CMD ["npm", "start"]
