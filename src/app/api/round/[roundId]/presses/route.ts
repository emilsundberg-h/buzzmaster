import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roundId: string }> }
) {
  try {
    await requireUser();
    const { roundId } = await params;

    const presses = await db.press.findMany({
      where: {
        roundId,
      },
      include: {
        user: true,
      },
      orderBy: {
        pressedAt: "asc",
      },
    });

    return NextResponse.json({ presses });
  } catch (error) {
    console.error("Get presses error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
