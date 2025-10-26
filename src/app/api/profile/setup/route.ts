import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

const setupSchema = z.object({
  username: z.string().min(1).max(50),
  avatarKey: z.string().min(1).max(10),
  userId: z.string().optional(), // For dev mode
});

export async function GET() {
  try {
    const userId = await requireUser();

    const user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let userId = await requireUser(); // Default
    const body = await request.json();
    const {
      username,
      avatarKey,
      userId: customUserId,
    } = setupSchema.parse(body);

    // Use custom userId if provided (dev mode)
    if (customUserId) {
      userId = customUserId;
    }

    // Check if username or avatar is already taken
    const existingUser = await db.user.findFirst({
      where: {
        OR: [{ username }, { avatarKey }],
      },
    });

    if (existingUser) {
      if (existingUser.username === username) {
        return NextResponse.json(
          { error: "Username already taken" },
          { status: 409 }
        );
      }
      if (existingUser.avatarKey === avatarKey) {
        return NextResponse.json(
          { error: "Avatar already taken" },
          { status: 409 }
        );
      }
    }

    // Create or update user profile
    const user = await db.user.upsert({
      where: { clerkId: userId },
      update: {
        username,
        avatarKey,
      },
      create: {
        clerkId: userId,
        username,
        avatarKey,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Profile setup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
