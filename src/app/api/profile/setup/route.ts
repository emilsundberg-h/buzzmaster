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

    // Map avatarKey to captain name (must match exactName in name-values.json)
    const captainMap: Record<string, string> = {
      '01': 'Roberto Baggio',
      '02': 'David Beckham',
      '03': 'Tomas Brolin',
      '04': 'Oliver Giroud',
      '05': 'Ronaldinho',
      '06': 'Ronaldo',
      '07': 'Francesco Totti',
      '08': 'Zinedine Zidane',
    };

    // Add captain to user's Dream Eleven if they don't have it
    const captainName = captainMap[avatarKey];
    if (captainName) {
      const captain = await db.player.findFirst({
        where: {
          name: captainName,
          category: 'CAPTAIN'
        }
      });

      if (captain) {
        // Check if user already owns this captain
        const existing = await db.userPlayer.findFirst({
          where: {
            userId: user.id,
            playerId: captain.id
          }
        });

        if (!existing) {
          // Add captain to user's collection
          await db.userPlayer.create({
            data: {
              userId: user.id,
              playerId: captain.id
            }
          });
          console.log(`Added captain ${captainName} to user ${user.username}`);
        }
      }
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Profile setup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
