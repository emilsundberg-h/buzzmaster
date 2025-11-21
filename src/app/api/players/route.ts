import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/players - Get all players (footballers and artists) with optional filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type'); // FOOTBALLER, FESTIVAL, FILM
    const category = searchParams.get('category'); // STARTER, AWARD, CAPTAIN

    const where: any = {};
    
    if (type) {
      where.type = type;
    }
    
    if (category) {
      where.category = category;
    }

    const players = await db.player.findMany({
      where,
      orderBy: [
        { type: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json({ players });
  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
