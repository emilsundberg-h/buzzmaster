# 🚂 Railway Deployment Guide

## Varför Railway?
- ✅ Stödjer WebSocket (ingen Pusher behövs!)
- ✅ Stödjer SQLite med persistent storage
- ✅ $5 gratis kredit/månad
- ✅ Enklare än Vercel för fullstack-appar

## Steg 1: Installera Railway CLI

```bash
npm i -g @railway/cli
```

## Steg 2: Logga in

```bash
railway login
```

Detta öppnar en webbläsare där du loggar in med GitHub.

## Steg 3: Initiera projekt

```bash
cd /Users/emil/Documents/buzzmaster
railway init
```

Välj:
- **Create a new project**
- Ge projektet ett namn (t.ex. "buzzmaster")

## Steg 4: Lägg till miljövariabler

```bash
# Clerk
railway variables set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_dXB3YXJkLWdpcmFmZmUtMzAuY2xlcmsuYWNjb3VudHMuZGV2JA"
railway variables set CLERK_SECRET_KEY="sk_test_QwHhReU8mrDvckyesKLLUopq6LESPfYERr8hnSe9pK"

# Database (SQLite - Railway hanterar detta automatiskt)
railway variables set DATABASE_URL="file:./dev.db"

# Admin
railway variables set ADMIN_EMAIL_ALLOWLIST="emil.a.sundberg+admin@gmail.com"
railway variables set NEXT_PUBLIC_ADMIN_EMAIL_ALLOWLIST="emil.a.sundberg+admin@gmail.com"

# Dev mode
railway variables set DEV_MODE="false"
```

## Steg 5: Lägg till Volume för SQLite

Railway behöver en persistent volume för SQLite-databasen:

1. Gå till Railway Dashboard → ditt projekt
2. Klicka på **+ New** → **Volume**
3. Mount path: `/app/prisma`
4. Size: 1GB (mer än tillräckligt)

## Steg 6: Deploy!

```bash
railway up
```

Det är allt! Railway bygger och deployer automatiskt.

## Steg 7: Få din URL

```bash
railway domain
```

Eller gå till Railway Dashboard och klicka på **Generate Domain**.

## Steg 8: Kör migrations (första gången)

Efter första deployen, kör migrations:

```bash
railway run npx prisma migrate deploy
```

## Steg 9: (Valfritt) Seed data

```bash
railway run yarn db:seed
railway run yarn db:seed-trophies
railway run yarn db:seed-captains
railway run yarn db:seed-artists
```

## Troubleshooting

### Problem: WebSocket fungerar inte
**Lösning**: Railway stödjer WebSocket automatiskt, inget behöver göras!

### Problem: Database reset vid varje deploy
**Lösning**: Se till att Volume är korrekt monterad på `/app/prisma`

### Problem: "Module not found"
**Lösning**: Kör `railway run yarn install`

## Uppdatera Clerk för produktion

1. Gå till Clerk Dashboard → **Domains**
2. Lägg till din Railway-domän (t.ex. `buzzmaster.up.railway.app`)
3. Uppdatera **Redirect URLs** om nödvändigt

## Automatisk deployment från GitHub

1. Gå till Railway Dashboard → ditt projekt
2. Klicka på **Settings** → **Service**
3. Anslut GitHub repository
4. Välj branch (t.ex. `main`)
5. Nu deployas automatiskt vid varje push!

---

**Du är klar! 🎉**

Railway URL: `https://buzzmaster.up.railway.app` (eller liknande)
