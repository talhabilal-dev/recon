# Node 22 with pnpm installed directly. Corepack was the deploy failure: older
# Corepack caches pnpm 12 with a bin path pnpm no longer ships, which breaks the
# install step. Installing pnpm with npm sidesteps Corepack entirely.
FROM node:22-bookworm-slim

# Chromium is what puppeteer-core prints report PDFs with, plus fonts so the PDF
# is not rendered in boxes.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium

# Installed before any package.json is copied, so npm runs in a plain directory.
RUN npm install -g pnpm@12.15.0

WORKDIR /app

# Dependency layers first, so edits to source do not reinstall everything.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# web/ is its own project with its own lockfile, so it installs separately.
COPY web/package.json web/pnpm-lock.yaml ./web/
RUN pnpm --dir web install --frozen-lockfile

COPY . .
RUN pnpm build

# Report PDFs are written here; mount a volume over it or they vanish on restart.
RUN mkdir -p /app/storage/reports

ENV NODE_ENV=production
EXPOSE 3000

# The compiled server: no TypeScript stripping needed at runtime.
CMD ["node", "dist/server.js"]
