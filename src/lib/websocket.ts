/**
 * WebSocket broadcast module
 * Works with the combined server (server.js) in production
 * and falls back to a standalone connection in development
 */

// Type declaration for the global WebSocket functions
declare global {
  // eslint-disable-next-line no-var
  var __wssBroadcast: ((message: unknown) => void) | undefined;
  // eslint-disable-next-line no-var
  var __wssGetClientCount: (() => number) | undefined;
}

// Check if we're running with the custom server (which sets global.__wssBroadcast)
function isCustomServer(): boolean {
  return typeof global.__wssBroadcast === "function";
}

export function broadcast(event: string, data: unknown) {
  console.log(`WebSocket: Broadcasting ${event}`);

  if (isCustomServer()) {
    // Use the global broadcast function from server.js
    const message = { type: event, data };
    global.__wssBroadcast!(message);
    console.log(`WebSocket: Sent ${event} via custom server`);
  } else {
    // In development without custom server, log a warning
    console.warn(
      `WebSocket: Custom server not available. Message ${event} not sent.`,
      "Run with 'node server.js' to enable WebSocket broadcasting."
    );
  }
}

// Broadcast to specific room - the WS server handles room filtering
export function broadcastToRoom(
  roomId: string,
  message: { type: string; data: unknown }
) {
  console.log(`WebSocket: Broadcasting ${message.type} to room ${roomId}`);
  const dataWithRoom = typeof message.data === 'object' && message.data !== null 
    ? { ...message.data as Record<string, unknown>, roomId }
    : { data: message.data, roomId };
  broadcast(message.type, dataWithRoom);
}

export function getClientCount(): number {
  if (isCustomServer()) {
    return global.__wssGetClientCount!();
  }
  return 0;
}

export function clearAllClients() {
  console.log("WebSocket: clearAllClients called (no-op in combined server mode)");
  // In combined server mode, we don't close all connections
  // This is mainly used for cleanup/reset scenarios
}
