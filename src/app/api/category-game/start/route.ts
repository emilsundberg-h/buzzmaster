import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { broadcastToRoom } from "@/lib/websocket";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      competitionId,
      categoryName,
      timePerPlayer,
      winnerPoints,
      trophyId,
    } = body;

    if (!competitionId || !categoryName || !timePerPlayer || !winnerPoints) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get competition and room
    const competition = await db.competition.findUnique({
      where: { id: competitionId },
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
    });

    if (!competition) {
      return NextResponse.json(
        { error: "Competition not found" },
        { status: 404 }
      );
    }

    // Get all users in the room
    const users = competition.room.memberships.map((m) => m.user);

    // Shuffle the turn order using Fisher-Yates algorithm for proper randomization
    const shuffled = [...users];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const turnOrder = shuffled.map((u) => u.clerkId);
    
    console.log('Category game turn order (randomized):', turnOrder.map((id, idx) => {
      const user = shuffled[idx];
      return `${idx + 1}. ${user.username} (${id})`;
    }).join(', '));

    // Determine if trophy is a player trophy
    const isPlayerTrophy = trophyId?.startsWith('player_');
    const actualTrophyId = isPlayerTrophy ? null : trophyId;
    const playerTrophyId = isPlayerTrophy ? trophyId : null;

    // Create the category game
    const categoryGame = await db.categoryGame.create({
      data: {
        competitionId,
        categoryName,
        timePerPlayer,
        winnerPoints,
        turnOrder: JSON.stringify(turnOrder),
        currentTurnIndex: 0,
        currentPlayerId: turnOrder[0],
        status: "ACTIVE",
        isPaused: false,
        timerStartedAt: new Date(),
        startedAt: new Date(),
        trophyId: actualTrophyId,
        playerTrophyId: playerTrophyId,
      },
    });

    // Broadcast to room
    broadcastToRoom(competition.room.id, {
      type: "category-game:started",
      data: {
        id: categoryGame.id,
        categoryName: categoryGame.categoryName,
        timePerPlayer: categoryGame.timePerPlayer,
        winnerPoints: categoryGame.winnerPoints,
        turnOrder: turnOrder,
        currentPlayerId: categoryGame.currentPlayerId,
        currentPlayerInfo: shuffled[0],
        timerStartedAt: categoryGame.timerStartedAt,
        status: categoryGame.status,
        roomId: competition.room.id,
      },
    });

    return NextResponse.json({ categoryGame });
  } catch (error) {
    console.error("Start category game error:", error);
    return NextResponse.json(
      { error: "Failed to start category game" },
      { status: 500 }
    );
  }
}
