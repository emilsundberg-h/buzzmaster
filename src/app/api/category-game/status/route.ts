import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");
    const competitionId = searchParams.get("competitionId");

    if (gameId) {
      // Get specific game
      const game = await db.categoryGame.findUnique({
        where: { id: gameId },
        include: {
          competition: {
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
          },
        },
      });

      if (!game) {
        return NextResponse.json({ error: "Game not found" }, { status: 404 });
      }

      return NextResponse.json({ game });
    } else if (competitionId) {
      // Get latest game for competition
      const game = await db.categoryGame.findFirst({
        where: { competitionId },
        orderBy: { createdAt: "desc" },
        include: {
          competition: {
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
          },
        },
      });

      return NextResponse.json({ game });
    }

    return NextResponse.json(
      { error: "gameId or competitionId required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Get category game status error:", error);
    return NextResponse.json(
      { error: "Failed to get game status" },
      { status: 500 }
    );
  }
}
