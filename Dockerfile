# Production Docker image for Buzzmaster
# Uses Node 20 to match Next.js 16 krav

FROM node:20-alpine AS base

# Install OS dependencies
RUN apk add --no-cache libc6-compat

WORKDIR /app
ENV NODE_ENV=production

# Install dependencies först (bättre cache)
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false

# Kopiera resten av koden
COPY . .

# Generera Prisma Client
RUN npx prisma generate

# Bygg Next.js appen
RUN yarn build

# Exponera porten som Next använder
EXPOSE 3000

# Starta appen
CMD ["yarn", "start"]
