import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcast } from "@/lib/websocket";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser();

    // Get user
    const user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Find and delete ALL room memberships for this user
    const memberships = await db.roomMembership.findMany({
      where: { userId: user.id },
    });

    if (memberships.length === 0) {
      return NextResponse.json({ error: "Not in any room" }, { status: 404 });
    }

    // Delete all memberships
    await db.roomMembership.deleteMany({
      where: { userId: user.id },
    });

    // Get room names for broadcast
    const roomIds = memberships.map((m) => m.roomId);
    const rooms = await db.room.findMany({
      where: { id: { in: roomIds } },
    });

    // Broadcast for each room
    rooms.forEach((room) => {
      broadcast("room:memberLeft", { roomId: room.id });
    });

    return NextResponse.json({
      success: true,
      message: `Left ${rooms.length} room(s): ${rooms
        .map((r) => r.name)
        .join(", ")}`,
      roomsLeft: rooms.map((r) => r.name),
    });
  } catch (error) {
    console.error("Leave room error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
