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

    // Resume timer
    const updatedGame = await db.categoryGame.update({
      where: { id: gameId },
      data: {
        isPaused: false,
        timerStartedAt: new Date(),
        timerPausedAt: null,
      },
    });

    // Broadcast to room
    broadcastToRoom(game.competition.room.id, {
      type: "category-game:resumed",
      data: {
        id: updatedGame.id,
        isPaused: false,
        timerStartedAt: updatedGame.timerStartedAt,
        pausedTimeElapsed: updatedGame.pausedTimeElapsed,
        roomId: game.competition.room.id,
      },
    });

    return NextResponse.json({ game: updatedGame });
  } catch (error) {
    console.error("Resume category game error:", error);
    return NextResponse.json(
      { error: "Failed to resume game" },
      { status: 500 }
    );
  }
}
