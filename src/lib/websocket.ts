/**
 * Pusher broadcast module
 * Replaces the custom WebSocket server for Vercel compatibility
 */
import Pusher from "pusher";

let _pusher: Pusher | null = null;

function getPusher(): Pusher {
  if (!_pusher) {
    _pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER!,
      useTLS: true,
    });
  }
  return _pusher;
}

export function broadcast(event: string, data: unknown) {
  console.log(`Pusher: Broadcasting ${event}`);
  getPusher()
    .trigger("buzzmaster", "game-event", { type: event, data })
    .catch((err) => console.error(`Pusher: Error broadcasting ${event}:`, err));
}

export function broadcastToRoom(
  roomId: string,
  message: { type: string; data: unknown }
) {
  console.log(`Pusher: Broadcasting ${message.type} to room ${roomId}`);
  const dataWithRoom =
    typeof message.data === "object" && message.data !== null
      ? { ...(message.data as Record<string, unknown>), roomId }
      : { data: message.data, roomId };
  broadcast(message.type, dataWithRoom);
}

export function getClientCount(): number {
  return 0;
}

export function clearAllClients() {
  // No-op with Pusher
}
