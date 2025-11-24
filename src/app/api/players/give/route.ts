import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/players/give - Give a player/artist to a user
export async function POST(req: NextRequest) {
  try {
    console.log('🏆 POST /api/players/give called');
    const { userId, playerId } = await req.json();
    console.log('🏆 Request data:', { userId, playerId });

    if (!userId || !playerId) {
      console.log('🏆 ERROR: Missing userId or playerId');
      return NextResponse.json({ error: 'userId and playerId required' }, { status: 400 });
    }

    console.log('🏆 Looking for user with ID:', userId);
    // Find user - try both clerkId and database id
    let user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      console.log('🏆 Not found by clerkId, trying database id...');
      user = await db.user.findUnique({
        where: { id: userId },
      });
    }

    if (!user) {
      console.log('🏆 ERROR: User not found by either clerkId or id');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    console.log('🏆 Found user:', user.username);

    // Find player
    const player = await db.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      return NextResponse.json({ error: 'Player/Artist not found' }, { status: 404 });
    }

    // Check if user already owns this player
    const existing = await db.userPlayer.findUnique({
      where: {
        userId_playerId: {
          userId: user.id,
          playerId: playerId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ 
        error: `User already owns ${player.name}` 
      }, { status: 400 });
    }

    // Give player to user
    const userPlayer = await db.userPlayer.create({
      data: {
        userId: user.id,
        playerId: playerId,
        revealed: false, // For festival artists
      },
      include: {
        player: true,
      },
    });

    console.log(`🏆 SUCCESS: Gave ${player.name} (${player.type}) to user ${user.username}`);

    const response = NextResponse.json({ 
      success: true, 
      userPlayer,
      message: `${player.name} given to ${user.username}` 
    });
    console.log('🏆 Returning response with status 200');
    return response;
  } catch (error) {
    console.error('🏆 EXCEPTION:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
