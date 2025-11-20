import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Formation } from '@prisma/client';

// POST /api/dev-team/formation - Update formation for dev user
export async function POST(req: NextRequest) {
  try {
    const { userId, formation } = await req.json();

    if (!userId || !formation) {
      return NextResponse.json({ error: 'userId and formation required' }, { status: 400 });
    }

    if (!Object.values(Formation).includes(formation)) {
      return NextResponse.json({ error: 'Invalid formation' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { clerkId: userId },
      include: { team: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let team;
    if (user.team) {
      team = await db.userTeam.update({
        where: { id: user.team.id },
        data: { formation },
        include: {
          positions: {
            include: { player: true },
            orderBy: { position: 'asc' },
          },
        },
      });
    } else {
      team = await db.userTeam.create({
        data: {
          userId: user.id,
          formation,
        },
        include: {
          positions: {
            include: { player: true },
            orderBy: { position: 'asc' },
          },
        },
      });
    }

    return NextResponse.json(team);
  } catch (error) {
    console.error('Error updating formation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
