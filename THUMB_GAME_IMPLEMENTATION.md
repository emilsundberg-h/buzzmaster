# Thumb Game Implementation

## Overview
The thumb game feature allows each player to start the game once per round. When started, a thumb icon appears at the bottom of all players' screens. Players must click the thumbs-up button to respond. The last player to respond loses 5 points.

## Features Implemented

### 1. Database Schema (`prisma/schema.prisma`)
Added to the `Round` model:
- `thumbGameActive`: Boolean flag indicating if thumb game is currently active
- `thumbGameStarterId`: ID of the user who started the thumb game
- `thumbGameResponders`: JSON array of user IDs who have responded
- `thumbGameUsedBy`: JSON array of user IDs who have already started the thumb game this round

### 2. API Endpoints

#### `/api/thumb-game/start` (POST)
- Starts a new thumb game
- Validates that no game is currently active
- Checks that the user hasn't already started a game this round
- Broadcasts `thumb-game:started` event via WebSocket

#### `/api/thumb-game/respond` (POST)
- Records a player's response to the active thumb game
- Checks if the responding player is the last one
- If last player: deducts 5 points and ends the game
- Broadcasts `thumb-game:updated` or `thumb-game:ended` events

#### `/api/thumb-game/status` (GET)
- Returns current thumb game state
- Used for initial state loading and synchronization

### 3. UI Components

#### `ThumbGame.tsx`
A React component that provides:
- **Thumbs-up button** (top-right corner): 
  - Visible during active rounds
  - Starts game if user hasn't used it yet
  - Responds to active game if user hasn't responded
  - Disabled if user has already used their turn
  
- **Thumb display bar** (bottom of screen):
  - Shows when game is active
  - Displays animated thumb images (`clubbed_thumb.png`)
  - Shows count of responders
  - Semi-transparent black background with blur effect

### 4. Integration

#### `dev-user/page.tsx`
- Imported and rendered `ThumbGame` component
- Added WebSocket event handlers for:
  - `thumb-game:started`
  - `thumb-game:updated`
  - `thumb-game:ended`
- Passes required props: `currentUserId`, `onWebSocketMessage`, `fetchWithUserId`, `roundActive`

### 5. WebSocket Events

The following events are broadcast to all connected clients:

- **`thumb-game:started`**: When a player starts the game
  - Data: `{ roundId, starterId, responders }`
  
- **`thumb-game:updated`**: When a player responds (but not the last one)
  - Data: `{ roundId, responders }`
  
- **`thumb-game:ended`**: When the last player responds
  - Data: `{ roundId, loserId, responders }`

## Game Flow

1. **Round starts**: All players can see the thumbs-up button
2. **Player starts game**: Clicks thumbs-up button → thumb appears at bottom for all players
3. **Players respond**: Other players click thumbs-up → more thumbs appear
4. **Last player**: When only one player hasn't responded, they lose 5 points
5. **Game ends**: Thumb display disappears, game resets for next round

## Technical Notes

- Uses existing `fetchWithUserId` wrapper to include dev-user-id header
- Integrates with existing WebSocket infrastructure
- State resets automatically when round ends
- Each player can only start the game once per round
- Uses `clubbed_thumb.png` image from `/public` directory

## Files Modified/Created

### Created:
- `/src/app/api/thumb-game/start/route.ts`
- `/src/app/api/thumb-game/respond/route.ts`
- `/src/app/api/thumb-game/status/route.ts`
- `/src/components/ThumbGame.tsx`
- `/prisma/migrations/20251113151113_add_thumb_game/migration.sql`

### Modified:
- `/prisma/schema.prisma` - Added thumb game fields to Round model
- `/src/app/dev-user/page.tsx` - Integrated ThumbGame component and WebSocket handlers

## Testing

To test the thumb game:
1. Start a round from the admin panel
2. Open multiple user tabs (different dev-user-ids)
3. One user clicks the thumbs-up button (top-right)
4. Thumbs appear at the bottom for all users
5. Other users click thumbs-up to respond
6. Last user to respond loses 5 points
7. Game ends and resets for next round
