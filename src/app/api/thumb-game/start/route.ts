import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { broadcast } from "@/lib/websocket";

export async function POST(request: Request) {
  try {
    const userId = request.headers.get("x-dev-user-id");
    
    if (!userId) {
      return NextResponse.json(
        { error: "User ID required" },
        { status: 401 }
      );
    }

    // Find active round
    const activeRound = await db.round.findFirst({
      where: {
        endedAt: null,
        startedAt: { not: null },
      },
      orderBy: { startedAt: "desc" },
    });

    if (!activeRound) {
      return NextResponse.json(
        { error: "No active round found" },
        { status: 400 }
      );
    }

    // Check if thumb game is already active
    if (activeRound.thumbGameActive) {
      return NextResponse.json(
        { error: "Thumb game is already active" },
        { status: 400 }
      );
    }

    // Check if user has already started thumb game this round
    const usedBy = activeRound.thumbGameUsedBy ? JSON.parse(activeRound.thumbGameUsedBy) : [];
    if (usedBy.includes(userId)) {
      return NextResponse.json(
        { error: "You have already started the thumb game this round" },
        { status: 400 }
      );
    }

    // Look up total players in the room
    const competition = await db.competition.findUnique({
      where: { id: activeRound.competitionId },
      include: { room: { include: { memberships: { include: { user: true } } } } },
    });

    const memberships = competition?.room.memberships || [];
    const totalPlayers = memberships.length;

    // Start thumb game (starter automatically responds)
    let updatedRound = await db.round.update({
      where: { id: activeRound.id },
      data: {
        thumbGameActive: true,
        thumbGameStarterId: userId,
        thumbGameResponders: JSON.stringify([userId]), // Starter automatically has thumb up
        thumbGameUsedBy: JSON.stringify([...usedBy, userId]),
      },
    });

    // If only 2 players, the other player automatically loses immediately
    if (totalPlayers === 2) {
      const otherMembership = memberships.find((m: any) => m.user.clerkId !== userId);
      const loserDbId = otherMembership?.userId;
      const loserClerkId = otherMembership?.user?.clerkId;

      if (loserDbId) {
        // Apply score penalty
        await db.user.update({
          where: { id: loserDbId },
          data: { score: { decrement: 5 } },
        });

        // End thumb game immediately
        updatedRound = await db.round.update({
          where: { id: activeRound.id },
          data: {
            thumbGameActive: false,
            thumbGameResponders: "[]",
          },
        });

        // Broadcast ended (not started) since it's resolved instantly
        broadcast("thumb-game:ended", {
          roundId: updatedRound.id,
          loserId: loserClerkId || loserDbId,
          responders: [],
        });
        broadcast("scores:updated", {});

        return NextResponse.json({ success: true, round: updatedRound, autoEnded: true });
      }
    }

    // Otherwise, normal start flow
    broadcast("thumb-game:started", {
      roundId: updatedRound.id,
      starterId: userId,
      responders: [userId], // Starter's thumb is already up
    });

    return NextResponse.json({ success: true, round: updatedRound });
  } catch (error) {
    console.error("Thumb game start error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
