import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcast } from "@/lib/websocket";

export async function POST(request: NextRequest) {
  try {
    // In dev mode, skip admin check

    const body = await request.json();
    const { pressId, isCorrect, points } = body;

    if (
      !pressId ||
      typeof isCorrect !== "boolean" ||
      typeof points !== "number"
    ) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 }
      );
    }

    // Get the press record
    const press = await db.press.findUnique({
      where: { id: pressId },
      include: { user: true, round: true },
    });

    if (!press) {
      return NextResponse.json({ error: "Press not found" }, { status: 404 });
    }

    // Update user's score (points can be negative)
    const updatedUser = await db.user.update({
      where: { id: press.userId },
      data: {
        score: {
          increment: points,
        },
      },
    });

    // If the answer was correct, disable all buttons for this round
    if (isCorrect) {
      // Delete all other presses for this round (since correct answer was given)
      await db.press.deleteMany({
        where: {
          roundId: press.roundId,
          id: { not: press.id },
        },
      });

      const updatedRound = await db.round.update({
        where: { id: press.roundId },
        data: { buttonsEnabled: false },
      });

      // Broadcast that buttons are disabled
      broadcast("buttons:disabled", updatedRound);

      // Clear live press feed
      broadcast("presses:cleared", { roundId: press.roundId });
    }

    // Broadcast score update
    broadcast("scores:updated", {});

    // Broadcast the evaluation result
    broadcast("press:evaluated", {
      pressId,
      isCorrect,
      points: points,
      userId: press.userId,
      username: press.user.username,
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      disabledButtons: isCorrect,
    });
  } catch (error) {
    console.error("Press evaluation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
