import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { broadcast } from "@/lib/websocket";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, roomId } = body;

    if (!userId || !roomId) {
      return NextResponse.json(
        { error: "User ID and Room ID are required" },
        { status: 400 }
      );
    }

    // Find and delete room membership
    const membership = await db.roomMembership.findFirst({
      where: {
        userId: userId,
        roomId: roomId,
      },
      include: {
        room: {
          include: {
            memberships: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    avatarKey: true,
                    score: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "User not found in this room" },
        { status: 404 }
      );
    }

    // Delete membership
    await db.roomMembership.delete({
      where: { id: membership.id },
    });

    // Fetch updated room with remaining members
    const updatedRoom = await db.room.findUnique({
      where: { id: roomId },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarKey: true,
                score: true,
              },
            },
          },
        },
      },
    });

    broadcast("room:memberKicked", { room: updatedRoom, kickedUserId: userId });

    return NextResponse.json({ success: true, room: updatedRoom });
  } catch (error) {
    console.error("Kick user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
