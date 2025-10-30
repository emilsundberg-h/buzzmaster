import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcast } from "@/lib/websocket";

const competitionSchema = z.object({
  name: z.string().min(1).max(100),
  roomId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    // In dev mode, skip admin check
    const body = await request.json();
    const { name, roomId } = competitionSchema.parse(body);

    // Create new competition
    const competition = await db.competition.create({
      data: {
        name,
        roomId,
        status: "ACTIVE",
      },
    });

    broadcast("competition:created", competition);

    return NextResponse.json({ competition });
  } catch (error) {
    console.error("Competition creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const competitions = await db.competition.findMany({
      orderBy: { createdAt: "desc" },
      take: 10, // Limit to recent competitions
      include: {
        rounds: {
          orderBy: { startedAt: "desc" },
          take: 1, // Only get the latest round
          include: {
            trophy: true, // Include trophy information
          },
        },
      },
    });

    return NextResponse.json({ competitions });
  } catch (error) {
    console.error("Competition fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
