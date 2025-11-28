import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

// POST /api/team/lineup - Update lineup
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { lineup } = await req.json();
    
    // lineup should be an array of { position: number, playerId: string }
    if (!Array.isArray(lineup) || lineup.length !== 11) {
      return NextResponse.json({ error: 'Lineup must contain exactly 11 players' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { clerkId },
      include: { 
        team: true,
        players: {
          include: { player: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Ensure user has a team
    let team = user.team;
    if (!team) {
      team = await db.userTeam.create({
        data: {
          userId: user.id,
        },
      });
    }

    // Verify user owns all players
    const ownedPlayerIds = new Set(user.players.map(up => up.playerId));
    const lineupPlayerIds = lineup.map(l => l.playerId);
    
    for (const playerId of lineupPlayerIds) {
      if (!ownedPlayerIds.has(playerId)) {
        return NextResponse.json({ error: 'Cannot add player not owned by user' }, { status: 400 });
      }
    }

    // Verify each player is only used once
    const playerCount = new Map<string, number>();
    for (const playerId of lineupPlayerIds) {
      playerCount.set(playerId, (playerCount.get(playerId) || 0) + 1);
      if (playerCount.get(playerId)! > 1) {
        const player = await db.player.findUnique({ where: { id: playerId } });
        return NextResponse.json({ 
          error: `Player ${player?.name || 'Unknown'} can only be used once in the lineup` 
        }, { status: 400 });
      }
    }

    // Validate positions match player positions based on formation
    const players = await db.player.findMany({
      where: { id: { in: lineupPlayerIds } },
    });
    
    const playerMap = new Map(players.map(p => [p.id, p]));
    
    // Get formation requirements
    const formationRequirements = getFormationRequirements(team.formation);
    
    for (const { position, playerId } of lineup) {
      const player = playerMap.get(playerId);
      if (!player) {
        return NextResponse.json({ error: 'Player not found' }, { status: 400 });
      }
      
      const requiredPosition = formationRequirements[position];
      if (requiredPosition && player.position !== requiredPosition) {
        return NextResponse.json({ 
          error: `Player ${player.name} (${player.position}) cannot play in position ${position} (requires ${requiredPosition})` 
        }, { status: 400 });
      }
    }

    // Clear existing lineup
    await db.teamPosition.deleteMany({
      where: { teamId: team.id },
    });

    // Create new lineup
    await db.teamPosition.createMany({
      data: lineup.map(({ position, playerId }) => ({
        teamId: team.id,
        position,
        playerId,
      })),
    });

    // Fetch updated team
    const updatedTeam = await db.userTeam.findUnique({
      where: { id: team.id },
      include: {
        positions: {
          include: { player: true },
          orderBy: { position: 'asc' },
        },
      },
    });

    return NextResponse.json(updatedTeam);
  } catch (error) {
    console.error('Error updating lineup:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to get position requirements for each formation
function getFormationRequirements(formation: string): Record<number, string> {
  const baseRequirements: Record<number, string> = {
    0: 'GK', // Goalkeeper is always position 0
  };

  switch (formation) {
    case 'F442': // 4-4-2
      return {
        ...baseRequirements,
        1: 'DEF', 2: 'DEF', 3: 'DEF', 4: 'DEF', // 4 defenders
        5: 'MID', 6: 'MID', 7: 'MID', 8: 'MID', // 4 midfielders
        9: 'FWD', 10: 'FWD', // 2 forwards
      };
    
    case 'F433': // 4-3-3
      return {
        ...baseRequirements,
        1: 'DEF', 2: 'DEF', 3: 'DEF', 4: 'DEF', // 4 defenders
        5: 'MID', 6: 'MID', 7: 'MID', // 3 midfielders
        8: 'FWD', 9: 'FWD', 10: 'FWD', // 3 forwards
      };
    
    case 'F343': // 3-4-3
      return {
        ...baseRequirements,
        1: 'DEF', 2: 'DEF', 3: 'DEF', // 3 defenders
        4: 'MID', 5: 'MID', 6: 'MID', 7: 'MID', // 4 midfielders
        8: 'FWD', 9: 'FWD', 10: 'FWD', // 3 forwards
      };
    
    default:
      return baseRequirements;
  }
}
