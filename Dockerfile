# Production Docker image for Buzzmaster
# Uses Node 20 to match Next.js 16 krav

FROM node:20-alpine AS base

# Install OS dependencies
RUN apk add --no-cache libc6-compat

WORKDIR /app
ENV NODE_ENV=production

# Accept build arguments for environment variables
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG DATABASE_URL
ARG CLERK_SECRET_KEY

# Make them available as ENV during build
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV DATABASE_URL=$DATABASE_URL
ENV CLERK_SECRET_KEY=$CLERK_SECRET_KEY

# Install dependencies först (bättre cache)
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false

# Kopiera resten av koden
COPY . .

# Generera Prisma Client
RUN npx prisma generate

# Bygg Next.js appen (nu har vi Clerk-nycklarna)
RUN yarn build

# Exponera porten som Next använder
EXPOSE 3000

# Starta appen
CMD ["yarn", "start"]
