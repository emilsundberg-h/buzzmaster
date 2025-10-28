// WebSocket client to connect to external WebSocket server
import WebSocket from "ws";

let wsClient: WebSocket | null = null;
let isConnected = false;

// Connect to external WebSocket server
function connectToWebSocketServer() {
  if (wsClient && isConnected) return;

  try {
    wsClient = new WebSocket("ws://localhost:3001/ws");

    wsClient.on("open", () => {
      console.log("WebSocket client connected to external server");
      isConnected = true;
    });

    wsClient.on("close", () => {
      console.log("WebSocket client disconnected from external server");
      isConnected = false;
      wsClient = null;

      // Try to reconnect after 5 seconds
      setTimeout(() => {
        connectToWebSocketServer();
      }, 5000);
    });

    wsClient.on("error", (error) => {
      console.error("WebSocket client error:", error);
      isConnected = false;
    });
  } catch (error) {
    console.error("Failed to connect to WebSocket server:", error);
  }
}

// Initialize connection
connectToWebSocketServer();

export function broadcast(event: string, data: any) {
  console.log(`WebSocket: Broadcasting ${event} to external server`);

  if (!isConnected || !wsClient) {
    console.log(
      "WebSocket: Not connected to external server, attempting to connect..."
    );
    connectToWebSocketServer();
    return;
  }

  try {
    const message = JSON.stringify({ type: event, data });
    wsClient.send(message);
    console.log(`WebSocket: Sent ${event} to external server`);
  } catch (error) {
    console.error(
      "WebSocket: Error sending message to external server:",
      error
    );
    isConnected = false;
  }
}

// Broadcast to specific room - the external WS server should handle room filtering
export function broadcastToRoom(
  roomId: string,
  message: { type: string; data: any }
) {
  console.log(`WebSocket: Broadcasting ${message.type} to room ${roomId}`);
  broadcast(message.type, { ...message.data, roomId });
}

export function getClientCount() {
  return isConnected ? 1 : 0;
}

export function clearAllClients() {
  console.log("WebSocket: Clearing external server connection");
  if (wsClient) {
    wsClient.close();
    wsClient = null;
    isConnected = false;
  }
}
