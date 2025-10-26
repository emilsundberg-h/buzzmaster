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

    // Enable buttons
    const updatedRound = await db.round.update({
      where: { id: activeRound.id },
      data: { buttonsEnabled: true },
    });

    broadcast("buttons:enabled", updatedRound);

    return NextResponse.json({ round: updatedRound });
  } catch (error) {
    console.error("Enable buttons error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
