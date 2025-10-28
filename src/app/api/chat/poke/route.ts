import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { broadcastToRoom } from "@/lib/websocket";

// POST - Send a poke
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-dev-user-id");
    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 401 });
    }

    const body = await request.json();
    const { roomId, receiverId: receiverClerkId } = body;

    if (!roomId || !receiverClerkId) {
      return NextResponse.json(
        { error: "Room ID and receiver ID are required" },
        { status: 400 }
      );
    }

    // Get sender info (or create admin user if needed)
    let sender = await db.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        username: true,
        avatarKey: true,
      },
    });

    // Create admin user if it doesn't exist
    if (!sender && userId === "admin") {
      sender = await db.user.create({
        data: {
          clerkId: "admin",
          username: "Admin",
          avatarKey: "01",
        },
        select: {
          id: true,
          username: true,
          avatarKey: true,
        },
      });
    }

    if (!sender) {
      return NextResponse.json({ error: "Sender not found" }, { status: 404 });
    }

    const receiver = await db.user.findUnique({
      where: { clerkId: receiverClerkId },
      select: {
        id: true,
        clerkId: true,
      },
    });

    if (!receiver) {
      return NextResponse.json(
        { error: "Receiver not found" },
        { status: 404 }
      );
    }

    // Create poke
    const poke = await db.poke.create({
      data: {
        roomId,
        senderId: sender.id,
        receiverId: receiver.id,
      },
    });

    // Broadcast poke via WebSocket
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
          sender: {
            id: sender.id,
            username: sender.username,
            avatarKey: sender.avatarKey,
          },
          senderUsername: sender.username,
          receiverClerkId: receiver.clerkId,
        },
      },
    });

    return NextResponse.json({ poke });
  } catch (error) {
    console.error("Send poke error:", error);
    return NextResponse.json({ error: "Failed to send poke" }, { status: 500 });
  }
}

// PATCH - Mark poke as seen
export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get("x-dev-user-id");
    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 401 });
    }

    const body = await request.json();
    const { pokeId } = body;

    if (!pokeId) {
      return NextResponse.json({ error: "Poke ID required" }, { status: 400 });
    }

    let user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    // Create admin user if it doesn't exist
    if (!user && userId === "admin") {
      user = await db.user.create({
        data: {
          clerkId: "admin",
          username: "Admin",
          avatarKey: "01",
        },
      });
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Mark poke as seen
    await db.poke.update({
      where: {
        id: pokeId,
        receiverId: user.id, // Only the receiver can mark it as seen
      },
      data: {
        seen: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark poke seen error:", error);
    return NextResponse.json(
      { error: "Failed to mark poke as seen" },
      { status: 500 }
    );
  }
}
