import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/players/all - Get all available players
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const category = searchParams.get('category');

    const where: any = {};
    if (type) where.type = type;
    if (category) where.category = category;

    const players = await db.player.findMany({
      where,
      orderBy: [
        { category: 'asc' }, // STARTER first
        { position: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
