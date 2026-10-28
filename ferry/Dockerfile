# Built on the Home Assistant machine by the Supervisor (config.yaml has no image:). Two stages: the
# build stage compiles the PWA; the final image carries only dist/ and the one-file server, runs as the
# unprivileged `node` user, and has no package manager step at runtime.
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund
COPY . .
RUN npm run build && test -f dist/index.html && test -f dist/sw.js

FROM node:22-alpine
WORKDIR /app
COPY --from=build /src/dist ./dist
COPY server/server.mjs ./server/server.mjs
ENV NODE_ENV=production PORT=8099 DIST=/app/dist
USER node
EXPOSE 8099
CMD ["node", "server/server.mjs"]
