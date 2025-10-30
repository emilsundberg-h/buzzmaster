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
    const updatedRound = await db.round.update({
      where: { id: activeRound.id },
      data: {
        buttonsEnabled: true,
        trophyId: trophyId || null, // Set trophy when enabling buttons
      },
      include: {
        trophy: true, // Include trophy information in broadcast
      },
    });

    console.log(
      "Round updated with trophy:",
      updatedRound.trophy?.name || "none"
    );

    broadcast("buttons:enabled", { round: updatedRound });

    return NextResponse.json({ round: updatedRound });
  } catch (error) {
    console.error("Enable buttons error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
