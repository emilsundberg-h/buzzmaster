import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/artists/owned?userId=xxx - Get user's owned artists
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Try to find user by clerkId first (for production), then by id (for dev mode)
    let user = await db.user.findUnique({
      where: { clerkId: userId },
      include: {
        players: {
          where: {
            player: {
              type: 'FESTIVAL', // Only get festival artists
            },
          },
          include: {
            player: true,
          },
          orderBy: {
            acquiredAt: 'desc',
          },
        },
      },
    });

    // If not found by clerkId, try by id (for dev mode)
    if (!user) {
      user = await db.user.findUnique({
        where: { id: userId },
        include: {
          players: {
            where: {
              player: {
                type: 'FESTIVAL', // Only get festival artists
              },
            },
            include: {
              player: true,
            },
            orderBy: {
              acquiredAt: 'desc',
            },
          },
        },
      });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user.players);
  } catch (error) {
    console.error('Error fetching owned artists:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
