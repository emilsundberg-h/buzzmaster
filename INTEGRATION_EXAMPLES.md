# Dream Eleven - Integration Examples

Quick copy-paste examples for integrating player awards into your game.

## Award Player When User Wins Trophy

```typescript
// In your trophy winning logic (e.g., when ending a round)
import { awardRandomFootballer } from '@/lib/player-awards';

async function handleTrophyWin(winnerId: string, trophyId: string) {
  // Your existing trophy logic
  await db.trophyWin.create({
    data: {
      userId: winnerId,
      trophyId: trophyId,
      source: 'round',
      sourceId: roundId,
    },
  });

  // NEW: Award a footballer
  const playerReward = await awardRandomFootballer(winnerId);
  
  if (playerReward) {
    console.log(`Awarded ${playerReward.player.name} to winner!`);
    
    // Send notification via WebSocket
    broadcastToRoom(roomId, {
      type: 'PLAYER_AWARDED',
      userId: winnerId,
      player: playerReward.player,
      isNew: playerReward.isNew, // true if first time getting this player
    });
  }
}
```

## Award Player When User Answers Question Correctly

```typescript
// In your question grading logic
import { awardRandomFootballer } from '@/lib/player-awards';

async function gradeAnswer(userId: string, questionId: string, answer: string) {
  // Your existing grading logic
  const isCorrect = checkAnswer(answer, correctAnswer);
  
  if (isCorrect) {
    // Award points...
    
    // NEW: 30% chance to win a player for correct answer
    if (Math.random() < 0.3) {
      const playerReward = await awardRandomFootballer(userId);
      
      if (playerReward) {
        // Return player info with the answer result
        return {
          correct: true,
          points: earnedPoints,
          bonusPlayer: playerReward.player,
        };
      }
    }
  }
  
  return { correct: isCorrect, points: earnedPoints };
}
```

## Award Player for Winning Category Game

```typescript
// When category game ends with a winner
import { awardRandomFootballer } from '@/lib/player-awards';

async function endCategoryGame(gameId: string, winnerId: string) {
  // Update game status
  await db.categoryGame.update({
    where: { id: gameId },
    data: {
      status: 'COMPLETED',
      winnerId: winnerId,
      completedAt: new Date(),
    },
  });

  // NEW: Award player to winner
  const playerReward = await awardRandomFootballer(winnerId);
  
  if (playerReward) {
    // Broadcast win
    broadcastToRoom(roomId, {
      type: 'CATEGORY_GAME_ENDED',
      winnerId,
      awardedPlayer: playerReward.player,
    });
  }
}
```

## Award Specific Player (Special Achievement)

```typescript
// For special achievements or admin commands
import { awardSpecificPlayer } from '@/lib/player-awards';

async function grantSpecialReward(userId: string) {
  // Award Messi for completing all rounds
  const messiId = 'clxx...' // Get from database
  
  const result = await awardSpecificPlayer(userId, messiId);
  
  if (result?.isNew) {
    // First time getting Messi!
    notifyUser(userId, 'Congratulations! You unlocked Messi! 🎉');
  } else {
    // Already had Messi
    notifyUser(userId, 'You received another Messi card');
  }
}
```

## Award Player by Position (Balanced Rewards)

```typescript
// Award specific position based on user's needs
import { awardPlayerByPosition, getUserPlayerStats } from '@/lib/player-awards';

async function awardBalancedPlayer(userId: string) {
  // Check what positions user needs most
  const stats = await getUserPlayerStats(userId);
  
  // Find position with fewest players
  const positions = ['GK', 'DEF', 'MID', 'FWD'] as const;
  let minPosition = 'GK';
  let minCount = stats.byPosition.GK;
  
  positions.forEach(pos => {
    if (stats.byPosition[pos] < minCount) {
      minCount = stats.byPosition[pos];
      minPosition = pos;
    }
  });
  
  // Award player of that position
  const result = await awardPlayerByPosition(userId, minPosition);
  
  return result;
}
```

## Show Player Award in UI

```typescript
// Client-side component for showing player award
'use client'

import { useState } from 'react';
import Image from 'next/image';

interface PlayerAwardModalProps {
  player: {
    name: string;
    position: string;
    imageKey: string;
  };
  isNew: boolean;
  onClose: () => void;
}

export function PlayerAwardModal({ player, isNew, onClose }: PlayerAwardModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md text-center">
        <h2 className="text-3xl font-bold mb-4">
          {isNew ? '🎉 New Player!' : '⚽ Player Reward!'}
        </h2>
        
        <div className="relative w-48 h-48 mx-auto mb-4 rounded-full overflow-hidden border-4 border-yellow-400">
          <Image
            src={`/${player.imageKey}`}
            alt={player.name}
            fill
            className="object-cover"
          />
        </div>
        
        <h3 className="text-2xl font-bold mb-2">{player.name}</h3>
        <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
          {player.position} • {isNew ? 'Added to collection' : 'Duplicate'}
        </p>
        
        <button
          onClick={onClose}
          className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
```

## WebSocket Integration Example

```typescript
// In your WebSocket server
import { awardRandomFootballer } from '@/lib/player-awards';

wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    const data = JSON.parse(message);
    
    if (data.type === 'ROUND_ENDED') {
      const { winnerId, roomId } = data;
      
      // Award player
      const playerReward = await awardRandomFootballer(winnerId);
      
      if (playerReward) {
        // Broadcast to all in room
        broadcast(roomId, {
          type: 'PLAYER_AWARDED',
          winnerId,
          player: {
            name: playerReward.player.name,
            position: playerReward.player.position,
            imageKey: playerReward.player.imageKey,
          },
          isNew: playerReward.isNew,
        });
      }
    }
  });
});
```

## Admin Panel - Manually Award Player

```typescript
// Admin endpoint to manually award player
// src/app/api/admin/award-player/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { awardSpecificPlayer, awardRandomFootballer } from '@/lib/player-awards';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  const { userId: adminClerkId } = await auth();
  
  // Check admin privileges (implement your admin check)
  if (!isAdmin(adminClerkId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  const { targetUserId, playerId } = await req.json();
  
  let result;
  if (playerId) {
    // Award specific player
    result = await awardSpecificPlayer(targetUserId, playerId);
  } else {
    // Award random player
    result = await awardRandomFootballer(targetUserId);
  }
  
  return NextResponse.json(result);
}
```

## Getting User's Collection for Display

```typescript
// Show user's collection stats
import { getUserPlayerStats } from '@/lib/player-awards';

async function displayUserCollection(userId: string) {
  const stats = await getUserPlayerStats(userId);
  
  console.log(`Total players: ${stats.total}`);
  console.log(`Goalkeepers: ${stats.byPosition.GK}`);
  console.log(`Defenders: ${stats.byPosition.DEF}`);
  console.log(`Midfielders: ${stats.byPosition.MID}`);
  console.log(`Forwards: ${stats.byPosition.FWD}`);
  console.log(`Starting pack: ${stats.byCategory.STARTER}`);
  console.log(`Awards: ${stats.byCategory.AWARD}`);
  
  return stats;
}
```

## Notes

- All helper functions handle errors gracefully and return `null` on failure
- Always check if result is not null before using
- The `isNew` flag indicates if this is the first time user received this player
- Players can be awarded multiple times (good for potential trading feature)
- Position validation is handled automatically in the team management UI
