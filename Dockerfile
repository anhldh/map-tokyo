FROM oven/bun:alpine AS builder
WORKDIR /app

COPY package.json bun.lock* bun.lockb* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build
FROM oven/bun:alpine AS runner
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/package.json ./

ENV PORT=5173
EXPOSE 5173

CMD ["bun", "run", "server.ts"]