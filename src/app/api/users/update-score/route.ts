import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { broadcast } from "@/lib/websocket";

const updateScoreSchema = z.object({
  userId: z.string(),
  scoreChange: z.number().int(),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { userId, scoreChange } = updateScoreSchema.parse(body);

    const user = await db.user.update({
      where: { id: userId },
      data: { score: { increment: scoreChange } },
    });

    broadcast("scores:updated", {});

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Update score error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
