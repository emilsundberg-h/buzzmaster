import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    // Find active round
    const activeRound = await db.round.findFirst({
      where: {
        endedAt: null,
        startedAt: { not: null },
      },
      orderBy: { startedAt: "desc" },
    });

    if (!activeRound) {
      return NextResponse.json({ 
        thumbGameActive: false,
        responders: [],
        starterId: null,
      });
    }

    return NextResponse.json({
      thumbGameActive: activeRound.thumbGameActive || false,
      responders: activeRound.thumbGameResponders ? JSON.parse(activeRound.thumbGameResponders) : [],
      starterId: activeRound.thumbGameStarterId || null,
      usedBy: activeRound.thumbGameUsedBy ? JSON.parse(activeRound.thumbGameUsedBy) : [],
    });
  } catch (error) {
    console.error("Thumb game status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
