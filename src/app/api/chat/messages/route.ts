import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { broadcastToRoom } from "@/lib/websocket";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser();
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const otherUserId = searchParams.get("otherUserId");

    if (!roomId) {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 });
    }

    const currentUser = await db.user.findUnique({ where: { clerkId: userId } });
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let messages;

    if (otherUserId) {
      const otherUser = await db.user.findUnique({ where: { clerkId: otherUserId } });
      if (!otherUser) return NextResponse.json({ messages: [] });

      messages = await db.message.findMany({
        where: {
          roomId,
          OR: [
            { senderId: currentUser.id, receiverId: otherUser.id },
            { senderId: otherUser.id, receiverId: currentUser.id },
          ],
        },
        include: {
          sender: { select: { id: true, clerkId: true, username: true, avatarKey: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      });
    } else {
      messages = await db.message.findMany({
        where: { roomId, receiverId: null },
        include: {
          sender: { select: { id: true, clerkId: true, username: true, avatarKey: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      });
    }

    return NextResponse.json({ messages });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Fetch messages error:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUser();
    const body = await request.json();
    const { roomId, receiverId, content } = body;

    if (!roomId || !content) {
      return NextResponse.json({ error: "Room ID and content are required" }, { status: 400 });
    }

    const sender = await db.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, username: true, avatarKey: true },
    });
    if (!sender) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let receiverDbId = null;
    let receiverClerkId = null;
    if (receiverId) {
      const receiver = await db.user.findUnique({
        where: { clerkId: receiverId },
        select: { id: true, clerkId: true },
      });
      if (!receiver) {
        return NextResponse.json({ error: "Receiver not found" }, { status: 404 });
      }
      receiverDbId = receiver.id;
      receiverClerkId = receiver.clerkId;
    }

    const message = await db.message.create({
      data: { roomId, senderId: sender.id, receiverId: receiverDbId, content },
      include: {
        sender: { select: { id: true, username: true, avatarKey: true } },
      },
    });

    broadcastToRoom(roomId, {
      type: "chat:message",
      data: {
        message: {
          id: message.id,
          roomId: message.roomId,
          senderId: userId,
          receiverId: receiverClerkId,
          content: message.content,
          createdAt: message.createdAt,
          read: message.read,
          sender: {
            id: sender.id,
            clerkId: userId,
            username: sender.username,
            avatarKey: sender.avatarKey,
          },
        },
      },
    });

    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Send message error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireUser();
    const body = await request.json();
    const { roomId, otherUserId } = body;

    if (!roomId) {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { clerkId: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (otherUserId) {
      const otherUser = await db.user.findUnique({ where: { clerkId: otherUserId } });
      if (!otherUser) return NextResponse.json({ success: true });

      await db.message.updateMany({
        where: { roomId, senderId: otherUser.id, receiverId: user.id, read: false },
        data: { read: true },
      });
    } else {
      // Mark all unread group messages as read — single batch upsert
      const unreadGroupMessages = await db.message.findMany({
        where: { roomId, receiverId: null, NOT: { senderId: user.id } },
        select: { id: true },
      });

      if (unreadGroupMessages.length > 0) {
        await db.messageRead.createMany({
          data: unreadGroupMessages.map((m) => ({ messageId: m.id, userId: user.id })),
          skipDuplicates: true,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Mark messages read error:", error);
    return NextResponse.json({ error: "Failed to mark messages as read" }, { status: 500 });
  }
}
