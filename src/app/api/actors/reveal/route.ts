import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/actors/reveal - Reveal an actor
export async function POST(req: NextRequest) {
  try {
    const { userId, playerId } = await req.json();

    if (!userId || !playerId) {
      return NextResponse.json({ error: 'userId and playerId required' }, { status: 400 });
    }

    // Try to find user by clerkId first (for production), then by id (for dev mode)
    let user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    // If not found by clerkId, try by id (for dev mode)
    if (!user) {
      user = await db.user.findUnique({
        where: { id: userId },
      });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update the UserPlayer record to mark as revealed
    const userPlayer = await db.userPlayer.updateMany({
      where: {
        userId: user.id,
        playerId: playerId,
      },
      data: {
        revealed: true,
      },
    });

    if (userPlayer.count === 0) {
      return NextResponse.json({ error: 'Actor not found for user' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revealing actor:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
