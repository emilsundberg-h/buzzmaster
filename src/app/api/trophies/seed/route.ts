import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST - Seed trophies from the files in /public/trophys/
export async function POST(request: Request) {
  try {
    // Check if trophies already exist
    const existingCount = await db.trophy.count();
    if (existingCount > 0) {
      return NextResponse.json(
        { error: "Trophies already seeded", count: existingCount },
        { status: 400 }
      );
    }

    // Define the trophies based on the files in /public/trophys/
    const trophiesToCreate = [
      {
        name: "Oasis",
        imageKey: "Oasis_Logo.svg.png",
        description: "Oasis trophy",
      },
      {
        name: "Broder Daniel",
        imageKey: "Broder_daniel.svg.png",
        description: "Broder Daniel trophy",
      },
      {
        name: "Kent",
        imageKey: "Kent_logo.png",
        description: "Kent trophy",
      },
      {
        name: "Mystery Trophy",
        imageKey: "0f13383b6a0440965d2215b278913f8b.png",
        description: "Mystery trophy",
      },
    ];

    const trophies = await Promise.all(
      trophiesToCreate.map((trophy) =>
        db.trophy.create({
          data: trophy,
        })
      )
    );

    return NextResponse.json({
      success: true,
      count: trophies.length,
      trophies,
    });
  } catch (error) {
    console.error("Failed to seed trophies:", error);
    return NextResponse.json(
      { error: "Failed to seed trophies" },
      { status: 500 }
    );
  }
}
