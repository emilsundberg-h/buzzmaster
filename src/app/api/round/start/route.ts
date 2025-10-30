import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcast } from "@/lib/websocket";

export async function POST(request: Request) {
  try {
    // In dev mode, skip admin check

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { timerEnabled, timerDuration, trophyId } = body;
    console.log("=== ROUND START API ===");
    console.log("timerEnabled:", timerEnabled);
    console.log("timerDuration:", timerDuration);
    console.log("trophyId:", trophyId);

    // Find active competition
    const activeCompetition = await db.competition.findFirst({
      where: { status: "ACTIVE" },
    });

    if (!activeCompetition) {
      return NextResponse.json(
        { error: "No active competition found" },
        { status: 400 }
      );
    }

    // Calculate timer end time if timer is enabled
    const timerEndsAt =
      timerEnabled && timerDuration
        ? new Date(Date.now() + timerDuration * 1000)
        : null;

    // Create new round
    const hasTimer = Boolean(timerEnabled);
    console.log(
      "Creating round with hasTimer:",
      hasTimer,
      "timerDuration:",
      timerDuration
    );
    const round = await db.round.create({
      data: {
        competitionId: activeCompetition.id,
        startedAt: new Date(),
        buttonsEnabled: false,
        hasTimer: hasTimer,
        timerDuration: timerDuration || null,
        timerEndsAt: timerEndsAt,
        trophyId: trophyId || null,
      },
      include: {
        trophy: true, // Include trophy information in broadcast
      },
    });

    console.log("Broadcasting round:started event with round:", round);
    console.log("Round details:", {
      id: round.id,
      startedAt: round.startedAt,
      endedAt: round.endedAt,
      buttonsEnabled: round.buttonsEnabled,
      competitionId: round.competitionId,
      trophyId: round.trophyId,
    });
    broadcast("round:started", round);

    return NextResponse.json({ round });
  } catch (error) {
    console.error("Round start error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
