# Warmachine List Formatter Discord bot
# Build from repo root (compose sets context: ..) so ../formatter.js resolves.
FROM node:20-alpine

WORKDIR /app

# Shared formatter (imported by the bot as ../formatter.js)
COPY formatter.js ./

# Bot package + sources
COPY bot/package.json bot/package-lock.json ./bot/
WORKDIR /app/bot
RUN npm ci --omit=dev

COPY bot/ ./

# Secrets come from env_file / environment — never bake into the image
ENV NODE_ENV=production

CMD ["npm", "start"]
