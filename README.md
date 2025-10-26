# BuzzMaster - Interactive Buzzer Game

En komplett Next.js-app för interaktiva buzzer-tävlingar med realtidsuppdateringar via Server-Sent Events (SSE).

## Funktioner

### Användarvy

- **Profilsetup**: Välj unikt användarnamn och avatar från 20 fördefinierade alternativ
- **Buzzer-knapp**: Stor rund knapp med profilbild som spelar ljud vid tryck
- **Poängvisning**: Se dina aktuella poäng
- **Realtidsstatus**: Se om knappar är aktiva eller låsta

### Adminvy

- **Tävlingshantering**: Starta/avsluta tävlingsrundor
- **Knappkontroll**: Aktivera/inaktivera "klickbart läge" för deltagarknappar
- **Poängtavla**: Kolumnbaserad layout som visar alla deltagare och deras poäng
- **Manuell poängjustering**: Ge/justera poäng manuellt per deltagare
- **Live-feed**: Se vem som tryckte först i en aktiv runda
- **Vinnarhantering**: Automatisk poängtilldelning till först-tryckare

## Teknisk Stack

- **Next.js 15** med App Router, TypeScript, RSC + Client Components
- **Prisma ORM** för databashantering
- **Clerk** för autentisering (gratis nivå)
- **SQLite** för lokal utveckling, **PostgreSQL** för produktion
- **Server-Sent Events (SSE)** för realtidsuppdateringar
- **Zod** för server-validering
- **Tailwind CSS** för styling

## Installation

### Förutsättningar

- Node.js 22+
- Yarn package manager

### Lokal utveckling

1. **Klona och installera dependencies:**

```bash
git clone <repository-url>
cd buzzmaster
yarn install
```

2. **Konfigurera miljövariabler:**
   Skapa `.env.local` med följande innehåll:

```env
# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

# DB (dev)
DATABASE_URL="file:./dev.db"

# Admin-behörighet (vitlista, kommaseparerade e-postadresser)
ADMIN_EMAIL_ALLOWLIST="din.email@example.com"
```

3. **Sätt upp databas:**

```bash
yarn prisma migrate dev
```

4. **Starta utvecklingsserver:**

```bash
yarn dev
```

5. **Öppna applikationen:**

- Användarvy: http://localhost:3000
- Adminvy: http://localhost:3000/admin

### Produktion

1. **Konfigurera produktionsmiljövariabler:**

```env
# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx

# DB (prod)
DATABASE_URL="postgresql://user:password@host:port/database"

# Admin-behörighet
ADMIN_EMAIL_ALLOWLIST="admin1@example.com,admin2@example.com"
```

2. **Bygg och starta:**

```bash
yarn build
yarn start
```

## Databasstruktur

### Modeller

- **User**: Användarprofiler med unika användarnamn och avatarer
- **Competition**: Tävlingar med status (DRAFT/ACTIVE/ENDED)
- **Round**: Rundor inom tävlingar med knappstatus och vinnare
- **Press**: Knapptryckningar med tidsstämpel för vinnarberäkning

### Unika constraints

- `username` och `avatarKey` är unika per användare
- En press per användare per runda (`roundId_userId`)

## API Routes

### Användarrelaterade

- `POST /api/profile/setup` - Skapa/uppdatera profil
- `GET /api/avatars` - Hämta lediga avatarer
- `POST /api/press` - Registrera knapptryck

### Admin-relaterade

- `POST /api/competition` - Skapa tävling
- `POST /api/round/start` - Starta runda
- `POST /api/round/enable-buttons` - Aktivera knappar
- `POST /api/round/disable-buttons` - Inaktivera knappar
- `POST /api/round/end` - Avsluta runda
- `POST /api/users/update-score` - Manuell poängjustering

### Allmänna

- `GET /api/scoreboard` - Poängtavla
- `GET /api/stream` - SSE för realtidsuppdateringar

## Realtidsfunktioner (SSE)

Applikationen använder Server-Sent Events för realtidsuppdateringar:

- `round:started` - Ny runda startad
- `round:ended` - Runda avslutad med vinnare
- `buttons:enabled/disabled` - Knappstatus ändrad
- `press:new` - Ny knapptryckning
- `scores:updated` - Poäng uppdaterade

## Säkerhet

- **Autentisering**: Alla sidor kräver Clerk-inloggning
- **Admin-behörighet**: Admin-sidor kontrolleras mot e-postvitlista
- **API-validering**: Alla API-routes validerar Clerk-tokens
- **Unika constraints**: Förhindrar duplicerade användarnamn/avatarer

## Användning

### För användare

1. Logga in via Clerk
2. Välj unikt användarnamn och avatar
3. Vänta på att admin startar en runda
4. Tryck på din buzzer när knappar är aktiva!

### För admin

1. Logga in med e-postadress i `ADMIN_EMAIL_ALLOWLIST`
2. Gå till `/admin`
3. Starta en tävling och runda
4. Aktivera knappar när deltagarna är redo
5. Se live-feed av knapptryckningar
6. Avsluta runda för att korrigera vinnare
7. Justera poäng manuellt vid behov

## Utveckling

### Projektstruktur

```
src/
├── app/
│   ├── (user)/page.tsx          # Användarvy
│   ├── (admin)/admin/page.tsx    # Adminvy
│   └── api/                      # API routes
├── components/                   # React komponenter
├── lib/                         # Utilities (auth, db, sse)
└── middleware.ts               # Clerk middleware

public/
├── avatars/                     # Avatar-bilder (01.png - 20.png)
└── sounds/                      # Ljudfiler
```

### Kommandon

```bash
yarn dev          # Starta utvecklingsserver
yarn build        # Bygg för produktion
yarn start        # Starta produktionsserver
yarn prisma studio # Öppna Prisma Studio
yarn prisma migrate dev # Kör databasmigrationer
```

## Felsökning

### Vanliga problem

1. **"Environment variable not found"**: Kontrollera att `.env.local` finns och är korrekt konfigurerad
2. **"Unauthorized"**: Kontrollera Clerk-konfiguration och att användaren är inloggad
3. **"Forbidden"**: Kontrollera att admin-e-postadress finns i `ADMIN_EMAIL_ALLOWLIST`
4. **SSE-anslutning misslyckas**: Kontrollera att servern körs och att port 3000 är tillgänglig

### Loggar

Kontrollera konsolloggar för både klient och server för att diagnostisera problem.

## Licens

MIT License - se LICENSE-fil för detaljer.
