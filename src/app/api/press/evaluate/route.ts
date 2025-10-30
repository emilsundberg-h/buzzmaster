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
      include: {
        user: true,
        round: {
          include: {
            competition: {
              include: {
                room: true,
              },
            },
          },
        },
      },
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
        data: {
          buttonsEnabled: false,
          trophyId: null, // Clear trophy when disabling buttons after correct answer
        },
        include: {
          trophy: true,
        },
      });

      console.log("Buttons disabled after correct answer, trophy cleared");

      // Award trophy if this round has one
      if (press.round.trophyId) {
        console.log(
          `Awarding trophy ${press.round.trophyId} to user ${press.user.username} for correct buzzer press`
        );

        const trophyWin = await db.trophyWin.create({
          data: {
            userId: press.userId,
            trophyId: press.round.trophyId,
            source: "round",
            sourceId: press.roundId,
          },
          include: {
            trophy: true,
            user: true,
          },
        });

        // Broadcast trophy win
        console.log(`Broadcasting trophy:won for user ${press.user.username}`);
        broadcast("trophy:won", {
          userId: trophyWin.user.id,
          username: trophyWin.user.username,
          trophy: trophyWin.trophy,
          roomId: press.round.competition?.room?.id,
        });
      }

      // Broadcast that buttons are disabled (with round object wrapper)
      broadcast("buttons:disabled", { round: updatedRound });

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
