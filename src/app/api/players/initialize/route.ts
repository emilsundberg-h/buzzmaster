import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { PlayerCategory, Formation } from '@prisma/client';

// POST /api/players/initialize - Initialize starting pack for new user
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkId },
      include: {
        players: true,
        team: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user already has players
    if (user.players.length > 0) {
      return NextResponse.json({ error: 'User already has players' }, { status: 400 });
    }

    // Get all starting pack players
    const startingPackPlayers = await db.player.findMany({
      where: { category: PlayerCategory.STARTER },
    });

    // Give user all starting pack players
    await db.userPlayer.createMany({
      data: startingPackPlayers.map(player => ({
        userId: user.id,
        playerId: player.id,
      })),
    });

    // Create initial team with default formation if doesn't exist
    if (!user.team) {
      // Build a default 4-4-2 lineup
      const gk = startingPackPlayers.find(p => p.position === 'GK');
      const defenders = startingPackPlayers.filter(p => p.position === 'DEF').slice(0, 4);
      const midfielders = startingPackPlayers.filter(p => p.position === 'MID').slice(0, 4);
      const forwards = startingPackPlayers.filter(p => p.position === 'FWD').slice(0, 2);

      const lineup = [
        gk,
        ...defenders,
        ...midfielders,
        ...forwards,
      ].filter(Boolean);

      if (lineup.length === 11) {
        const team = await db.userTeam.create({
          data: {
            userId: user.id,
            formation: Formation.F442,
          },
        });

        await db.teamPosition.createMany({
          data: lineup.map((player, index) => ({
            teamId: team.id,
            position: index,
            playerId: player!.id,
          })),
        });
      }
    }

    // Fetch updated user data
    const updatedUser = await db.user.findUnique({
      where: { id: user.id },
      include: {
        players: {
          include: { player: true },
        },
        team: {
          include: {
            positions: {
              include: { player: true },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    });

    return NextResponse.json({
      players: updatedUser?.players.map(up => up.player) || [],
      team: updatedUser?.team || null,
    });
  } catch (error) {
    console.error('Error initializing players:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
