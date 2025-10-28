import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcast } from "@/lib/websocket";

export async function POST(request: NextRequest) {
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
        buttonsEnabled: true,
      },
      orderBy: { startedAt: "desc" },
    });

    if (!activeRound) {
      return NextResponse.json(
        { error: "No active round with enabled buttons" },
        { status: 400 }
      );
    }

    // Check if user already pressed
    const existingPress = await db.press.findUnique({
      where: {
        roundId_userId: {
          roundId: activeRound.id,
          userId: user.id,
        },
      },
    });

    if (existingPress) {
      return NextResponse.json(
        { error: "Already pressed in this round" },
        { status: 409 }
      );
    }

    // Check if this is the first press (no other presses for this round)
    const otherPresses = await db.press.findFirst({
      where: {
        roundId: activeRound.id,
      },
    });

    const isFirstPress = !otherPresses;

    // Only give timer to the first presser if hasTimer is enabled
    const timerExpiresAt =
      isFirstPress && activeRound.hasTimer && activeRound.timerDuration
        ? new Date(Date.now() + activeRound.timerDuration * 1000)
        : null;

    console.log("=== PRESS API ===");
    console.log("isFirstPress:", isFirstPress);
    console.log("activeRound.hasTimer:", activeRound.hasTimer);
    console.log("activeRound.timerDuration:", activeRound.timerDuration);
    console.log("timerExpiresAt:", timerExpiresAt);

    // Create press
    const press = await db.press.create({
      data: {
        roundId: activeRound.id,
        userId: user.id,
        pressedAt: new Date(),
        timerExpiresAt,
      },
      include: { user: true },
    });

    // If this is the first press, set the winner
    if (isFirstPress) {
      // Update the round to set the winner
      const updatedRound = await db.round.update({
        where: { id: activeRound.id },
        data: { winnerUserId: user.id },
      });

      console.log(
        `First press for round ${activeRound.id}, setting winner: ${user.id}`
      );

      // Broadcast the round update
      broadcast("round:started", updatedRound);
    }

    broadcast("press:new", press);

    return NextResponse.json({ press });
  } catch (error) {
    console.error("Press error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
