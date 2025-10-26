const WebSocket = require("ws");
const http = require("http");

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({
  server,
  path: "/ws",
});

// Store connected clients
const clients = new Map();

wss.on("connection", (ws, req) => {
  const clientId = Math.random().toString(36).substring(7);
  console.log(`WebSocket: New client connected: ${clientId}`);

  // Store client
  clients.set(clientId, ws);

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: "connected",
      clientId: clientId,
      message: "Connected to WebSocket server",
    })
  );

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`WebSocket: Received from ${clientId}:`, data);

      // Forward the message directly to all clients (including sender)
      broadcast(data);
    } catch (error) {
      console.error(
        `WebSocket: Error parsing message from ${clientId}:`,
        error
      );
    }
  });

  ws.on("close", () => {
    console.log(`WebSocket: Client disconnected: ${clientId}`);
    clients.delete(clientId);
  });

  ws.on("error", (error) => {
    console.error(`WebSocket: Error with client ${clientId}:`, error);
    clients.delete(clientId);
  });
});

// Broadcast function
function broadcast(message) {
  const messageStr = JSON.stringify(message);
  console.log(`WebSocket: Broadcasting to ${clients.size} clients:`, message);
  console.log(`WebSocket: Message string:`, messageStr);

  clients.forEach((ws, clientId) => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        console.log(`WebSocket: Sending to client ${clientId}:`, messageStr);
        ws.send(messageStr);
      } else {
        console.log(`WebSocket: Removing dead client ${clientId}`);
        clients.delete(clientId);
      }
    } catch (error) {
      console.error(`WebSocket: Error sending to client ${clientId}:`, error);
      clients.delete(clientId);
    }
  });
}

// Start server
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`WebSocket server running on ws://localhost:${PORT}/ws`);
});

// Export broadcast function for use by other modules
module.exports = { broadcast };
