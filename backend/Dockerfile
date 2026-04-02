FROM oven/bun:1.3.11-alpine

WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
RUN bun install --frozen-lockfile --production

COPY src ./src

RUN mkdir -p /app/data /app/uploads/images

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/app/data/blog.sqlite
ENV UPLOADS_ROOT=/app/uploads

EXPOSE 3001

CMD ["bun", "src/index.ts"]
