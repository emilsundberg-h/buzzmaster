import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcast } from "@/lib/websocket";

const joinRoomSchema = z.object({
  roomCode: z.string().length(6),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser();
    const body = await request.json();
    const { roomCode } = joinRoomSchema.parse(body);

    // Find room by code
    const room = await db.room.findUnique({
      where: { code: roomCode },
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

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.status !== "WAITING") {
      return NextResponse.json(
        { error: "Room is not accepting new members" },
        { status: 400 }
      );
    }

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

    // Check if user is already in the room
    const existingMembership = await db.roomMembership.findUnique({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId: user.id,
        },
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: "Already in this room" },
        { status: 409 }
      );
    }

    // Join room
    const membership = await db.roomMembership.create({
      data: {
        roomId: room.id,
        userId: user.id,
      },
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
    });

    // Fetch updated room with all members
    const updatedRoom = await db.room.findUnique({
      where: { id: room.id },
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

    broadcast("room:memberJoined", updatedRoom);

    return NextResponse.json({ room: updatedRoom, membership });
  } catch (error) {
    console.error("Join room error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
