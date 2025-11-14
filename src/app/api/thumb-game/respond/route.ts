import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { broadcast } from "@/lib/websocket";

export async function POST(request: Request) {
  try {
    const userId = request.headers.get("x-dev-user-id");
    
    if (!userId) {
      return NextResponse.json(
        { error: "User ID required" },
        { status: 401 }
      );
    }

    // Find active round
    const activeRound = await db.round.findFirst({
      where: {
        endedAt: null,
        startedAt: { not: null },
      },
      orderBy: { startedAt: "desc" },
      include: {
        competition: {
          include: {
            room: {
              include: {
                memberships: {
                  include: {
                    user: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!activeRound) {
      return NextResponse.json(
        { error: "No active round found" },
        { status: 400 }
      );
    }

    // Check if thumb game is active
    if (!activeRound.thumbGameActive) {
      return NextResponse.json(
        { error: "No thumb game is currently active" },
        { status: 400 }
      );
    }

    // Check if user already responded
    const responders = activeRound.thumbGameResponders ? JSON.parse(activeRound.thumbGameResponders) : [];
    if (responders.includes(userId)) {
      return NextResponse.json(
        { error: "You have already responded" },
        { status: 400 }
      );
    }

    // Add user to responders
    const updatedResponders = [...responders, userId];
    
    // Get total number of players in the room
    const totalPlayers = activeRound.competition.room.memberships.length;
    
    // Game ends when all players except one have responded (the one who didn't respond loses)
    const gameIsOver = updatedResponders.length >= totalPlayers - 1;
    
    // Find the loser by comparing clerkIds (dev-user-ids) since responders use clerkIds
    const allPlayerClerkIds = activeRound.competition.room.memberships.map((m: any) => m.user.clerkId);
    const loserClerkId = allPlayerClerkIds.find((clerkId: string) => !updatedResponders.includes(clerkId));
    
    // Get the loser's database ID for updating score
    const loserMembership = activeRound.competition.room.memberships.find((m: any) => m.user.clerkId === loserClerkId);
    const loserDbId = loserMembership?.userId;
    
    let updatedRound;
    
    if (gameIsOver && loserDbId) {
      // Loser loses - deduct 5 points
      await db.user.update({
        where: { id: loserDbId },
        data: { score: { decrement: 5 } },
      });
      
      // End thumb game - don't reset usedBy, just mark game as inactive
      updatedRound = await db.round.update({
        where: { id: activeRound.id },
        data: {
          thumbGameActive: false,
          thumbGameResponders: "[]", // Reset responders for next game
        },
      });
      
      // Broadcast thumb game ended with loser (using clerkId for frontend)
      broadcast("thumb-game:ended", {
        roundId: updatedRound.id,
        loserId: loserClerkId || loserDbId, // Use clerkId if available, fallback to dbId
        responders: updatedResponders,
      });
      
      // Also broadcast scores updated
      broadcast("scores:updated", {});
    } else {
      // Just add responder
      updatedRound = await db.round.update({
        where: { id: activeRound.id },
        data: {
          thumbGameResponders: JSON.stringify(updatedResponders),
        },
      });
      
      // Broadcast thumb game updated
      broadcast("thumb-game:updated", {
        roundId: updatedRound.id,
        responders: updatedResponders,
      });
    }

    return NextResponse.json({ 
      success: true,
      round: updatedRound,
      gameIsOver 
    });
  } catch (error) {
    console.error("Thumb game respond error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
