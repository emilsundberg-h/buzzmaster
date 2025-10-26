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

    // Disable buttons and clear all presses for this round
    const updatedRound = await db.round.update({
      where: { id: activeRound.id },
      data: { buttonsEnabled: false },
    });

    // Clear all presses for this round so users can press again when buttons are enabled
    await db.press.deleteMany({
      where: { roundId: activeRound.id },
    });

    console.log(`Cleared all presses for round ${activeRound.id}`);

    broadcast("buttons:disabled", updatedRound);
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
