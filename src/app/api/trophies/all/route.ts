import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - List all available trophies including players/artists
export async function GET() {
  try {
    // Get traditional trophies
    const trophies = await db.trophy.findMany({
      orderBy: {
        name: "asc",
      },
    });

    // Get all players/artists that can be used as trophies
    const players = await db.player.findMany({
      where: {
        category: 'AWARD', // Only award players, not starters or captains
      },
      orderBy: [
        { type: 'asc' }, // FOOTBALLER first, then FESTIVAL
        { name: 'asc' },
      ],
    });

    // Convert players to trophy format
    const playerTrophies = players.map(player => ({
      id: `player_${player.id}`, // Prefix to distinguish from real trophies
      name: player.name,
      imageKey: player.imageKey,
      description: `${player.type === 'FOOTBALLER' ? '⚽ Footballer' : '🎵 Artist'} - ${player.position}`,
      type: 'PLAYER' as const,
      playerId: player.id,
      playerType: player.type,
    }));

    // Convert traditional trophies to consistent format
    const traditionalTrophies = trophies.map(trophy => ({
      id: trophy.id,
      name: trophy.name,
      imageKey: trophy.imageKey,
      description: trophy.description,
      type: 'TROPHY' as const,
    }));

    // Combine and sort
    const allTrophies = [
      ...traditionalTrophies,
      ...playerTrophies,
    ].sort((a, b) => {
      // Traditional trophies first, then players by type
      if (a.type !== b.type) {
        if (a.type === 'TROPHY') return -1;
        if (b.type === 'TROPHY') return 1;
      }
      
      // Within players, footballers first
      if (a.type === 'PLAYER' && b.type === 'PLAYER') {
        if (a.playerType !== b.playerType) {
          return a.playerType === 'FOOTBALLER' ? -1 : 1;
        }
      }
      
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ trophies: allTrophies });
  } catch (error) {
    console.error("Failed to fetch all trophies:", error);
    return NextResponse.json(
      { error: "Failed to fetch trophies" },
      { status: 500 }
    );
  }
}
