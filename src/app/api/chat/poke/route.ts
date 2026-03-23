import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { broadcastToRoom } from "@/lib/websocket";

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser();
    const body = await request.json();
    const { roomId, receiverId: receiverClerkId } = body;

    if (!roomId || !receiverClerkId) {
      return NextResponse.json(
        { error: "Room ID and receiver ID are required" },
        { status: 400 }
      );
    }

    const sender = await db.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, username: true, avatarKey: true },
    });
    if (!sender) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 });
    }

    const receiver = await db.user.findUnique({
      where: { clerkId: receiverClerkId },
      select: { id: true, clerkId: true },
    });
    if (!receiver) {
      return NextResponse.json({ error: "Receiver not found" }, { status: 404 });
    }

    const poke = await db.poke.create({
      data: { roomId, senderId: sender.id, receiverId: receiver.id },
    });

    broadcastToRoom(roomId, {
      type: "chat:poke",
      data: {
        poke: {
          id: poke.id,
          roomId: poke.roomId,
          senderId: poke.senderId,
          receiverId: poke.receiverId,
          createdAt: poke.createdAt,
          seen: poke.seen,
          sender: { id: sender.id, username: sender.username, avatarKey: sender.avatarKey },
          senderUsername: sender.username,
          receiverClerkId: receiver.clerkId,
        },
      },
    });

    return NextResponse.json({ poke });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Send poke error:", error);
    return NextResponse.json({ error: "Failed to send poke" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireUser();
    const body = await request.json();
    const { pokeId } = body;

    if (!pokeId) {
      return NextResponse.json({ error: "Poke ID required" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await db.poke.update({
      where: { id: pokeId, receiverId: user.id },
      data: { seen: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Mark poke seen error:", error);
    return NextResponse.json({ error: "Failed to mark poke as seen" }, { status: 500 });
  }
}
