FROM oven/bun:1 AS base

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

COPY prisma ./prisma

RUN bunx prisma generate

COPY . .

RUN bun run build

FROM oven/bun:1

WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/prisma.config.ts ./prisma.config.ts

COPY package.json ./

EXPOSE 8000

CMD ["sh", "-c", "bunx prisma migrate deploy && bun run dist/server.js"]
