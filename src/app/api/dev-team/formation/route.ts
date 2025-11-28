import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Formation } from '@prisma/client';

// Position requirements for each formation
const FORMATION_REQUIREMENTS: Record<string, Record<number, string>> = {
  F442: {
    0: 'GK',
    1: 'DEF', 2: 'DEF', 3: 'DEF', 4: 'DEF',
    5: 'MID', 6: 'MID', 7: 'MID', 8: 'MID',
    9: 'FWD', 10: 'FWD',
  },
  F433: {
    0: 'GK',
    1: 'DEF', 2: 'DEF', 3: 'DEF', 4: 'DEF',
    5: 'MID', 6: 'MID', 7: 'MID',
    8: 'FWD', 9: 'FWD', 10: 'FWD',
  },
  F343: {
    0: 'GK',
    1: 'DEF', 2: 'DEF', 3: 'DEF',
    4: 'MID', 5: 'MID', 6: 'MID', 7: 'MID',
    8: 'FWD', 9: 'FWD', 10: 'FWD',
  },
};

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

    // Fix positions: replace players that don't match new formation requirements
    const requirements = FORMATION_REQUIREMENTS[formation];
    const userPlayers = await db.userPlayer.findMany({
      where: {
        userId: user.id,
        player: { type: 'FOOTBALLER' },
      },
      include: { player: true },
    });

    const usedPlayerIds = new Set<string>();
    const positionsToUpdate: Array<{ position: number; playerId: string | null }> = [];

    // First pass: mark all players that are already in correct positions as used
    for (const teamPos of team.positions) {
      const requiredPos = requirements[teamPos.position];
      const currentPlayer = teamPos.player;

      if (currentPlayer.position === requiredPos) {
        usedPlayerIds.add(currentPlayer.id);
      }
    }

    // Second pass: find replacements for players in wrong positions
    for (const teamPos of team.positions) {
      const requiredPos = requirements[teamPos.position];
      const currentPlayer = teamPos.player;

      // Check if current player matches required position
      if (currentPlayer.position !== requiredPos) {
        // Find a replacement player of correct position
        const replacement = userPlayers.find(
          up => up.player.position === requiredPos && !usedPlayerIds.has(up.playerId)
        );

        if (replacement) {
          positionsToUpdate.push({ position: teamPos.position, playerId: replacement.playerId });
          usedPlayerIds.add(replacement.playerId);
        } else {
          // No replacement available, remove player from this position
          positionsToUpdate.push({ position: teamPos.position, playerId: null });
        }
      }
    }

    // Apply updates
    for (const update of positionsToUpdate) {
      if (update.playerId === null) {
        // Remove position
        await db.teamPosition.deleteMany({
          where: {
            teamId: team.id,
            position: update.position,
          },
        });
      } else {
        // Update position with new player
        await db.teamPosition.upsert({
          where: {
            teamId_position: {
              teamId: team.id,
              position: update.position,
            },
          },
          update: { playerId: update.playerId },
          create: {
            teamId: team.id,
            position: update.position,
            playerId: update.playerId,
          },
        });
      }
    }

    // Fetch updated team
    team = await db.userTeam.findUnique({
      where: { id: team.id },
      include: {
        positions: {
          include: { player: true },
          orderBy: { position: 'asc' },
        },
      },
    });

    return NextResponse.json(team);
  } catch (error) {
    console.error('Error updating formation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
