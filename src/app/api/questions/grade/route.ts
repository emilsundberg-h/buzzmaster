import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { broadcastToRoom } from "@/lib/websocket";

// For manually grading free text answers
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { answerId, isCorrect, points } = body;

    if (!answerId || typeof isCorrect !== "boolean") {
      return NextResponse.json(
        { error: "Answer ID and isCorrect status are required" },
        { status: 400 }
      );
    }

    // Get the answer with question and usage info
    const answer = await db.answer.findUnique({
      where: { id: answerId },
      include: {
        question: true,
      },
    });

    if (!answer) {
      return NextResponse.json({ error: "Answer not found" }, { status: 404 });
    }

    // Get the usage to find the competition and room
    const usage = await db.questionUsage.findUnique({
      where: {
        questionId_competitionId: {
          questionId: answer.questionId,
          competitionId: answer.competitionId,
        },
      },
      include: {
        competition: {
          include: {
            room: true,
          },
        },
      },
    });

    if (!answer) {
      return NextResponse.json({ error: "Answer not found" }, { status: 404 });
    }

    // Check if answer is already reviewed - prevent double grading
    if (answer.reviewed) {
      return NextResponse.json(
        { error: "Answer already graded" },
        { status: 400 }
      );
    }

    // Calculate points to award
    const pointsToAward = isCorrect
      ? points !== undefined
        ? points
        : answer.question.points
      : 0;

    // Update answer
    const updatedAnswer = await db.answer.update({
      where: { id: answerId },
      data: {
        isCorrect,
        points: pointsToAward,
        reviewed: true,
        reviewedAt: new Date(),
      },
    });

    // Award points to user if correct
    if (isCorrect && pointsToAward > 0) {
      // Check if user exists first (for dev mode compatibility)
      const user = await db.user.findUnique({
        where: { clerkId: answer.userId },
      });

      if (user) {
        await db.user.update({
          where: { clerkId: answer.userId },
          data: {
            score: {
              increment: pointsToAward,
            },
          },
        });

        // Broadcast score update
        if (usage && usage.competition.room) {
          broadcastToRoom(usage.competition.room.id, {
            type: "scores:updated",
            data: {},
          });
        }
      } else {
        console.warn(
          `User ${answer.userId} not found in database - skipping score update`
        );
      }
    }

    return NextResponse.json({ answer: updatedAnswer });
  } catch (error) {
    console.error("Grade answer error:", error);
    return NextResponse.json(
      { error: "Failed to grade answer" },
      { status: 500 }
    );
  }
}
