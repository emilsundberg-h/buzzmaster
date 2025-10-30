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

    // Get question usage to find competition and trophy
    // Find the ACTIVE usage to ensure we get the current one, not an old one
    const usage = await db.questionUsage.findFirst({
      where: {
        questionId,
        status: "ACTIVE", // Only get the active usage
      },
      include: {
        competition: {
          include: {
            room: true,
          },
        },
        trophy: true,
      },
      orderBy: {
        sentAt: "desc", // Get the most recent if there are multiple active
      },
    });

    console.log(`Evaluating question ${questionId}:`);
    console.log(`- usage found: ${!!usage}`);
    console.log(`- usage.trophyId: ${usage?.trophyId}`);
    console.log(`- trophy exists: ${!!usage?.trophy}`);

    if (!usage) {
      return NextResponse.json(
        { error: "Question usage not found" },
        { status: 404 }
      );
    }

    // Get the question with answers ordered asc
    const question = await db.question.findUnique({
      where: { id: questionId },
      include: {
        answers: {
          orderBy: {
            answeredAt: "asc",
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
      // Only consider answers from the current competition usage
      const answersForCompetition = question.answers.filter(
        (a) => a.competitionId === usage.competitionId
      );
      const correctAnswers = answersForCompetition.filter((a) => a.isCorrect);

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

            // Award trophy if this question has one (only to earliest correct answer)
            if (usage.trophyId && user) {
              // Avoid duplicate awards for repeated evaluations
              const existingWin = await db.trophyWin.findFirst({
                where: {
                  source: "question",
                  sourceId: usage.id,
                  trophyId: usage.trophyId,
                },
              });

              if (!existingWin) {
                const trophyWin = await db.trophyWin.create({
                  data: {
                    userId: user.id,
                    trophyId: usage.trophyId,
                    source: "question",
                    sourceId: usage.id,
                  },
                  include: {
                    trophy: true,
                  },
                });

                // Broadcast trophy win
                if (usage.competition.room) {
                  console.log(
                    `Broadcasting trophy:won to room ${usage.competition.room.id} for user ${user.username}`
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

            // Award trophy to earliest correct answer if trophy exists
            if (i === 0 && usage.trophyId && user) {
              const existingWin = await db.trophyWin.findFirst({
                where: {
                  source: "question",
                  sourceId: usage.id,
                  trophyId: usage.trophyId,
                },
              });

              if (!existingWin) {
                const trophyWin = await db.trophyWin.create({
                  data: {
                    userId: user.id,
                    trophyId: usage.trophyId,
                    source: "question",
                    sourceId: usage.id,
                  },
                  include: {
                    trophy: true,
                  },
                });

                // Broadcast trophy win
                if (usage.competition.room) {
                  console.log(
                    `Broadcasting trophy:won to room ${usage.competition.room.id} for user ${user.username}`
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
            }
          }
          break;

        case "ALL_EQUAL":
          // All correct answers get the same points
          let isFirstCorrect = true;
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

            // Award trophy to earliest correct answer if trophy exists (even in ALL_EQUAL mode)
            if (isFirstCorrect && usage.trophyId && user) {
              const existingWin = await db.trophyWin.findFirst({
                where: {
                  source: "question",
                  sourceId: usage.id,
                  trophyId: usage.trophyId,
                },
              });

              if (!existingWin) {
                const trophyWin = await db.trophyWin.create({
                  data: {
                    userId: user.id,
                    trophyId: usage.trophyId,
                    source: "question",
                    sourceId: usage.id,
                  },
                  include: {
                    trophy: true,
                  },
                });

                console.log(
                  `Trophy awarded to user ${user.username} (${user.id})`
                );

                // Broadcast trophy win
                if (usage.competition.room) {
                  console.log(
                    `Broadcasting trophy:won event to room ${usage.competition.room.id}`
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
                isFirstCorrect = false; // Only first person gets trophy
              } else {
                isFirstCorrect = false; // Trophy already awarded for this usage
              }
            }
          }
          break;
      }

      // Mark all incorrect answers as reviewed with 0 points
      const incorrectAnswers = answersForCompetition.filter(
        (a) => !a.isCorrect
      );
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

    // Mark question usage as completed
    await db.questionUsage.update({
      where: {
        questionId_competitionId: {
          questionId,
          competitionId: usage.competitionId,
        },
      },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    // Broadcast question completed and score updates
    if (usage.competition.room) {
      broadcastToRoom(usage.competition.room.id, {
        type: "question:completed",
        data: {
          questionId,
        },
      });

      // Also broadcast score updates
      broadcastToRoom(usage.competition.room.id, {
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
