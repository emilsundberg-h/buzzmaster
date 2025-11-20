import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcast } from "@/lib/websocket";

export async function POST(request: NextRequest) {
  try {
    // In dev mode, skip admin check
    const body = await request.json().catch(() => ({}));
    const { trophyId } = body;

    console.log("=== ENABLE BUTTONS API ===");
    console.log("Trophy ID:", trophyId);
    console.log("==========================");

    // Find active round
    const activeRound = await db.round.findFirst({
      where: {
        endedAt: null,
        startedAt: { not: null },
      },
      orderBy: { startedAt: "desc" },
    });

    if (!activeRound) {
      return NextResponse.json(
        { error: "No active round found" },
        { status: 400 }
      );
    }

    // Enable buttons with optional trophy
    // Separate handling for player trophies vs traditional trophies
    const updateData: any = {
      buttonsEnabled: true,
    };
    
    if (trophyId) {
      if (trophyId.startsWith('player_')) {
        // Store player trophy ID separately
        updateData.playerTrophyId = trophyId;
        updateData.trophyId = null;
      } else {
        // Store traditional trophy ID
        updateData.trophyId = trophyId;
        updateData.playerTrophyId = null;
      }
    } else {
      // Clear both trophy fields
      updateData.trophyId = null;
      updateData.playerTrophyId = null;
    }
    
    const updatedRound = await db.round.update({
      where: { id: activeRound.id },
      data: updateData,
    });

    // Handle trophy information for broadcast
    let trophyInfo = null;
    if (trophyId) {
      if (trophyId.startsWith('player_')) {
        // Handle player trophy
        const playerId = trophyId.replace('player_', '');
        const player = await db.player.findUnique({
          where: { id: playerId }
        });
        if (player) {
          trophyInfo = {
            id: trophyId,
            name: player.name,
            imageKey: player.imageKey,
          };
        }
      } else {
        // Handle traditional trophy
        const trophy = await db.trophy.findUnique({
          where: { id: trophyId }
        });
        if (trophy) {
          trophyInfo = trophy;
        }
      }
    }

    console.log(
      "Round updated with trophy:",
      trophyInfo?.name || "none"
    );

    // Create round object with trophy info for broadcast
    const roundWithTrophy = {
      ...updatedRound,
      trophy: trophyInfo,
    };

    broadcast("buttons:enabled", { round: roundWithTrophy });

    return NextResponse.json({ round: roundWithTrophy });
  } catch (error) {
    console.error("Enable buttons error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
