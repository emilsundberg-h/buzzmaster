import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcast } from "@/lib/websocket";

export async function POST() {
  try {
    await requireAdmin();

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

    // Find winner (first press)
    const winnerPress = await db.press.findFirst({
      where: { roundId: activeRound.id },
      orderBy: { pressedAt: "asc" },
      include: { user: true },
    });

    // End round and set winner
    const updatedRound = await db.round.update({
      where: { id: activeRound.id },
      data: {
        endedAt: new Date(),
        winnerUserId: winnerPress?.userId || null,
      },
    });

    // Give winner +1 point
    if (winnerPress) {
      await db.user.update({
        where: { id: winnerPress.userId },
        data: { score: { increment: 1 } },
      });
    }

    broadcast("round:ended", {
      round: updatedRound,
      winner: winnerPress?.user,
    });
    broadcast("scores:updated", {});

    return NextResponse.json({
      round: updatedRound,
      winner: winnerPress?.user,
    });
  } catch (error) {
    console.error("End round error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
