import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { broadcastToRoom } from "@/lib/websocket";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameId, eliminateCurrentPlayer = true } = body;

    if (!gameId) {
      return NextResponse.json({ error: "Game ID required" }, { status: 400 });
    }

    const game = await db.categoryGame.findUnique({
      where: { id: gameId },
      include: {
        competition: {
          include: {
            room: {
              include: {
                memberships: {
                  include: {
                    user: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const turnOrder = JSON.parse(game.turnOrder);
    const eliminatedPlayers = JSON.parse(game.eliminatedPlayers);

    // Eliminate current player if requested
    if (eliminateCurrentPlayer && game.currentPlayerId) {
      eliminatedPlayers.push(game.currentPlayerId);
    }

    // Remove eliminated players from turn order
    const activePlayers = turnOrder.filter(
      (userId: string) => !eliminatedPlayers.includes(userId)
    );

    // Check if only one player left
    if (activePlayers.length === 1) {
      // We have a winner!
      const winner = activePlayers[0];

      // Update user score
      const user = await db.user.findUnique({
        where: { clerkId: winner },
      });

      if (user) {
        await db.user.update({
          where: { id: user.id },
          data: {
            score: {
              increment: game.winnerPoints,
            },
          },
        });

        // Award trophy if this game has one
        if (game.trophyId) {
          console.log(
            `Awarding trophy ${game.trophyId} to user ${user.username} for winning category game`
          );

          const trophyWin = await db.trophyWin.create({
            data: {
              userId: user.id,
              trophyId: game.trophyId,
              source: "category",
              sourceId: gameId,
            },
            include: {
              trophy: true,
            },
          });

          // Broadcast trophy win
          console.log(
            `Broadcasting trophy:won to room ${game.competition.room.id} for user ${user.username}`
          );
          broadcastToRoom(game.competition.room.id, {
            type: "trophy:won",
            data: {
              userId: user.id,
              username: user.username,
              trophy: trophyWin.trophy,
              roomId: game.competition.room.id,
            },
          });
        }
      }

      // Complete the game
      const updatedGame = await db.categoryGame.update({
        where: { id: gameId },
        data: {
          status: "COMPLETED",
          winnerId: winner,
          eliminatedPlayers: JSON.stringify(eliminatedPlayers),
          completedAt: new Date(),
          isPaused: true,
        },
      });

      // Broadcast winner
      broadcastToRoom(game.competition.room.id, {
        type: "category-game:completed",
        data: {
          id: updatedGame.id,
          winnerId: winner,
          winnerPoints: game.winnerPoints,
          status: "COMPLETED",
        },
      });

      // Also broadcast score update
      broadcastToRoom(game.competition.room.id, {
        type: "scores:updated",
        data: {},
      });

      return NextResponse.json({ game: updatedGame, winner });
    }

    // Move to next player
    const currentIndex = activePlayers.indexOf(game.currentPlayerId);
    const nextIndex = (currentIndex + 1) % activePlayers.length;
    const nextPlayerId = activePlayers[nextIndex];

    // Get next player info
    const nextPlayerInfo = game.competition.room.memberships.find(
      (m) => m.user.clerkId === nextPlayerId
    )?.user;

    // Update game
    const updatedGame = await db.categoryGame.update({
      where: { id: gameId },
      data: {
        currentPlayerId: nextPlayerId,
        currentTurnIndex: turnOrder.indexOf(nextPlayerId),
        eliminatedPlayers: JSON.stringify(eliminatedPlayers),
        timerStartedAt: new Date(),
        isPaused: false,
        pausedTimeElapsed: 0,
      },
    });

    // Broadcast next player
    broadcastToRoom(game.competition.room.id, {
      type: "category-game:next-player",
      data: {
        id: updatedGame.id,
        currentPlayerId: nextPlayerId,
        currentPlayerInfo: nextPlayerInfo,
        timerStartedAt: updatedGame.timerStartedAt,
        eliminatedPlayers: eliminatedPlayers,
        remainingPlayers: activePlayers.length,
      },
    });

    return NextResponse.json({ game: updatedGame });
  } catch (error) {
    console.error("Next player error:", error);
    return NextResponse.json(
      { error: "Failed to move to next player" },
      { status: 500 }
    );
  }
}
