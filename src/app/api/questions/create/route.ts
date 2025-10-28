import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      text,
      type,
      imageUrl,
      options, // For MULTIPLE_CHOICE: JSON array like ["Option A", "Option B", "Option C"]
      correctAnswer,
      points,
      scoringType,
    } = body;

    if (!text || !type || !correctAnswer) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate options for multiple choice
    if (type === "MULTIPLE_CHOICE") {
      if (!options || !Array.isArray(options) || options.length < 2) {
        return NextResponse.json(
          { error: "Multiple choice questions must have at least 2 options" },
          { status: 400 }
        );
      }
    }

    const question = await db.question.create({
      data: {
        text,
        type: type || "FREETEXT",
        imageUrl: imageUrl || null,
        options: options ? JSON.stringify(options) : null,
        correctAnswer,
        points: points || 1,
        scoringType: scoringType || "ALL_EQUAL",
      },
    });

    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    console.error("Create question error:", error);
    return NextResponse.json(
      { error: "Failed to create question" },
      { status: 500 }
    );
  }
}
