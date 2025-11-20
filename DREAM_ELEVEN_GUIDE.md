# Dream Eleven - Implementation Guide

## Overview

Dream Eleven is a feature that allows users to build and manage their own football dream team with legendary players. Users receive a starting pack and can win additional players as awards during gameplay.

## Features Implemented

### 1. Database Schema
- **Player Model**: Stores all footballers (and future festival/film awards)
  - Positions: GK (Goalkeeper), DEF (Defender), MID (Midfielder), FWD (Forward)
  - Categories: STARTER (starting pack) or AWARD (won during games)
  - Types: FOOTBALLER (currently), FESTIVAL, FILM (for future expansion)

- **UserPlayer Model**: Junction table tracking which players each user owns

- **UserTeam Model**: Stores user's selected formation

- **TeamPosition Model**: Stores the 11 players in specific positions in the team

### 2. Formations Available
- **4-4-2**: Classic formation with 4 defenders, 4 midfielders, 2 forwards
- **4-4-2 Diamond**: Diamond midfield variant
- **4-3-3**: Attacking formation with 3 forwards
- **3-4-3**: Ultra-attacking with 3 defenders, 4 midfielders, 3 forwards

### 3. Player Collections
- **Starting Pack**: 15 Swedish football legends (in `/public/starting_pack/`)
  - 1 Goalkeeper (Hedman)
  - 6 Defenders
  - 5 Midfielders
  - 3 Forwards

- **Award Players**: 68 international football legends (in `/public/footballers/`)
  - Won during gameplay as rewards

### 4. API Endpoints

#### Team Management
- `GET /api/team` - Get user's current team
- `POST /api/team/formation` - Update formation
- `POST /api/team/lineup` - Update team lineup (all 11 players)

#### Player Management
- `GET /api/players/owned` - Get all players owned by user
- `GET /api/players/all` - Get all available players (admin)
- `POST /api/players/initialize` - Give starting pack to new user
- `POST /api/players/award` - Award random footballer to user
- `PUT /api/players/award` - Award specific player to user

### 5. UI Components

#### FormationDisplay
Displays the team in proper football formation layout on a football pitch.
- Shows player photos and names
- Position-based layout matching formation
- Visual representation with grass field and player cards

#### TeamManager
Full team management interface:
- Formation selector
- Drag-and-drop style player selection
- Position filtering
- Validation (ensures correct positions)
- Real-time preview

#### Dream Eleven Page (`/dream-eleven`)
Main page where users can:
- View their current team
- Edit and rearrange players
- See their player collection stats
- Initialize starting pack (first time)

## Integration with Existing Game Systems

### Awarding Players as Rewards

Use the helper functions in `/src/lib/player-awards.ts`:

```typescript
import { awardRandomFootballer } from '@/lib/player-awards';

// When user wins a round/trophy
async function handleRoundWin(userId: string) {
  const result = await awardRandomFootballer(userId);
  
  if (result) {
    // Show notification: "You won {result.player.name}!"
    // result.isNew indicates if it's a new player or duplicate
  }
}
```

#### Available Functions:

1. **awardRandomFootballer(userId)**
   - Awards a random footballer from the award pool
   - Prefers players user doesn't own
   - Returns: `{ player, isNew }`

2. **awardSpecificPlayer(userId, playerId)**
   - Award a specific player by ID
   - Useful for special achievements

3. **awardPlayerByPosition(userId, position)**
   - Award a random player of specific position
   - Positions: 'GK', 'DEF', 'MID', 'FWD'

4. **getUserPlayerStats(userId)**
   - Get user's collection statistics
   - Useful for achievement tracking

### Example Integration Points

#### Trophy Wins
```typescript
// In your trophy winning logic
const awardedPlayer = await awardRandomFootballer(winnerId);
if (awardedPlayer) {
  // Broadcast to WebSocket
  ws.send({
    type: 'PLAYER_AWARDED',
    player: awardedPlayer.player,
    isNew: awardedPlayer.isNew
  });
}
```

#### Question Wins
```typescript
// After grading question
if (answer.isCorrect && answer.points > 0) {
  // Maybe 50% chance to award player
  if (Math.random() < 0.5) {
    await awardRandomFootballer(userId);
  }
}
```

#### Category Game Wins
```typescript
// When player wins category game
const winner = await prisma.categoryGame.update({
  where: { id: gameId },
  data: { winnerId: userId, status: 'COMPLETED' }
});

await awardRandomFootballer(userId);
```

## Position Validation

The system validates that players are placed in correct positions:
- Goalkeepers can only be position 0
- Defenders, midfielders, forwards must match formation requirements
- The API will reject invalid lineups

## Future Expansion

The database is designed to support future award types:

### Festival Awards
Add festival-related items/badges that users can collect and display (not restricted by position)

### Film Awards
Add film-related collectibles

To add these later:
1. Add images to `/public/festivals/` or `/public/films/`
2. Create Player records with type='FESTIVAL' or type='FILM'
3. Award them using the same API endpoints
4. They can use position='ANY' since they're not for the football formation

## Files Created/Modified

### Database
- `prisma/schema.prisma` - Added Player, UserPlayer, UserTeam, TeamPosition models

### API Routes
- `src/app/api/team/route.ts` - Get team
- `src/app/api/team/formation/route.ts` - Update formation
- `src/app/api/team/lineup/route.ts` - Update lineup
- `src/app/api/players/owned/route.ts` - Get owned players
- `src/app/api/players/all/route.ts` - Get all players
- `src/app/api/players/initialize/route.ts` - Initialize starting pack
- `src/app/api/players/award/route.ts` - Award players

### Components
- `src/components/FormationDisplay.tsx` - Display team formation
- `src/components/TeamManager.tsx` - Manage team

### Pages
- `src/app/dream-eleven/page.tsx` - Main Dream Eleven page

### Utilities
- `src/lib/player-awards.ts` - Helper functions for awarding players

### Scripts
- `convert-footballers.js` - Converted images to WebP
- `prisma/seed-players.ts` - Database seeding script

### Images
- `/public/starting_pack/` - 15 starting pack players (WebP)
- `/public/footballers/` - 68 award players (WebP)

## Running the System

### Database Setup
```bash
cd prisma
DATABASE_URL="file:./dev.db" npx prisma migrate dev
DATABASE_URL="file:./dev.db" npx tsx seed-players.ts
```

### Usage Flow
1. User visits `/dream-eleven`
2. First time: Gets starting pack (15 players)
3. Automatically creates default 4-4-2 formation
4. User can edit team, change formation, swap players
5. As user wins games, award players using helper functions
6. User manages growing collection in Dream Eleven page

## Notes

- All images are optimized WebP format for fast loading
- Position validation ensures tactical validity
- Users can have duplicate players (good for trading in future)
- System supports up to 83 unique footballers currently
- Designed for easy expansion with FESTIVAL and FILM types
