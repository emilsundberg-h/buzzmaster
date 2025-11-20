import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/artists/reveal - Mark an artist as revealed
export async function POST(req: NextRequest) {
  try {
    const { userId, playerId } = await req.json();

    if (!userId || !playerId) {
      return NextResponse.json({ error: 'userId and playerId required' }, { status: 400 });
    }

    // Find the UserPlayer record
    const userPlayer = await db.userPlayer.findFirst({
      where: {
        user: { clerkId: userId },
        playerId: playerId,
      },
      include: {
        player: true,
      },
    });

    if (!userPlayer) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    // Update revealed status
    const updated = await db.userPlayer.update({
      where: { id: userPlayer.id },
      data: { revealed: true },
      include: {
        player: true,
      },
    });

    return NextResponse.json({ success: true, artist: updated });
  } catch (error) {
    console.error('Error revealing artist:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
