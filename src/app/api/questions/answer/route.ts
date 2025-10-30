import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { broadcastToRoom } from "@/lib/websocket";

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-dev-user-id");
    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 401 });
    }

    const body = await request.json();
    const { questionId, competitionId, answer } = body;

    if (!questionId || !competitionId || !answer) {
      return NextResponse.json(
        { error: "Question ID, Competition ID and answer are required" },
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

    // Get the question usage for this competition
    const usage = await db.questionUsage.findUnique({
      where: {
        questionId_competitionId: {
          questionId,
          competitionId,
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

    if (!usage) {
      return NextResponse.json(
        { error: "Question not sent to this competition" },
        { status: 404 }
      );
    }

    if (usage.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Question is not active" },
        { status: 400 }
      );
    }

    // Check if user already answered
    const existingAnswer = await db.answer.findUnique({
      where: {
        questionId_competitionId_userId: {
          questionId,
          competitionId,
          userId,
        },
      },
    });

    if (existingAnswer) {
      return NextResponse.json(
        { error: "Already answered this question" },
        { status: 400 }
      );
    }

    console.log("======================");
    console.log("ANSWER API - Question type:", question.type);
    console.log("ANSWER API - Has trophy?", !!usage.trophyId);
    console.log("======================");

    // For multiple choice, automatically check if correct
    let isCorrect = false;
    let pointsToAward = 0;

    if (question.type === "MULTIPLE_CHOICE") {
      isCorrect =
        answer.trim().toLowerCase() ===
        question.correctAnswer.trim().toLowerCase();

      // Calculate points based on scoring type if answer is correct
      if (isCorrect) {
        switch (question.scoringType) {
          case "FIRST_ONLY":
            // Check if this is the first correct answer for this competition
            const existingCorrectAnswers = await db.answer.count({
              where: {
                questionId,
                competitionId,
                isCorrect: true,
              },
            });
            pointsToAward = existingCorrectAnswers === 0 ? question.points : 0;
            break;

          case "DESCENDING":
            // Points decrease based on how many have already answered correctly
            const correctAnswerCount = await db.answer.count({
              where: {
                questionId,
                competitionId,
                isCorrect: true,
              },
            });
            // Give points based on position (1st gets most, 2nd gets less, etc.)
            pointsToAward = Math.max(1, question.points - correctAnswerCount);
            break;

          case "ALL_EQUAL":
            // Everyone gets the same points
            pointsToAward = question.points;
            break;
        }
      }
    }

    // Ensure user exists in database (for dev mode compatibility)
    let user = await db.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        username: true,
        avatarKey: true,
      },
    });

    // Create user if doesn't exist (dev mode)
    if (!user) {
      console.log(`Creating user ${userId} (dev mode)`);
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const createdUser = await db.user.create({
        data: {
          clerkId: userId,
          username: `User-${randomSuffix}`,
          avatarKey: `avatar-${randomSuffix}`,
          score: 0,
        },
      });
      user = {
        id: createdUser.id,
        username: createdUser.username,
        avatarKey: createdUser.avatarKey,
      };
    }

    // Award points to user if correct (for multiple choice)
    console.log("=== CHECKING IF SHOULD AWARD POINTS ===");
    console.log("Question type:", question.type);
    console.log("Is correct:", isCorrect);
    console.log("Points to award:", pointsToAward);
    console.log(
      "Condition met?",
      question.type === "MULTIPLE_CHOICE" && isCorrect && pointsToAward > 0
    );

    if (question.type === "MULTIPLE_CHOICE" && isCorrect && pointsToAward > 0) {
      console.log("AWARDING POINTS TO USER:", userId, "Points:", pointsToAward);
      await db.user.update({
        where: { clerkId: userId },
        data: {
          score: {
            increment: pointsToAward,
          },
        },
      });

      // Broadcast score update
      if (usage.competition.room) {
        console.log("BROADCASTING scores:updated");
        broadcastToRoom(usage.competition.room.id, {
          type: "scores:updated",
          data: {},
        });
      }
    } else {
      console.log("NOT awarding points (condition not met)");
    }

    // Create answer
    const userAnswer = await db.answer.create({
      data: {
        questionId,
        competitionId,
        userId,
        text: answer,
        normalized: answer.trim().toLowerCase(),
        isCorrect: question.type === "MULTIPLE_CHOICE" ? isCorrect : false,
        points: pointsToAward, // Points assigned immediately for multiple choice
        reviewed: question.type === "MULTIPLE_CHOICE", // Auto-reviewed for multiple choice
        reviewedAt: question.type === "MULTIPLE_CHOICE" ? new Date() : null,
      },
    });

    // Broadcast answer received to admin
    if (usage.competition.room) {
      broadcastToRoom(usage.competition.room.id, {
        type: "question:answered",
        data: {
          questionId,
          competitionId,
          userId,
          username: user?.username,
          answeredAt: userAnswer.answeredAt,
        },
      });
    }

    return NextResponse.json({ answer: userAnswer });
  } catch (error) {
    console.error("Submit answer error:", error);
    return NextResponse.json(
      { error: "Failed to submit answer" },
      { status: 500 }
    );
  }
}
