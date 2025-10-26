import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcast } from "@/lib/websocket";

export async function POST(request: Request) {
  try {
    await requireUser(); // Verify admin is logged in

    const body = await request.json();
    const { pressId } = body;

    if (!pressId) {
      return NextResponse.json(
        { error: "pressId is required" },
        { status: 400 }
      );
    }

    // Get the current press
    const currentPress = await db.press.findUnique({
      where: { id: pressId },
      include: {
        user: true,
        round: true,
      },
    });

    if (!currentPress) {
      return NextResponse.json({ error: "Press not found" }, { status: 404 });
    }

    // Get all presses for this round, ordered by time
    const allPresses = await db.press.findMany({
      where: { roundId: currentPress.roundId },
      orderBy: { pressedAt: "asc" },
      include: { user: true },
    });

    if (!currentPress.round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    // Find the next press in queue (not the current winner)
    // This will be the first press that comes after the current winner
    const nextPress = allPresses.find((p) => p.userId !== currentPress.userId);

    if (!nextPress) {
      return NextResponse.json(
        { error: "No one else in queue" },
        { status: 400 }
      );
    }

    // Delete current press (the one who timed out or gave wrong answer)
    await db.press.delete({
      where: { id: pressId },
    });

    // Update round to set next presser as winner
    const updatedRound = await db.round.update({
      where: { id: currentPress.roundId },
      data: { winnerUserId: nextPress.userId },
    });

    // Give next user a timer if timer is enabled
    if (currentPress.round.timerDuration) {
      const timerExpiresAt = new Date(
        Date.now() + currentPress.round.timerDuration * 1000
      );

      // Update next user's press to have a timer
      await db.press.update({
        where: { id: nextPress.id },
        data: { timerExpiresAt },
      });
    }

    // Send negative points to current user
    const currentUser = await db.user.update({
      where: { id: currentPress.userId },
      data: {
        score: {
          decrement: 1, // Default -1 point for wrong answer
        },
      },
    });

    // Broadcast the round update (same as round:started)
    broadcast("round:started", updatedRound);

    broadcast("scores:updated", {});

    return NextResponse.json({
      success: true,
      nextUserId: nextPress.userId,
    });
  } catch (error) {
    console.error("Give to next error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
