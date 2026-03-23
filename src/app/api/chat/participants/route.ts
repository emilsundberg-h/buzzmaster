import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser();
    const { searchParams } = new URL(request.url);
    const roomId = searchParams.get("roomId");

    if (!roomId) {
      return NextResponse.json({ error: "Room ID required" }, { status: 400 });
    }

    const currentUser = await db.user.findUnique({ where: { clerkId: userId } });
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch memberships and unread DM counts in two queries instead of N+1
    const [memberships, unreadDmCounts] = await Promise.all([
      db.roomMembership.findMany({
        where: { roomId },
        include: {
          user: { select: { id: true, clerkId: true, username: true, avatarKey: true } },
        },
      }),
      db.message.groupBy({
        by: ["senderId"],
        where: { roomId, receiverId: currentUser.id, read: false },
        _count: { id: true },
      }),
    ]);

    const unreadByUser = new Map(
      unreadDmCounts.map((r) => [r.senderId, r._count.id])
    );

    const participants = memberships
      .filter((m) => m.user.id !== currentUser.id)
      .map((m) => ({
        id: m.user.clerkId,
        clerkId: m.user.clerkId,
        username: m.user.username,
        avatarKey: m.user.avatarKey,
        unreadCount: unreadByUser.get(m.user.id) ?? 0,
      }));

    // Unread group messages — two queries instead of per-message loop
    const [groupMessageIds, readGroupMessageIds] = await Promise.all([
      db.message.findMany({
        where: { roomId, receiverId: null, NOT: { senderId: currentUser.id } },
        select: { id: true },
      }),
      db.messageRead.findMany({
        where: { userId: currentUser.id },
        select: { messageId: true },
      }),
    ]);

    const readIds = new Set(readGroupMessageIds.map((r) => r.messageId));
    const unreadGroupCount = groupMessageIds.filter((m) => !readIds.has(m.id)).length;

    return NextResponse.json({ participants, unreadGroupCount });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Fetch participants error:", error);
    return NextResponse.json({ error: "Failed to fetch participants" }, { status: 500 });
  }
}
