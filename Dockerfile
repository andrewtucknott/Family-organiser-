# Family Organiser — a self-contained image.
#
# The calendar lives in a SQLite file, so the only thing the container needs
# from the outside world is a volume to keep that file on:
#
#   docker build -t family-organiser .
#   docker run -d -p 3000:3000 -v family-data:/data --name family family-organiser

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Kept on a volume so the family's calendar survives image updates.
ENV DATABASE_PATH=/data/family-organiser.db

# The standalone output carries its own minimal node_modules, native SQLite
# binding included; static assets are not part of it and are copied separately.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 3000

CMD ["node", "server.js"]
