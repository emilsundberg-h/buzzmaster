import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - Get participants in a room with unread message counts
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-dev-user-id");
    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");

    if (!roomId) {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 });
    }

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

    // Get all participants in the room
    const memberships = await db.roomMembership.findMany({
      where: {
        roomId,
      },
      include: {
        user: {
          select: {
            id: true,
            clerkId: true,
            username: true,
            avatarKey: true,
          },
        },
      },
    });

    // Get unread message counts for each participant
    const participants = await Promise.all(
      memberships
        .filter((m) => m.user.id !== currentUser.id) // Exclude current user
        .map(async (membership) => {
          // Count unread DMs from this user
          const unreadCount = await db.message.count({
            where: {
              roomId,
              senderId: membership.user.id,
              receiverId: currentUser.id,
              read: false,
            },
          });

          return {
            id: membership.user.clerkId, // Use clerkId as id for consistency
            clerkId: membership.user.clerkId,
            username: membership.user.username,
            avatarKey: membership.user.avatarKey,
            unreadCount,
          };
        })
    );

    // Add admin to participants list if current user is not admin
    if (userId !== "admin") {
      const adminUser = await db.user.findUnique({
        where: { clerkId: "admin" },
      });

      if (adminUser) {
        const adminUnreadCount = await db.message.count({
          where: {
            roomId,
            senderId: adminUser.id,
            receiverId: currentUser.id,
            read: false,
          },
        });

        participants.push({
          id: "admin",
          clerkId: "admin",
          username: "Admin",
          avatarKey: adminUser.avatarKey,
          unreadCount: adminUnreadCount,
        });
      }
    }

    // Count unread group messages using MessageRead table
    // Get all group messages
    const groupMessages = await db.message.findMany({
      where: {
        roomId,
        receiverId: null, // Group messages
        NOT: {
          senderId: currentUser.id, // Not my own messages
        },
      },
      select: {
        id: true,
      },
    });

    // Count how many of these messages the current user has NOT read
    const readMessageIds = await db.messageRead.findMany({
      where: {
        userId: currentUser.id,
        messageId: {
          in: groupMessages.map((m) => m.id),
        },
      },
      select: {
        messageId: true,
      },
    });

    const readIds = new Set(readMessageIds.map((r) => r.messageId));
    const unreadGroupCount = groupMessages.filter(
      (m) => !readIds.has(m.id)
    ).length;

    return NextResponse.json({
      participants,
      unreadGroupCount,
    });
  } catch (error) {
    console.error("Fetch participants error:", error);
    return NextResponse.json(
      { error: "Failed to fetch participants" },
      { status: 500 }
    );
  }
}
