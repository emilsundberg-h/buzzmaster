import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        username: true,
        avatarKey: true,
        score: true,
        createdAt: true,
      },
      orderBy: { score: "desc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Scoreboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}






