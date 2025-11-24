import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { broadcastToRoom } from "@/lib/websocket";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questionId, competitionId, trophyId } = body;

    console.log("========================================");
    console.log("=== SENDING QUESTION (API) ===");
    console.log("Question ID:", questionId);
    console.log("Trophy ID from body:", trophyId);
    console.log("Trophy ID type:", typeof trophyId);
    console.log("Trophy ID is null?", trophyId === null);
    console.log("Trophy ID is undefined?", trophyId === undefined);
    console.log("Trophy ID || null:", trophyId || null);
    console.log("========================================");

    if (!questionId || !competitionId) {
      return NextResponse.json(
        { error: "Question ID and Competition ID are required" },
        { status: 400 }
      );
    }

    // Get the question
    const question = await db.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // Get the competition with room info
    const competition = await db.competition.findUnique({
      where: { id: competitionId },
      include: {
        room: true,
      },
    });

    if (!competition) {
      return NextResponse.json(
        { error: "Competition not found" },
        { status: 404 }
      );
    }

    // Determine if trophy is a player trophy
    const isPlayerTrophy = trophyId?.startsWith('player_');
    const actualTrophyId = isPlayerTrophy ? null : trophyId;
    const playerTrophyId = isPlayerTrophy ? trophyId : null;

    // Create or update QuestionUsage
    const usage = await db.questionUsage.upsert({
      where: {
        questionId_competitionId: {
          questionId,
          competitionId,
        },
      },
      create: {
        questionId,
        competitionId,
        status: "ACTIVE",
        sentAt: new Date(),
        trophyId: actualTrophyId,
        playerTrophyId: playerTrophyId,
      },
      update: {
        status: "ACTIVE",
        sentAt: new Date(),
        trophyId: actualTrophyId,
        playerTrophyId: playerTrophyId,
      },
      include: {
        trophy: true,
      },
    });

    // Parse options if it's a multiple choice question
    const questionData = {
      ...question,
      options: question.options ? JSON.parse(question.options) : null,
    };

    // Build trophy object for broadcast
    let trophyData = null;
    if (usage.trophy) {
      // Traditional trophy
      trophyData = usage.trophy;
    } else if (playerTrophyId) {
      // Player trophy - fetch player info
      const playerId = playerTrophyId.replace('player_', '');
      const player = await db.player.findUnique({
        where: { id: playerId }
      });
      if (player) {
        trophyData = {
          id: playerTrophyId,
          name: player.name,
          imageKey: player.imageKey,
          description: `${player.type === 'FOOTBALLER' ? '⚽ Footballer' : '🎵 Artist'} - ${player.position}`,
        };
      }
    }

    // Broadcast question to all users in the room via WebSocket
    if (competition.room) {
      broadcastToRoom(competition.room.id, {
        type: "question:sent",
        data: {
          question: {
            id: questionData.id,
            text: questionData.text,
            type: questionData.type,
            imageUrl: questionData.imageUrl,
            options: questionData.options,
            points: questionData.points,
            scoringType: questionData.scoringType,
          },
          competitionId,
          trophy: trophyData, // Include trophy info if exists
        },
      });
    }

    return NextResponse.json({ question: questionData, usage });
  } catch (error) {
    console.error("Send question error:", error);
    return NextResponse.json(
      { error: "Failed to send question" },
      { status: 500 }
    );
  }
}
