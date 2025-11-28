import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";

// GET - List all available trophies
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (userId) {
      // Get user's won trophies
      const trophyWins = await db.trophyWin.findMany({
        where: { userId },
        include: {
          trophy: true,
        },
        orderBy: {
          wonAt: "desc",
        },
      });

      return NextResponse.json({ trophyWins });
    }

    // List all available trophies
    const trophies = await db.trophy.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({ trophies });
  } catch (error) {
    console.error("Failed to fetch trophies:", error);
    return NextResponse.json(
      { error: "Failed to fetch trophies" },
      { status: 500 }
    );
  }
}

// POST - Create/seed trophies from the images in /public/trophys/
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, imageKey, description } = body;

    if (!name || !imageKey) {
      return NextResponse.json(
        { error: "Name and imageKey are required" },
        { status: 400 }
      );
    }

    const trophy = await db.trophy.create({
      data: {
        name,
        imageKey,
        description: description || null,
      },
    });

    return NextResponse.json({ trophy });
  } catch (error) {
    console.error("Failed to create trophy:", error);
    return NextResponse.json(
      { error: "Failed to create trophy" },
      { status: 500 }
    );
  }
}

