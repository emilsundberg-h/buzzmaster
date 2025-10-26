import { useEffect, useRef, useState } from "react";

interface WebSocketMessage {
  type: string;
  data?: any;
  clientId?: string;
  message?: string;
}

export function useWebSocket(url: string) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const clientIdRef = useRef<string>("");

  const connect = () => {
    try {
      console.log("WebSocket: Connecting to", url);
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log("WebSocket: Connected");
        setIsConnected(true);
        reconnectAttempts.current = 0;

        // Generate client ID
        clientIdRef.current = Math.random().toString(36).substring(7);
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log("WebSocket: Received message:", message);
          setLastMessage(message);
        } catch (error) {
          console.error("WebSocket: Error parsing message:", error);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket: Disconnected");
        setIsConnected(false);
        setSocket(null);

        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttempts.current),
            10000
          );
          console.log(
            `WebSocket: Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error("WebSocket: Max reconnection attempts reached");
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket: Error:", error);
      };

      setSocket(ws);
    } catch (error) {
      console.error("WebSocket: Connection error:", error);
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (socket) {
      socket.close();
    }
  };

  const sendMessage = (message: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket: Cannot send message, not connected");
    }
  };

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [url]);

  return {
    socket,
    isConnected,
    lastMessage,
    sendMessage,
    connect,
    disconnect,
  };
}
