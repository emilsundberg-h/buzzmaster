import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { PlayerCategory, Formation } from '@prisma/client';

// POST /api/dev-team/initialize - Initialize starting pack for dev user
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { clerkId: userId },
      include: {
        players: true,
        team: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's current players with full player data
    const currentPlayers = await db.userPlayer.findMany({
      where: { userId: user.id },
      include: { player: true },
    });
    
    const hasStarters = currentPlayers.some(up => up.player.category === PlayerCategory.STARTER);
    
    if (hasStarters) {
      // User already has starting pack
      return NextResponse.json({
        players: currentPlayers.map(up => up.player),
        team: user.team,
      });
    }

    // Get all starting pack players
    const startingPackPlayers = await db.player.findMany({
      where: { category: PlayerCategory.STARTER },
    });

    // Give user all starting pack players
    await Promise.all(
      startingPackPlayers.map(player =>
        db.userPlayer.create({
          data: {
            userId: user.id,
            playerId: player.id,
            revealed: true, // Starting pack footballers are always visible
          },
        })
      )
    );

    // Create initial team with default formation
    if (!user.team) {
      // Get captain player (already owned)
      const captain = currentPlayers.find(up => up.player.category === PlayerCategory.CAPTAIN)?.player;
      
      // Build a default 4-4-2 lineup
      const gk = startingPackPlayers.find(p => p.position === 'GK');
      const defenders = startingPackPlayers.filter(p => p.position === 'DEF').slice(0, 4);
      
      // If captain is a midfielder, include them and take 3 starters
      // Otherwise take 4 starter midfielders
      let midfielders;
      if (captain && captain.position === 'MID') {
        midfielders = [captain, ...startingPackPlayers.filter(p => p.position === 'MID').slice(0, 3)];
      } else {
        midfielders = startingPackPlayers.filter(p => p.position === 'MID').slice(0, 4);
      }
      
      // If captain is a forward, include them and take 1 starter
      // Otherwise take 2 starter forwards
      let forwards;
      if (captain && captain.position === 'FWD') {
        forwards = [captain, ...startingPackPlayers.filter(p => p.position === 'FWD').slice(0, 1)];
      } else {
        forwards = startingPackPlayers.filter(p => p.position === 'FWD').slice(0, 2);
      }

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
    console.error('Error initializing dev team:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
