import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/players/award - Award a random footballer to a user
export async function POST(req: NextRequest) {
  try {
    const { userId, playerType = 'FOOTBALLER' } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        players: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all award players of the specified type
    const availablePlayers = await db.player.findMany({
      where: {
        category: 'AWARD',
        type: playerType,
      },
    });

    if (availablePlayers.length === 0) {
      return NextResponse.json({ error: 'No award players available' }, { status: 404 });
    }

    // Get players the user doesn't have yet
    const ownedPlayerIds = new Set(user.players.map(up => up.playerId));
    const unownedPlayers = availablePlayers.filter(p => !ownedPlayerIds.has(p.id));

    // If user has all players, pick a random one anyway (duplicate)
    const playersToChooseFrom = unownedPlayers.length > 0 ? unownedPlayers : availablePlayers;
    
    // Pick random player
    const randomPlayer = playersToChooseFrom[Math.floor(Math.random() * playersToChooseFrom.length)];

    // Award player to user
    const userPlayer = await db.userPlayer.create({
      data: {
        userId: user.id,
        playerId: randomPlayer.id,
      },
      include: {
        player: true,
      },
    });

    return NextResponse.json({
      player: userPlayer.player,
      isNew: !ownedPlayerIds.has(randomPlayer.id),
    });
  } catch (error) {
    console.error('Error awarding player:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/players/award-specific - Award a specific player to a user
export async function PUT(req: NextRequest) {
  try {
    const { userId, playerId } = await req.json();

    if (!userId || !playerId) {
      return NextResponse.json({ error: 'userId and playerId are required' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const player = await db.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Check if user already has this player
    const existingUserPlayer = await db.userPlayer.findUnique({
      where: {
        userId_playerId: {
          userId: user.id,
          playerId: player.id,
        },
      },
    });

    if (existingUserPlayer) {
      return NextResponse.json({ 
        player,
        isNew: false,
        message: 'User already owns this player',
      });
    }

    // Award player to user
    const userPlayer = await db.userPlayer.create({
      data: {
        userId: user.id,
        playerId: player.id,
      },
      include: {
        player: true,
      },
    });

    return NextResponse.json({
      player: userPlayer.player,
      isNew: true,
    });
  } catch (error) {
    console.error('Error awarding specific player:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
