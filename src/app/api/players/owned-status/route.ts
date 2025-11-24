import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Get which players are owned by any user
export async function GET() {
  try {
    // Get all owned players from UserPlayer table
    const ownedPlayers = await db.userPlayer.findMany({
      select: {
        playerId: true,
      },
      distinct: ['playerId'],
    });

    const ownedPlayerIds = ownedPlayers.map(up => up.playerId);

    return NextResponse.json({ ownedPlayerIds });
  } catch (error) {
    console.error("Error fetching owned players:", error);
    return NextResponse.json(
      { error: "Failed to fetch owned players" },
      { status: 500 }
    );
  }
}
