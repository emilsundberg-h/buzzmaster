import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/players - Get all players (footballers and artists)
export async function GET() {
  try {
    const players = await db.player.findMany({
      orderBy: [
        { type: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
