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

    // Find the latest ACTIVE round for this room (across all competitions)
    const latestActiveRound = await db.round.findFirst({
      where: {
        endedAt: null, // Only active rounds
        competition: {
          roomId: roomId,
          status: "ACTIVE",
        },
      },
      include: {
        competition: true,
      },
      orderBy: { startedAt: "desc" },
    });

    console.log(`API: Room competition fetch for roomId: ${roomId}`);
    console.log(`API: Found latest active round:`, latestActiveRound);

    if (!latestActiveRound) {
      console.log(`API: No active round found for room ${roomId}`);
      return NextResponse.json({ competition: null });
    }

    const result = {
      competition: {
        ...latestActiveRound.competition,
        rounds: [latestActiveRound],
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
