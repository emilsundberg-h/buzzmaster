/**
 * Utility functions for awarding players to users
 * Integrate these into your existing trophy/round/game winning logic
 */

import { db } from './db';

/**
 * Award a random footballer to a user
 * Call this when a user wins a round/trophy/game
 */
export async function awardRandomFootballer(userId: string) {
  try {
    // Get all award footballers
    const availablePlayers = await db.player.findMany({
      where: {
        category: 'AWARD',
        type: 'FOOTBALLER',
      },
    });

    if (availablePlayers.length === 0) {
      console.error('No award footballers available');
      return null;
    }

    // Get players the user already owns
    const userPlayers = await db.userPlayer.findMany({
      where: { userId },
      select: { playerId: true },
    });

    const ownedPlayerIds = new Set(userPlayers.map(up => up.playerId));
    
    // Prefer players user doesn't own
    const unownedPlayers = availablePlayers.filter(p => !ownedPlayerIds.has(p.id));
    const playersToChooseFrom = unownedPlayers.length > 0 ? unownedPlayers : availablePlayers;
    
    // Pick random player
    const randomPlayer = playersToChooseFrom[Math.floor(Math.random() * playersToChooseFrom.length)];

    // Award to user
    const userPlayer = await db.userPlayer.create({
      data: {
        userId,
        playerId: randomPlayer.id,
      },
      include: {
        player: true,
      },
    });

    return {
      player: userPlayer.player,
      isNew: !ownedPlayerIds.has(randomPlayer.id),
    };
  } catch (error) {
    console.error('Error awarding footballer:', error);
    return null;
  }
}

/**
 * Award a specific player by ID to a user
 */
export async function awardSpecificPlayer(userId: string, playerId: string) {
  try {
    // Check if user already has this player
    const existing = await db.userPlayer.findUnique({
      where: {
        userId_playerId: {
          userId,
          playerId,
        },
      },
    });

    if (existing) {
      const player = await db.player.findUnique({ where: { id: playerId } });
      return { player, isNew: false };
    }

    // Award player
    const userPlayer = await db.userPlayer.create({
      data: {
        userId,
        playerId,
      },
      include: {
        player: true,
      },
    });

    return {
      player: userPlayer.player,
      isNew: true,
    };
  } catch (error) {
    console.error('Error awarding specific player:', error);
    return null;
  }
}

/**
 * Award a random player of a specific position
 */
export async function awardPlayerByPosition(userId: string, position: 'GK' | 'DEF' | 'MID' | 'FWD') {
  try {
    const availablePlayers = await db.player.findMany({
      where: {
        category: 'AWARD',
        type: 'FOOTBALLER',
        position,
      },
    });

    if (availablePlayers.length === 0) {
      console.error(`No award ${position} players available`);
      return null;
    }

    const userPlayers = await db.userPlayer.findMany({
      where: { userId },
      select: { playerId: true },
    });

    const ownedPlayerIds = new Set(userPlayers.map(up => up.playerId));
    const unownedPlayers = availablePlayers.filter(p => !ownedPlayerIds.has(p.id));
    const playersToChooseFrom = unownedPlayers.length > 0 ? unownedPlayers : availablePlayers;
    
    const randomPlayer = playersToChooseFrom[Math.floor(Math.random() * playersToChooseFrom.length)];

    const userPlayer = await db.userPlayer.create({
      data: {
        userId,
        playerId: randomPlayer.id,
      },
      include: {
        player: true,
      },
    });

    return {
      player: userPlayer.player,
      isNew: !ownedPlayerIds.has(randomPlayer.id),
    };
  } catch (error) {
    console.error('Error awarding player by position:', error);
    return null;
  }
}

/**
 * Get user's player collection stats
 */
export async function getUserPlayerStats(userId: string) {
  const players = await db.userPlayer.findMany({
    where: { userId },
    include: { player: true },
  });

  const stats = {
    total: players.length,
    byPosition: {
      GK: players.filter(p => p.player.position === 'GK').length,
      DEF: players.filter(p => p.player.position === 'DEF').length,
      MID: players.filter(p => p.player.position === 'MID').length,
      FWD: players.filter(p => p.player.position === 'FWD').length,
    },
    byCategory: {
      STARTER: players.filter(p => p.player.category === 'STARTER').length,
      AWARD: players.filter(p => p.player.category === 'AWARD').length,
    },
    byType: {
      FOOTBALLER: players.filter(p => p.player.type === 'FOOTBALLER').length,
      FESTIVAL: players.filter(p => p.player.type === 'FESTIVAL').length,
      FILM: players.filter(p => p.player.type === 'FILM').length,
      ACTOR: players.filter(p => p.player.type === 'ACTOR').length,
    },
  };

  return stats;
}
