/**
 * Combined Server for Railway Deployment
 * Runs Next.js and WebSocket on the same port
 */

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const WebSocket = require("ws");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

// Initialize Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Store connected WebSocket clients
const clients = new Map();

// Broadcast function for WebSocket
function broadcast(message) {
  const messageStr = typeof message === "string" ? message : JSON.stringify(message);
  console.log(`WebSocket: Broadcasting to ${clients.size} clients`);

  clients.forEach((ws, clientId) => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      } else {
        clients.delete(clientId);
      }
    } catch (error) {
      console.error(`WebSocket: Error sending to client ${clientId}:`, error);
      clients.delete(clientId);
    }
  });
}

// Make broadcast available globally for API routes
global.__wssBroadcast = broadcast;
global.__wssGetClientCount = () => clients.size;

app.prepare().then(() => {
  // Create HTTP server
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      
      // Health check endpoint for Railway
      if (parsedUrl.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ 
          status: "ok", 
          websocketClients: clients.size,
          timestamp: new Date().toISOString()
        }));
        return;
      }
      
      // Let Next.js handle all other requests
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  // Create WebSocket server on the same HTTP server
  const wss = new WebSocket.Server({
    server,
    path: "/ws",
  });

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
        const data = JSON.parse(message.toString());
        console.log(`WebSocket: Received from ${clientId}:`, data.type);
        // Broadcast the message to all clients
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

  server.listen(port, hostname, () => {
    console.log(`> Server ready on http://${hostname}:${port}`);
    console.log(`> WebSocket ready on ws://${hostname}:${port}/ws`);
    console.log(`> Environment: ${dev ? "development" : "production"}`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully");
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });
});
