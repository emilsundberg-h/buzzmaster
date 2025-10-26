import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // This is a placeholder - WebSocket connections are handled by the server
  return new Response("WebSocket endpoint - use ws://localhost:3000/ws", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
