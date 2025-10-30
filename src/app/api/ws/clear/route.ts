import { NextResponse } from "next/server";
import { clearAllClients, getClientCount } from "@/lib/websocket";

export async function POST() {
  try {
    const count = getClientCount();
    clearAllClients();

    return NextResponse.json({
      message: `Cleared ${count} WebSocket clients`,
      clearedCount: count,
    });
  } catch (error) {
    console.error("Clear WebSocket clients error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}






