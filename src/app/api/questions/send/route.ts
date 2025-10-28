import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { broadcastToRoom } from "@/lib/websocket";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questionId, competitionId } = body;

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
      },
      update: {
        status: "ACTIVE",
        sentAt: new Date(),
      },
    });

    // Parse options if it's a multiple choice question
    const questionData = {
      ...question,
      options: question.options ? JSON.parse(question.options) : null,
    };

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
