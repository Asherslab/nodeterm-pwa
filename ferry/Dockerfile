# Built by GitHub Actions (.github/workflows/docker-publish.yml) into one multi-arch image on GHCR, which
# Home Assistant pulls; nothing is built on the Pi. Two stages: the build stage compiles the PWA on the
# runner's OWN platform ($BUILDPLATFORM: dist/ is platform-free), and the final stage only COPYs, so the
# arm64 image needs no emulation. A RUN in the final stage would break that: the arm64 build would fail with
# "exec format error" (add QEMU then, knowingly). The image runs as the unprivileged `node` user.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
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
