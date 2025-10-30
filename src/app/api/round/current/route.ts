import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Find active round
    const activeRound = await db.round.findFirst({
      where: {
        endedAt: null,
        startedAt: { not: null },
      },
      orderBy: { startedAt: "desc" },
      include: {
        trophy: true, // Include trophy information
      },
    });

    if (!activeRound) {
      return NextResponse.json({ round: null });
    }

    return NextResponse.json({ round: activeRound });
  } catch (error) {
    console.error("Get current round error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

