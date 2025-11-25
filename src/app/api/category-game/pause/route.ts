import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { broadcastToRoom } from "@/lib/websocket";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameId } = body;

    if (!gameId) {
      return NextResponse.json({ error: "Game ID required" }, { status: 400 });
    }

    const game = await db.categoryGame.findUnique({
      where: { id: gameId },
      include: {
        competition: {
          include: {
            room: true,
          },
        },
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    // Calculate elapsed time
    const now = new Date();
    const elapsedMs = game.timerStartedAt
      ? now.getTime() - new Date(game.timerStartedAt).getTime()
      : 0;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    // Update game to paused state
    const updatedGame = await db.categoryGame.update({
      where: { id: gameId },
      data: {
        isPaused: true,
        timerPausedAt: now,
        pausedTimeElapsed: game.pausedTimeElapsed + elapsedSeconds,
      },
    });

    // Broadcast to room
    broadcastToRoom(game.competition.room.id, {
      type: "category-game:paused",
      data: {
        id: updatedGame.id,
        isPaused: true,
        pausedTimeElapsed: updatedGame.pausedTimeElapsed,
        roomId: game.competition.room.id,
      },
    });

    return NextResponse.json({ game: updatedGame });
  } catch (error) {
    console.error("Pause category game error:", error);
    return NextResponse.json(
      { error: "Failed to pause game" },
      { status: 500 }
    );
  }
}
