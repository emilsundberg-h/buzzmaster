import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/dev-team - Get dev user's team and players
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Find user by dev-user ID (stored as clerkId for dev users)
    const user = await db.user.findUnique({
      where: { clerkId: userId },
      include: {
        team: {
          include: {
            positions: {
              include: { player: true },
              orderBy: { position: 'asc' },
            },
          },
        },
        players: {
          where: {
            player: {
              type: 'FOOTBALLER'  // Only footballers for Dream Eleven, not FESTIVAL or FILM
            }
          },
          include: { player: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ 
        team: null, 
        players: [] 
      });
    }

    return NextResponse.json({
      team: user.team,
      players: user.players.map(up => up.player),
    });
  } catch (error) {
    console.error('Error fetching dev team:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
