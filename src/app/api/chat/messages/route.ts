import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { broadcastToRoom } from "@/lib/websocket";

// GET - Fetch messages for a room or between two users
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-dev-user-id");
    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");
    const otherUserId = searchParams.get("otherUserId");

    if (!roomId) {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 });
    }

    // Get current user's database ID
    let currentUser = await db.user.findUnique({
      where: { clerkId: userId },
    });

    // Create admin user if it doesn't exist
    if (!currentUser && userId === "admin") {
      currentUser = await db.user.create({
        data: {
          clerkId: "admin",
          username: "Admin",
          avatarKey: "01",
        },
      });
    }

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let messages;

    if (otherUserId) {
      // Convert otherUserId (clerkId) to database ID
      const otherUser = await db.user.findUnique({
        where: { clerkId: otherUserId },
      });

      if (!otherUser) {
        return NextResponse.json({ messages: [] });
      }

      // Get direct messages between two users (using database IDs)
      messages = await db.message.findMany({
        where: {
          roomId,
          OR: [
            { senderId: currentUser.id, receiverId: otherUser.id },
            { senderId: otherUser.id, receiverId: currentUser.id },
          ],
        },
        include: {
          sender: {
            select: {
              id: true,
              clerkId: true,
              username: true,
              avatarKey: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 100, // Limit to last 100 messages
      });
    } else {
      // Get group messages (where receiverId is null)
      messages = await db.message.findMany({
        where: {
          roomId,
          receiverId: null,
        },
        include: {
          sender: {
            select: {
              id: true,
              clerkId: true,
              username: true,
              avatarKey: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 100,
      });
    }

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Fetch messages error:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST - Send a message
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-dev-user-id");
    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 401 });
    }

    const body = await request.json();
    const { roomId, receiverId, content } = body;

    if (!roomId || !content) {
      return NextResponse.json(
        { error: "Room ID and content are required" },
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
          avatarKey: "01", // Default avatar for admin
        },
        select: {
          id: true,
          username: true,
          avatarKey: true,
        },
      });
    }

    if (!sender) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get receiver database ID if this is a DM
    let receiverDbId = null;
    let receiverClerkId = null;
    if (receiverId) {
      const receiver = await db.user.findUnique({
        where: { clerkId: receiverId },
        select: { id: true, clerkId: true },
      });

      if (!receiver) {
        return NextResponse.json(
          { error: "Receiver not found" },
          { status: 404 }
        );
      }

      receiverDbId = receiver.id;
      receiverClerkId = receiver.clerkId;
    }

    // Create message
    const message = await db.message.create({
      data: {
        roomId,
        senderId: sender.id,
        receiverId: receiverDbId,
        content,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatarKey: true,
          },
        },
      },
    });

    // Broadcast message via WebSocket with clerkIds
    broadcastToRoom(roomId, {
      type: "chat:message",
      data: {
        message: {
          id: message.id,
          roomId: message.roomId,
          senderId: userId, // Use clerkId instead of database ID
          receiverId: receiverClerkId, // Use clerkId instead of database ID
          content: message.content,
          createdAt: message.createdAt,
          read: message.read,
          sender: {
            id: sender.id,
            clerkId: userId, // Add clerkId for consistency
            username: sender.username,
            avatarKey: sender.avatarKey,
          },
        },
      },
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

// PATCH - Mark messages as read
export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get("x-dev-user-id");
    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 401 });
    }

    const body = await request.json();
    const { roomId, otherUserId } = body;

    if (!roomId) {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 });
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

    // Mark messages as read
    if (otherUserId) {
      // Convert otherUserId (clerkId) to database ID
      const otherUser = await db.user.findUnique({
        where: { clerkId: otherUserId },
      });

      if (!otherUser) {
        return NextResponse.json({ success: true }); // No messages to mark if user doesn't exist
      }

      // Mark direct messages as read
      await db.message.updateMany({
        where: {
          roomId,
          senderId: otherUser.id,
          receiverId: user.id,
          read: false,
        },
        data: {
          read: true,
        },
      });
    } else {
      // Mark group messages as read (this is simplified - in a real app you'd need a separate read receipts table)
      await db.message.updateMany({
        where: {
          roomId,
          receiverId: null,
          read: false,
          NOT: {
            senderId: user.id, // Don't mark own messages
          },
        },
        data: {
          read: true,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark messages read error:", error);
    return NextResponse.json(
      { error: "Failed to mark messages as read" },
      { status: 500 }
    );
  }
}
