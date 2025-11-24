import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const competitionId = searchParams.get("competitionId");

    // If competitionId is provided, return questions with their usage status for that competition
    if (competitionId) {
      const questions = await db.question.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          usages: {
            where: { competitionId },
            include: {
              competition: {
                include: {
                  room: true,
                },
              },
            },
          },
        },
      });

      // Transform data to include usage status and answers
      const questionsWithStatus = await Promise.all(
        questions.map(async (q) => {
          const usage = q.usages[0]; // Get usage for this competition if exists

          // Get answers for this competition if question has been used
          const answers = usage
            ? await db.answer.findMany({
                where: {
                  questionId: q.id,
                  competitionId,
                },
                orderBy: {
                  answeredAt: "asc", // Sort by who answered first
                },
                include: {
                  // Try to get user info, but don't fail if user doesn't exist
                },
              })
            : [];

          // Enrich answers with user info
          const answersWithUserInfo = await Promise.all(
            answers.map(async (answer) => {
              const user = await db.user.findUnique({
                where: { clerkId: answer.userId },
                select: {
                  username: true,
                  avatarKey: true,
                },
              });

              return {
                ...answer,
                username: user?.username || "Unknown",
                avatarKey: user?.avatarKey || "01",
                answeredAt: answer.answeredAt, // Include timestamp for display
              };
            })
          );

          return {
            id: q.id,
            text: q.text,
            type: q.type,
            imageUrl: q.imageUrl,
            options: q.options ? JSON.parse(q.options) : null,
            correctAnswer: q.correctAnswer,
            points: q.points,
            scoringType: q.scoringType,
            createdAt: q.createdAt,
            status: usage?.status || "DRAFT",
            sentAt: usage?.sentAt,
            completedAt: usage?.completedAt,
            answers: answersWithUserInfo,
            isUsedInCompetition: !!usage,
          };
        })
      );

      return NextResponse.json({ questions: questionsWithStatus });
    }

    // If no competitionId, return all questions
    const questions = await db.question.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        usages: {
          include: {
            competition: {
              include: {
                room: true,
              },
            },
          },
        },
      },
    });

    // Parse options JSON for each question
    const questionsWithParsedOptions = questions.map((q) => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : null,
      usageCount: q.usages.length,
    }));

    return NextResponse.json({ questions: questionsWithParsedOptions });
  } catch (error) {
    console.error("List questions error:", error);
    return NextResponse.json(
      { error: "Failed to list questions" },
      { status: 500 }
    );
  }
}
