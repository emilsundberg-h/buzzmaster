import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Get all used avatar keys
    const usedAvatars = await db.user.findMany({
      select: { avatarKey: true },
    });

    const usedKeys = new Set(usedAvatars.map((u) => u.avatarKey));

    // Return available avatars (01-08) - only the new profile images
    const availableAvatars = [];
    for (let i = 1; i <= 8; i++) {
      const key = i.toString().padStart(2, "0");
      if (!usedKeys.has(key)) {
        availableAvatars.push(key);
      }
    }

    return NextResponse.json({ avatars: availableAvatars });
  } catch (error) {
    console.error("Avatars error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
