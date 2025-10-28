import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { broadcastToRoom } from "@/lib/websocket";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questionId } = body;

    if (!questionId) {
      return NextResponse.json(
        { error: "Question ID is required" },
        { status: 400 }
      );
    }

    // Get the question with all answers
    const question = await db.question.findUnique({
      where: { id: questionId },
      include: {
        answers: {
          include: {
            question: true,
          },
          orderBy: {
            answeredAt: "asc", // Order by when they answered (for FIRST_ONLY and DESCENDING)
          },
        },
        competition: {
          include: {
            room: true,
          },
        },
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      );
    }

    // For multiple choice, evaluate automatically based on isCorrect
    if (question.type === "MULTIPLE_CHOICE") {
      const correctAnswers = question.answers.filter((a) => a.isCorrect);

      // Apply scoring based on scoringType
      let updatedAnswers = [];

      switch (question.scoringType) {
        case "FIRST_ONLY":
          // Only first correct answer gets points
          if (correctAnswers.length > 0) {
            const firstCorrect = correctAnswers[0];
            const updated = await db.answer.update({
              where: { id: firstCorrect.id },
              data: {
                points: question.points,
                reviewed: true,
                reviewedAt: new Date(),
              },
            });
            updatedAnswers.push(updated);

            // Award points to user (create if doesn't exist)
            let user = await db.user.findUnique({
              where: { clerkId: firstCorrect.userId },
            });

            if (!user) {
              console.log(`Creating user ${firstCorrect.userId} for scoring`);
              const randomSuffix = Math.random().toString(36).substring(2, 8);
              user = await db.user.create({
                data: {
                  clerkId: firstCorrect.userId,
                  username: `User-${randomSuffix}`,
                  avatarKey: `avatar-${randomSuffix}`,
                  score: question.points,
                },
              });
            } else {
              await db.user.update({
                where: { clerkId: firstCorrect.userId },
                data: {
                  score: {
                    increment: question.points,
                  },
                },
              });
            }
          }
          break;

        case "DESCENDING":
          // Descending points: 1st gets most, last gets least
          const participantCount = correctAnswers.length;
          for (let i = 0; i < correctAnswers.length; i++) {
            const answer = correctAnswers[i];
            const points = Math.max(1, participantCount - i); // Ensure at least 1 point

            const updated = await db.answer.update({
              where: { id: answer.id },
              data: {
                points,
                reviewed: true,
                reviewedAt: new Date(),
              },
            });
            updatedAnswers.push(updated);

            // Award points to user (create if doesn't exist)
            let user = await db.user.findUnique({
              where: { clerkId: answer.userId },
            });

            if (!user) {
              console.log(`Creating user ${answer.userId} for scoring`);
              const randomSuffix = Math.random().toString(36).substring(2, 8);
              user = await db.user.create({
                data: {
                  clerkId: answer.userId,
                  username: `User-${randomSuffix}`,
                  avatarKey: `avatar-${randomSuffix}`,
                  score: points,
                },
              });
            } else {
              await db.user.update({
                where: { clerkId: answer.userId },
                data: {
                  score: {
                    increment: points,
                  },
                },
              });
            }
          }
          break;

        case "ALL_EQUAL":
          // All correct answers get the same points
          for (const answer of correctAnswers) {
            const updated = await db.answer.update({
              where: { id: answer.id },
              data: {
                points: question.points,
                reviewed: true,
                reviewedAt: new Date(),
              },
            });
            updatedAnswers.push(updated);

            // Award points to user (create if doesn't exist)
            let user = await db.user.findUnique({
              where: { clerkId: answer.userId },
            });

            if (!user) {
              console.log(`Creating user ${answer.userId} for scoring`);
              const randomSuffix = Math.random().toString(36).substring(2, 8);
              user = await db.user.create({
                data: {
                  clerkId: answer.userId,
                  username: `User-${randomSuffix}`,
                  avatarKey: `avatar-${randomSuffix}`,
                  score: question.points,
                },
              });
            } else {
              await db.user.update({
                where: { clerkId: answer.userId },
                data: {
                  score: {
                    increment: question.points,
                  },
                },
              });
            }
          }
          break;
      }

      // Mark all incorrect answers as reviewed with 0 points
      const incorrectAnswers = question.answers.filter((a) => !a.isCorrect);
      for (const answer of incorrectAnswers) {
        await db.answer.update({
          where: { id: answer.id },
          data: {
            points: 0,
            reviewed: true,
            reviewedAt: new Date(),
          },
        });
      }
    }

    // Mark question as completed
    await db.question.update({
      where: { id: questionId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    // Broadcast question completed and score updates
    if (question.competition.room) {
      broadcastToRoom(question.competition.room.id, {
        type: "question:completed",
        data: {
          questionId,
        },
      });

      // Also broadcast score updates
      broadcastToRoom(question.competition.room.id, {
        type: "scores:updated",
        data: {},
      });
    }

    return NextResponse.json({
      success: true,
      message: "Question evaluated successfully",
    });
  } catch (error) {
    console.error("Evaluate question error:", error);
    return NextResponse.json(
      { error: "Failed to evaluate question" },
      { status: 500 }
    );
  }
}
