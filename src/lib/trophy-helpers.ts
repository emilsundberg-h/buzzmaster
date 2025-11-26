import { db } from './db';
import { broadcast } from './websocket';

/**
 * When a trophy is won, check if it's a player and add to user's collection
 * Handles both traditional trophies (by name) and new player trophies (by ID)
 */
export async function addTrophyPlayerToDreamEleven(
  userId: string,
  trophyNameOrId: string
): Promise<void> {
  console.log(`🔍 Checking if trophy "${trophyNameOrId}" is a player...`);
  
  let player = null;
  
  // Check if this is a "player trophy" ID (format: player_<playerId>)
  if (trophyNameOrId.startsWith('player_')) {
    const playerId = trophyNameOrId.replace('player_', '');
    console.log(`🎯 Detected player trophy ID, extracting player ID: ${playerId}`);
    
    player = await db.player.findUnique({
      where: { id: playerId }
    });
  } else {
    // Legacy: Check if this trophy name matches a player name
    player = await db.player.findFirst({
      where: {
        name: trophyNameOrId,
        category: 'AWARD'
      }
    });
  }

  if (!player) {
    console.log(`❌ "${trophyNameOrId}" is not a player`);
    return; // Not a player trophy
  }

  console.log(`✅ "${trophyNameOrId}" is a player: ${player.name} (${player.type})`);

  // Check if user already owns this player
  const existingUserPlayer = await db.userPlayer.findUnique({
    where: {
      userId_playerId: {
        userId: userId,
        playerId: player.id,
      }
    }
  });

  if (existingUserPlayer) {
    console.log(`⚠️  User already owns player ${player.name}`);
    return;
  }

  // Add player to user's collection
  await db.userPlayer.create({
    data: {
      userId: userId,
      playerId: player.id,
      revealed: player.type === 'ACTOR' ? true : false, // Actors visible immediately, festival artists hidden
    }
  });

  const emoji = player.type === 'FOOTBALLER' ? '⚽' : player.type === 'FESTIVAL' ? '🎵' : '🎬';
  console.log(`🎉 Added ${emoji} ${player.name} to user's collection!`);
  
  // Broadcast player addition to trigger frontend refresh
  broadcast('dream-eleven:player-added', {
    userId,
    playerName: player.name,
    playerId: player.id,
    playerType: player.type
  });
}
