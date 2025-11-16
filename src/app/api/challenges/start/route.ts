import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { broadcast } from "@/lib/websocket";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json().catch(() => ({}));
    const roomId: string | undefined = body?.roomId;
    const roundId: string | undefined = body?.roundId;
    const type: string = body?.type || 'arkanoid'; // Default to arkanoid for backwards compatibility
    const config = body?.config || {};

    if (!roomId) {
      return NextResponse.json({ error: "roomId is required" }, { status: 400 });
    }

    if (!roundId) {
      return NextResponse.json({ error: "roundId is required" }, { status: 400 });
    }

    // End any existing active challenge in this room before starting new one
    const existing = await db.challenge.findFirst({ where: { roomId, status: "ACTIVE" } });
    if (existing) {
      await db.challenge.update({
        where: { id: existing.id },
        data: { status: "ENDED", endedAt: new Date() }
      });
    }

    // Collect current room members (clerkIds)
    const room = await db.room.findUnique({
      where: { id: roomId },
      include: { memberships: { include: { user: true } } },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    const aliveClerkIds = (room.memberships || []).map((m) => m.user.clerkId);

    const challenge = await db.challenge.create({
      data: {
        roomId,
        roundId,
        type,
        status: "ACTIVE",
        startedAt: new Date(),
        config: JSON.stringify(config),
        alive: JSON.stringify(aliveClerkIds),
        results: JSON.stringify({}),
        bets: JSON.stringify({}), // Initialize empty bets
      },
    });

    broadcast("challenge:started", {
      id: challenge.id,
      roomId,
      type,
      config,
      alive: aliveClerkIds,
      startedAt: challenge.startedAt,
    });

    return NextResponse.json({ success: true, challenge });
  } catch (error) {
    console.error("Challenge start error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
