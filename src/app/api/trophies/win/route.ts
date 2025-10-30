import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST - Award a trophy to a user
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, trophyId, source, sourceId } = body;

    if (!userId || !trophyId || !source || !sourceId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if user already won this trophy from this source
    const existingWin = await db.trophyWin.findFirst({
      where: {
        userId,
        trophyId,
        source,
        sourceId,
      },
    });

    if (existingWin) {
      return NextResponse.json(
        { error: "Trophy already won", trophyWin: existingWin },
        { status: 400 }
      );
    }

    // Create trophy win
    const trophyWin = await db.trophyWin.create({
      data: {
        userId,
        trophyId,
        source,
        sourceId,
      },
      include: {
        trophy: true,
        user: true,
      },
    });

    return NextResponse.json({ trophyWin });
  } catch (error) {
    console.error("Failed to award trophy:", error);
    return NextResponse.json(
      { error: "Failed to award trophy" },
      { status: 500 }
    );
  }
}

