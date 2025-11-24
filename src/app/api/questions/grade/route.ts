import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { broadcastToRoom } from "@/lib/websocket";
import { addTrophyPlayerToDreamEleven } from "@/lib/trophy-helpers";

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

    // Get the usage to find the competition, room, and trophy
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
        trophy: true,
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

        // Award trophy if this question has one
        // Check if this is the first correct answer for THIS USAGE of the question
        const actualTrophyId = usage?.trophyId || usage?.playerTrophyId;
        if (usage && actualTrophyId) {
          // Check if anyone else has already been graded correct for this specific usage
          const otherCorrectAnswer = await db.answer.findFirst({
            where: {
              questionId: answer.questionId,
              competitionId: answer.competitionId,
              id: { not: answer.id }, // Not this answer
              isCorrect: true,
              reviewed: true,
            },
          });

          if (!otherCorrectAnswer) {
            console.log(
              `Awarding trophy ${actualTrophyId} to user ${user.username} - first correct answer for this usage`
            );

            // Check if this is a player trophy (format: player_<playerId>)
            if (actualTrophyId.startsWith('player_')) {
              // Handle player trophy - add directly to user's collection
              await addTrophyPlayerToDreamEleven(user.id, actualTrophyId);
              
              // Get player info for broadcast
              const playerId = actualTrophyId.replace('player_', '');
              const player = await db.player.findUnique({
                where: { id: playerId }
              });

              if (player && usage.competition.room) {
                console.log(`Broadcasting player:won for user ${user.username}`);
                broadcastToRoom(usage.competition.room.id, {
                  type: "trophy:won",
                  data: {
                    userId: user.id,
                    username: user.username,
                    trophy: {
                      id: actualTrophyId,
                      name: player.name,
                      imageKey: player.imageKey,
                    },
                    roomId: usage.competition.room.id,
                  },
                });
              }
            } else {
              // Handle traditional trophy - create TrophyWin record
              const trophyWin = await db.trophyWin.create({
                data: {
                  userId: user.id,
                  trophyId: actualTrophyId,
                  source: "question",
                  sourceId: usage.id,
                },
                include: {
                  trophy: true,
                },
              });

              // Check if it's also a player (legacy support)
              await addTrophyPlayerToDreamEleven(user.id, actualTrophyId);

              // Broadcast trophy win
              if (usage.competition.room) {
                console.log(
                  `Broadcasting trophy:won to room ${usage.competition.room.id}`
                );
                broadcastToRoom(usage.competition.room.id, {
                  type: "trophy:won",
                  data: {
                    userId: user.id,
                    username: user.username,
                    trophy: trophyWin.trophy,
                    roomId: usage.competition.room.id,
                  },
                });
              }
            }
          } else {
            console.log(
              `Trophy not awarded - another user already got it for this usage (${otherCorrectAnswer.userId})`
            );
          }
        }

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
