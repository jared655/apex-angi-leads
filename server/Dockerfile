FROM node:22-bookworm-slim

WORKDIR /app

# tsx + cross-env live in devDependencies but `npm start` needs them.
# Install the full lockfile (do not set NODE_ENV=production before npm ci).
COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY server/src ./src
COPY server/tsconfig.json ./

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
ENV DATABASE_PATH=/data/apex.sqlite
ENV PROXY_EXPO_WEB=0
ENV NODE_OPTIONS=--experimental-sqlite

# Fly volume is mounted at /data at runtime (root-owned). Stay root so SQLite can write.
RUN mkdir -p /data

EXPOSE 8080

CMD ["npm", "start"]
