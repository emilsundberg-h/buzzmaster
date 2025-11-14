import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcast } from "@/lib/websocket";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId?: string }> }
) {
  const { userId } = await params;

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    await requireAdmin();
  } catch (error) {
    const message =
      error instanceof Error ? error.message || "Unauthorized" : "Unauthorized";
    const status =
      message === "Forbidden"
        ? 403
        : message === "Unauthorized"
          ? 401
          : 401;

    return NextResponse.json({ error: message }, { status });
  }

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await db.$transaction([
      db.messageRead.deleteMany({ where: { userId } }),
      db.message.deleteMany({
        where: {
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
      }),
      db.poke.deleteMany({
        where: {
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
      }),
      db.press.deleteMany({ where: { userId } }),
      db.answer.deleteMany({ where: { userId } }),
      db.roomMembership.deleteMany({ where: { userId } }),
      db.trophyWin.deleteMany({ where: { userId } }),
      db.user.delete({ where: { id: userId } }),
    ]);

    broadcast("scores:updated", {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


