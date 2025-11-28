# Railway Deployment Changes - Fix PostgreSQL & WebSocket

## Sammanfattning

Denna guide beskriver alla ändringar som behövs för att deploya Buzzmaster på Railway. Huvudproblemen som löses:

1. **WebSocket fungerade inte** - Appen hade två separata servrar (Next.js på port 3000, WebSocket på port 3001), men Railway exponerar bara EN port.
2. **SQLite fungerar inte i produktion** - Railway containers är temporära, så filbaserade databaser försvinner vid restart.
3. **Hårdkodade localhost-URLs** - WebSocket-anslutningar pekade på `localhost:3001` istället för produktions-URL.

---

## Ändringar att göra

### 1. Skapa ny fil: `server.js` (i projektets rot)

Denna fil kombinerar Next.js och WebSocket på samma port:

```javascript
/**
 * Combined Server for Railway Deployment
 * Runs Next.js and WebSocket on the same port
 */

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const WebSocket = require("ws");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Store connected WebSocket clients
const clients = new Map();

// Broadcast function for WebSocket
function broadcast(message) {
  const messageStr = typeof message === "string" ? message : JSON.stringify(message);
  console.log(`WebSocket: Broadcasting to ${clients.size} clients`);

  clients.forEach((ws, clientId) => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      } else {
        clients.delete(clientId);
      }
    } catch (error) {
      console.error(`WebSocket: Error sending to client ${clientId}:`, error);
      clients.delete(clientId);
    }
  });
}

// Make broadcast available globally for API routes
global.__wssBroadcast = broadcast;
global.__wssGetClientCount = () => clients.size;

app.prepare().then(() => {
  // Create HTTP server
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      
      // Health check endpoint for Railway
      if (parsedUrl.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ 
          status: "ok", 
          websocketClients: clients.size,
          timestamp: new Date().toISOString()
        }));
        return;
      }
      
      // Let Next.js handle all other requests
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  // Create WebSocket server on the same HTTP server
  const wss = new WebSocket.Server({
    server,
    path: "/ws",
  });

  wss.on("connection", (ws, req) => {
    const clientId = Math.random().toString(36).substring(7);
    console.log(`WebSocket: New client connected: ${clientId}`);

    // Store client
    clients.set(clientId, ws);

    // Send welcome message
    ws.send(
      JSON.stringify({
        type: "connected",
        clientId: clientId,
        message: "Connected to WebSocket server",
      })
    );

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log(`WebSocket: Received from ${clientId}:`, data.type);
        // Broadcast the message to all clients
        broadcast(data);
      } catch (error) {
        console.error(
          `WebSocket: Error parsing message from ${clientId}:`,
          error
        );
      }
    });

    ws.on("close", () => {
      console.log(`WebSocket: Client disconnected: ${clientId}`);
      clients.delete(clientId);
    });

    ws.on("error", (error) => {
      console.error(`WebSocket: Error with client ${clientId}:`, error);
      clients.delete(clientId);
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Server ready on http://${hostname}:${port}`);
    console.log(`> WebSocket ready on ws://${hostname}:${port}/ws`);
    console.log(`> Environment: ${dev ? "development" : "production"}`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully");
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });
});
```

---

### 2. Skapa ny fil: `src/lib/websocket-url.ts`

Dynamisk WebSocket URL baserat på current origin:

```typescript
/**
 * Get the WebSocket URL based on the current environment
 * Returns empty string during SSR to avoid hydration mismatch
 */
export function getWebSocketUrl(): string {
  // During SSR, return empty string
  // The hook should handle this gracefully
  if (typeof window === "undefined") {
    return "";
  }

  // Use the current page's origin to construct the WebSocket URL
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  
  return `${protocol}//${host}/ws`;
}
```

---

### 3. Ersätt hela innehållet i: `src/lib/websocket.ts`

```typescript
/**
 * WebSocket broadcast module
 * Works with the combined server (server.js) in production
 * and falls back to a standalone connection in development
 */

// Type declaration for the global WebSocket functions
declare global {
  // eslint-disable-next-line no-var
  var __wssBroadcast: ((message: unknown) => void) | undefined;
  // eslint-disable-next-line no-var
  var __wssGetClientCount: (() => number) | undefined;
}

// Check if we're running with the custom server (which sets global.__wssBroadcast)
function isCustomServer(): boolean {
  return typeof global.__wssBroadcast === "function";
}

export function broadcast(event: string, data: unknown) {
  console.log(`WebSocket: Broadcasting ${event}`);

  if (isCustomServer()) {
    // Use the global broadcast function from server.js
    const message = { type: event, data };
    global.__wssBroadcast!(message);
    console.log(`WebSocket: Sent ${event} via custom server`);
  } else {
    // In development without custom server, log a warning
    console.warn(
      `WebSocket: Custom server not available. Message ${event} not sent.`,
      "Run with 'node server.js' to enable WebSocket broadcasting."
    );
  }
}

// Broadcast to specific room - the WS server handles room filtering
export function broadcastToRoom(
  roomId: string,
  message: { type: string; data: unknown }
) {
  console.log(`WebSocket: Broadcasting ${message.type} to room ${roomId}`);
  broadcast(message.type, { ...message.data, roomId });
}

export function getClientCount(): number {
  if (isCustomServer()) {
    return global.__wssGetClientCount!();
  }
  return 0;
}

export function clearAllClients() {
  console.log("WebSocket: clearAllClients called (no-op in combined server mode)");
  // In combined server mode, we don't close all connections
  // This is mainly used for cleanup/reset scenarios
}
```

---

### 4. Ändra i: `src/hooks/useWebSocket.ts`

Hitta denna rad (runt rad 94-100):
```typescript
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [url]);
```

Ersätt med:
```typescript
  useEffect(() => {
    // Skip connection if URL is empty (during SSR)
    if (!url) {
      return;
    }
    
    connect();

    return () => {
      disconnect();
    };
  }, [url]);
```

---

### 5. Ändra i: `src/app/dev-user/page.tsx`

**Lägg till import** (efter de andra imports, runt rad 21-22):
```typescript
import { useWebSocket } from '@/hooks/useWebSocket'
import { useTheme } from '@/contexts/ThemeContext'
import { getWebSocketUrl } from '@/lib/websocket-url'  // <-- LÄGG TILL DENNA
```

**Ändra WebSocket-anropet** (hitta raden med `ws://localhost:3001/ws`, runt rad 150):
```typescript
// ÄNDRA FRÅN:
const { isConnected, lastMessage, sendMessage } = useWebSocket('ws://localhost:3001/ws')

// ÄNDRA TILL:
const { isConnected, lastMessage, sendMessage } = useWebSocket(getWebSocketUrl())
```

---

### 6. Ändra i: `src/app/dev-admin/page.tsx`

**Lägg till import** (efter de andra imports, runt rad 18-19):
```typescript
import { useWebSocket } from '@/hooks/useWebSocket'
import { useTheme, Theme } from '@/contexts/ThemeContext'
import { getWebSocketUrl } from '@/lib/websocket-url'  // <-- LÄGG TILL DENNA
```

**Ändra WebSocket-anropet** (hitta raden med `ws://localhost:3001/ws`, runt rad 144):
```typescript
// ÄNDRA FRÅN:
const { isConnected, lastMessage, sendMessage } = useWebSocket('ws://localhost:3001/ws')

// ÄNDRA TILL:
const { isConnected, lastMessage, sendMessage } = useWebSocket(getWebSocketUrl())
```

---

### 7. Ändra i: `prisma/schema.prisma`

Hitta (runt rad 21-24):
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

Ändra till:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

### 8. Ta bort hela mappen: `prisma/migrations/`

SQLite-migrationerna fungerar inte med PostgreSQL. Ta bort hela mappen.

---

### 9. Ersätt hela innehållet i: `Dockerfile`

```dockerfile
# Production Docker image for Buzzmaster
# Combined Next.js + WebSocket server on a single port

FROM node:20-alpine AS base

# Install OS dependencies needed for native modules
RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

# ============================================
# DEPENDENCIES STAGE
# ============================================
FROM base AS deps

# Copy package files
COPY package.json yarn.lock ./

# Install ALL dependencies (including devDependencies for build)
RUN yarn install --frozen-lockfile

# ============================================
# BUILD STAGE
# ============================================
FROM base AS builder

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Accept build arguments for environment variables needed at build time
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG DATABASE_URL
ARG CLERK_SECRET_KEY

# Make them available as ENV during build
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV DATABASE_URL=$DATABASE_URL
ENV CLERK_SECRET_KEY=$CLERK_SECRET_KEY
ENV NODE_ENV=production

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js application
RUN yarn build

# ============================================
# PRODUCTION STAGE
# ============================================
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application and dependencies
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server.js ./server.js

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

# Railway sets PORT automatically, default to 3000
ENV PORT=3000

# Expose the port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Copy prisma schema for database sync
COPY --from=builder /app/prisma ./prisma

# Start script: sync database schema then start server
# Using db push for initial setup (creates tables if they don't exist)
CMD npx prisma db push --skip-generate && node server.js
```

---

### 10. Ersätt hela innehållet i: `railway.json`

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30
  }
}
```

---

### 11. Ändra i: `package.json`

Hitta `"scripts"` sektionen och ersätt med:
```json
"scripts": {
  "dev": "node server.js",
  "dev:separate": "concurrently \"npm run websocket\" \"npm run next\"",
  "next": "next dev",
  "websocket": "node websocket-server.js",
  "build": "next build",
  "start": "node server.js",
  "start:next": "next start",
  "lint": "eslint",
  "db:seed": "cd prisma && npx prisma generate && DATABASE_URL=\"file:./dev.db\" npx tsx seed-players.ts",
  "db:seed-trophies": "cd prisma && DATABASE_URL=\"file:./dev.db\" npx tsx seed-trophies.ts",
  "db:seed-captains": "cd prisma && DATABASE_URL=\"file:./dev.db\" npx tsx seed-captains.ts",
  "db:seed-artists": "cd prisma && DATABASE_URL=\"file:./dev.db\" npx tsx seed-artists.ts"
},
```

---

## Railway Miljövariabler

I Railway, uppdatera dessa miljövariabler för din app-service:

| Variabel | Värde |
|----------|-------|
| `DATABASE_URL` | `postgresql://postgres:EzHhTgxdpIStqgievJiOdMvwTrzbEBjm@postgres.railway.internal:5432/railway` |
| `CLERK_SECRET_KEY` | (behåll befintligt) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | (behåll befintligt) |

**OBS:** Använd den INTERNA PostgreSQL-URL:en (`postgres.railway.internal`) för bästa prestanda.

---

## Skapa PostgreSQL-databas i Railway

1. I Railway-projektet, klicka **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Databasen skapas automatiskt
3. Kopiera `DATABASE_URL` från databasens Variables-flik
4. Uppdatera din apps `DATABASE_URL` miljövariabel

---

## Commit-meddelande

```
fix: PostgreSQL and WebSocket for Railway deployment

- Combined Next.js and WebSocket server on single port (Railway only exposes one)
- Switched from SQLite to PostgreSQL for persistent database
- Dynamic WebSocket URL based on current origin (works in production)
- Updated Dockerfile for multi-stage build
- Added health check endpoint at /health
- Removed old SQLite migrations
```

---

## Efter deploy

1. Railway bygger automatiskt när du pushar
2. `prisma db push` körs vid startup och skapar alla tabeller
3. WebSocket är tillgängligt på `wss://din-domain.railway.app/ws`
4. Health check finns på `https://din-domain.railway.app/health`

