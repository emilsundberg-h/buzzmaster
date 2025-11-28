import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { broadcastToRoom } from "@/lib/websocket";
import { addTrophyPlayerToDreamEleven } from "@/lib/trophy-helpers";

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
    const usage = await db.questionUsage.findFirst({
      where: {
        questionId,
        status: "ACTIVE",
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
        sentAt: "desc",
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

    if (question.type === "MULTIPLE_CHOICE") {
      const answersForCompetition = question.answers.filter(
        (a) => a.competitionId === usage.competitionId
      );
      const correctAnswers = answersForCompetition.filter((a) => a.isCorrect);

      let updatedAnswers: any[] = [];

      switch (question.scoringType) {
        case "FIRST_ONLY": {
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

            const actualTrophyId = usage.trophyId || usage.playerTrophyId;
            if (actualTrophyId && user) {
              if (actualTrophyId.startsWith("player_")) {
                await addTrophyPlayerToDreamEleven(user.id, actualTrophyId);

                const playerId = actualTrophyId.replace("player_", "");
                const player = await db.player.findUnique({
                  where: { id: playerId },
                });

                if (player && usage.competition.room) {
                  console.log(
                    `Broadcasting player:won for user ${user.username}`
                  );
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
                const existingWin = await db.trophyWin.findFirst({
                  where: {
                    source: "question",
                    sourceId: usage.id,
                    trophyId: actualTrophyId,
                  },
                });

                if (!existingWin) {
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

                  await addTrophyPlayerToDreamEleven(user.id, actualTrophyId);

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
          }
          break;
        }

        case "DESCENDING": {
          const participantCount = correctAnswers.length;

          for (let i = 0; i < correctAnswers.length; i++) {
            const answer = correctAnswers[i];
            const points = Math.max(1, participantCount - i);

            const updated = await db.answer.update({
              where: { id: answer.id },
              data: {
                points,
                reviewed: true,
                reviewedAt: new Date(),
              },
            });
            updatedAnswers.push(updated);

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

            const actualTrophyId2 = usage.trophyId || usage.playerTrophyId;
            if (i === 0 && actualTrophyId2 && user) {
              if (actualTrophyId2.startsWith("player_")) {
                await addTrophyPlayerToDreamEleven(user.id, actualTrophyId2);

                const playerId = actualTrophyId2.replace("player_", "");
                const player = await db.player.findUnique({
                  where: { id: playerId },
                });

                if (player && usage.competition.room) {
                  console.log(
                    `Broadcasting player:won for user ${user.username}`
                  );
                  broadcastToRoom(usage.competition.room.id, {
                    type: "trophy:won",
                    data: {
                      userId: user.id,
                      username: user.username,
                      trophy: {
                        id: actualTrophyId2,
                        name: player.name,
                        imageKey: player.imageKey,
                      },
                      roomId: usage.competition.room.id,
                    },
                  });
                }
              } else {
                const existingWin = await db.trophyWin.findFirst({
                  where: {
                    source: "question",
                    sourceId: usage.id,
                    trophyId: actualTrophyId2,
                  },
                });

                if (!existingWin) {
                  const trophyWin = await db.trophyWin.create({
                    data: {
                      userId: user.id,
                      trophyId: actualTrophyId2,
                      source: "question",
                      sourceId: usage.id,
                    },
                    include: {
                      trophy: true,
                    },
                  });

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
          }
          break;
        }

        case "ALL_EQUAL": {
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

            const actualTrophyId3 = usage.trophyId || usage.playerTrophyId;
            if (isFirstCorrect && actualTrophyId3 && user) {
              if (actualTrophyId3.startsWith("player_")) {
                await addTrophyPlayerToDreamEleven(user.id, actualTrophyId3);

                const playerId = actualTrophyId3.replace("player_", "");
                const player = await db.player.findUnique({
                  where: { id: playerId },
                });

                console.log(
                  `Player trophy awarded to user ${user.username} (${user.id})`
                );

                if (player && usage.competition.room) {
                  console.log(
                    `Broadcasting player:won for user ${user.username}`
                  );
                  broadcastToRoom(usage.competition.room.id, {
                    type: "trophy:won",
                    data: {
                      userId: user.id,
                      username: user.username,
                      trophy: {
                        id: actualTrophyId3,
                        name: player.name,
                        imageKey: player.imageKey,
                      },
                      roomId: usage.competition.room.id,
                    },
                  });
                }
              } else {
                const existingWin = await db.trophyWin.findFirst({
                  where: {
                    source: "question",
                    sourceId: usage.id,
                    trophyId: actualTrophyId3,
                  },
                });

                if (!existingWin) {
                  const trophyWin = await db.trophyWin.create({
                    data: {
                      userId: user.id,
                      trophyId: actualTrophyId3,
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
                }
              }
            }

            isFirstCorrect = false;
          }
          break;
        }
      }

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

    if (usage.competition.room) {
      broadcastToRoom(usage.competition.room.id, {
        type: "question:completed",
        data: {
          questionId,
        },
      });

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