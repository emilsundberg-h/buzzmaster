import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { broadcast } from "@/lib/websocket";

const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
});

// Generate a random 6-character room code
function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = createRoomSchema.parse(body);

    // Generate unique room code
    let roomCode;
    let attempts = 0;
    do {
      roomCode = generateRoomCode();
      attempts++;
    } while (
      (await db.room.findUnique({ where: { code: roomCode } })) &&
      attempts < 10
    );

    if (attempts >= 10) {
      return NextResponse.json(
        { error: "Failed to generate unique room code" },
        { status: 500 }
      );
    }

    // Create new room
    const room = await db.room.create({
      data: {
        name,
        code: roomCode,
        status: "WAITING",
      },
    });

    broadcast("room:created", room);

    return NextResponse.json({ room });
  } catch (error) {
    console.error("Room creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
