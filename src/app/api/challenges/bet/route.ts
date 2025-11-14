import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { broadcast } from "@/lib/websocket";

export async function POST(req: NextRequest) {
  console.log("=== BET ENDPOINT CALLED ===");
  try {
    const clerkId = await requireUser();
    console.log("User clerkId:", clerkId);
    
    // Get user from database
    const user = await db.user.findUnique({
      where: { clerkId },
    });
    
    if (!user) {
      console.error("User not found for clerkId:", clerkId);
      return NextResponse.json({ error: "User not found" }, { status: 400 });
    }
    
    const userId = user.id;

    const body = await req.json().catch(() => ({}));
    const allIn: boolean = body?.allIn || false;

    // Find active challenge for this user's room
    const membership = await db.roomMembership.findFirst({
      where: { userId },
      include: { room: true },
    });

    if (!membership) {
      console.error("User not in a room");
      return NextResponse.json({ error: "Not in a room" }, { status: 400 });
    }

    console.log("Finding challenge for room:", membership.roomId);
    const challenge = await (db as any).challenge.findFirst({
      where: { roomId: membership.roomId, status: "ACTIVE" },
    });

    if (!challenge) {
      console.error("No active challenge found");
      return NextResponse.json({ error: "No active challenge" }, { status: 400 });
    }
    
    console.log("Challenge found:", challenge.id);
    
    // Get current user score
    const currentUser = await db.user.findUnique({ where: { id: userId } });
    const currentScore = currentUser?.score || 0;

    console.log(`Bet placed by ${clerkId}: allIn=${allIn}, currentScore=${currentScore}`)

    // Use transaction to prevent race conditions
    let updatedBets;
    await db.$transaction(async (tx: any) => {
      // Re-fetch challenge inside transaction to get latest bets
      const latestChallenge = await tx.challenge.findUnique({
        where: { id: challenge.id },
      });
      
      const bets = JSON.parse(latestChallenge.bets || "{}");
      
      // Store bet
      bets[clerkId] = {
        allIn,
        currentScore,
      };
      
      updatedBets = bets;

      // Update with new bets
      await tx.challenge.update({
        where: { id: challenge.id },
        data: { bets: JSON.stringify(bets) },
      });
    });

    console.log(`Bets updated in DB:`, updatedBets)

    broadcast("challenge:betPlaced", {
      id: challenge.id,
      userId: clerkId,
      allIn,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Challenge bet error:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack");
    return NextResponse.json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
