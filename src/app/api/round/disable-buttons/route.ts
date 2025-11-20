import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcast } from "@/lib/websocket";

export async function POST() {
  try {
    // In dev mode, skip admin check

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

    // Disable buttons, clear trophy, and prepare to clear presses
    const updatedRound = await db.round.update({
      where: { id: activeRound.id },
      data: {
        buttonsEnabled: false,
        trophyId: null, // Clear trophy when disabling buttons
        playerTrophyId: null, // Clear player trophy as well
      },
      include: {
        trophy: true, // Include trophy information in broadcast (will be null now)
      },
    });

    console.log("Buttons disabled, trophy cleared");

    // Clear all presses for this round so users can press again when buttons are enabled
    await db.press.deleteMany({
      where: { roundId: activeRound.id },
    });

    console.log(`Cleared all presses for round ${activeRound.id}`);

    broadcast("buttons:disabled", { round: updatedRound });
    // Clear live press feed
    broadcast("presses:cleared", { roundId: activeRound.id });

    return NextResponse.json({ round: updatedRound });
  } catch (error) {
    console.error("Disable buttons error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
