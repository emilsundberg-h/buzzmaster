# Database Management Scripts

Hantera users i Railway-databasen från din lokala dator.

## 📋 Förberedelser

Du behöver Railway's **publika DATABASE_URL**:

1. Gå till Railway Dashboard
2. Klicka på din **PostgreSQL** service
3. Klicka på **Connect** eller **Variables**
4. Kopiera **DATABASE_URL** (den publika - börjar med `postgresql://postgres:...railway.app:...`)

## 🔍 Lista alla users

```bash
cd /Users/emil/Documents/buzzmaster

DATABASE_URL="postgresql://postgres:EzHhTgxdpIStqgievJiOdMvwTrzbEBjm@trolley.proxy.rlwy.net:38229/railway" npx tsx scripts/list-users.ts
```

Detta visar:
- Username
- Clerk ID
- Score
- Antal spelare
- Antal rum
- Skapad datum

## 🗑️ Ta bort en user

```bash
cd /Users/emil/Documents/buzzmaster

DATABASE_URL="postgresql://postgres:EzHhTgxdpIStqgievJiOdMvwTrzbEBjm@trolley.proxy.rlwy.net:38229/railway" npx tsx scripts/delete-user.ts "TestUser"
```

Ersätt `"TestUser"` med:
- Username (t.ex. `"TestUser"`)
- Eller Clerk ID (t.ex. `"user_2abc123"`)

Scriptet tar automatiskt bort:
- ✓ User profile
- ✓ Owned players (Dream Eleven)
- ✓ Team och lineup
- ✓ Messages
- ✓ Pokes
- ✓ Presses
- ✓ Answers
- ✓ Room memberships
- ✓ Trophy wins

## ⚡ Snabb användning

För att slippa skriva hela DATABASE_URL varje gång:

1. Exportera URL:en som miljövariabel:

```bash
export DATABASE_URL="postgresql://postgres:EzHhTgxdpIStqgievJiOdMvwTrzbEBjm@trolley.proxy.rlwy.net:38229/railway"
```

2. Kör sedan bara:

```bash
npx tsx scripts/list-users.ts
npx tsx scripts/delete-user.ts "TestUser"
```

## ⚠️ Varningar

- **INGA BACKUPS**: Railway's free tier har ingen automatisk backup!
- **PERMANENT**: Users kan inte återställas efter borttagning
- **DUBBELKOLLA**: Lista users först, kontrollera namnet, sen ta bort

## 📝 Exempel

```bash
# 1. Lista alla users först
npx tsx scripts/list-users.ts

# 2. Hitta den du vill ta bort (t.ex. "SpamBot")
# 3. Ta bort användaren
npx tsx scripts/delete-user.ts "SpamBot"

# 4. Verifiera att den är borta
npx tsx scripts/list-users.ts
```

## 🔒 Säkerhet

- Dela **ALDRIG** DATABASE_URL publikt (den finns i detta dokument bara för dig)
- Om URL:en läcker - regenerera den i Railway Dashboard
- Använd dessa scripts bara från din egen dator
