import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const userId = await requireUser();

    // Get user
    const user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Find active round
    const activeRound = await db.round.findFirst({
      where: {
        endedAt: null,
        startedAt: { not: null },
      },
      orderBy: { startedAt: "desc" },
    });

    if (!activeRound) {
      return NextResponse.json({ press: null });
    }

    // Find user's press for this round
    const press = await db.press.findUnique({
      where: {
        roundId_userId: {
          roundId: activeRound.id,
          userId: user.id,
        },
      },
      select: {
        id: true,
        pressedAt: true,
        timerExpiresAt: true,
      },
    });

    // Only return timerExpiresAt if this user is the winner
    let responsePress = press;
    if (press && activeRound.winnerUserId !== user.id) {
      // User is NOT winner, don't return timer
      responsePress = {
        ...press,
        timerExpiresAt: null,
      };
    }

    return NextResponse.json({ press: responsePress });
  } catch (error) {
    console.error("Get user press error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
