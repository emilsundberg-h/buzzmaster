import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");

    if (!roomId) {
      return NextResponse.json(
        { error: "Room ID is required" },
        { status: 400 }
      );
    }

    // Find competition for the room (get the latest one)
    const competition = await db.competition.findFirst({
      where: {
        roomId: roomId,
        status: "ACTIVE",
      },
      orderBy: { createdAt: "desc" }, // Get the most recent competition
    });

    console.log(`API: Room competition fetch for roomId: ${roomId}`);
    console.log(`API: Found competition:`, competition);

    if (!competition) {
      console.log(`API: No active competition found for room ${roomId}`);
      return NextResponse.json({ competition: null });
    }

    // Get latest round for this competition
    let rounds: any[] = [];
    try {
      const latestRound = await db.round.findFirst({
        where: { competitionId: competition.id },
        orderBy: { startedAt: "desc" },
      });
      console.log(
        `API: Found latest round for competition ${competition.id}:`,
        latestRound
      );
      if (latestRound) {
        rounds = [latestRound];
      }
    } catch (roundError) {
      console.error("Error fetching rounds:", roundError);
      rounds = [];
    }

    const result = {
      competition: {
        ...competition,
        rounds: rounds,
      },
    };

    console.log(`API: Returning result:`, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Room competition fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
