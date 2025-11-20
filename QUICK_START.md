# Quick Start Guide - Dream Eleven

## Problem 1: "Inga trofér tillgängliga"

Du behöver seeda troferna i databasen.

### Alternativ 1: Använd setup-scriptet (enklast)
```bash
./seed-all.sh
```

### Alternativ 2: Manuellt

**1. Seed spelare (om inte redan gjort):**
```bash
cd prisma
DATABASE_URL="file:./dev.db" npx tsx seed-players.ts
cd ..
```

**2. Seed trofér:**

Antingen via API (kräver att servern körs):
```bash
curl -X POST http://localhost:3000/api/trophies/seed
```

Eller via admin-panelen:
1. Gå till `/admin` eller `/dev-admin`
2. Kör seed trophy endpoint

## Problem 2: "Var hittar jag min drömelva?"

✅ **Fixat!** Jag har lagt till en grön knapp "⚽ My Dream Eleven" på dev-user sidan.

### Hur du använder Dream Eleven:

1. **Första gången:**
   - Klicka på "⚽ My Dream Eleven" knappen
   - Klicka "Get Starting Pack"
   - Du får 15 svenska legender
   - Ett lag skapas automatiskt i 4-4-2 formation

2. **Hantera ditt lag:**
   - Klicka "Edit Team" för att ändra
   - Välj formation (4-4-2, Diamond, 4-3-3, 3-4-3)
   - Klicka på en position för att välja spelare
   - Spara ditt lag

3. **Vinna fler spelare:**
   - Spelare tilldelas automatiskt när du vinner
   - 83 fotbollsspelare totalt att samla på
   - Bygg ditt ultimata drömlag!

## Direktlänkar

- **Dream Eleven:** `http://localhost:3000/dream-eleven`
- **Dev User:** `http://localhost:3000/dev-user`
- **Admin:** `http://localhost:3000/dev-admin`

## Test att Dream Eleven fungerar

1. Besök `/dream-eleven`
2. Du bör se antingen:
   - "Get Starting Pack" knapp (första gången)
   - Ditt lag på en fotbollsplan (om du redan har ett lag)

## Felsökning

**"No trophies available"**
→ Kör trophy seed (se ovan)

**"Can't find Dream Eleven page"**
→ Den gröna knappen "⚽ My Dream Eleven" finns nu på dev-user sidan

**Ser ingen startingpack**
→ Kolla att player seed kördes: `prisma/seed-players.ts`

**Database fel**
→ Kör migration igen:
```bash
cd prisma
DATABASE_URL="file:./dev.db" npx prisma migrate dev
```
