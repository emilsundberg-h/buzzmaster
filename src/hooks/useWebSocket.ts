import { useEffect, useState } from "react";
import Pusher from "pusher-js";

interface WebSocketMessage {
  type: string;
  data?: unknown;
  clientId?: string;
  message?: string;
}

// url param kept for backwards compatibility with call sites
export function useWebSocket(_url: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!pusherKey || !pusherCluster) {
      console.warn("Pusher: Missing NEXT_PUBLIC_PUSHER_KEY or NEXT_PUBLIC_PUSHER_CLUSTER");
      return;
    }

    const pusher = new Pusher(pusherKey, { cluster: pusherCluster });
    const channel = pusher.subscribe("buzzmaster");

    pusher.connection.bind("connected", () => setIsConnected(true));
    pusher.connection.bind("disconnected", () => setIsConnected(false));
    pusher.connection.bind("error", (err: unknown) =>
      console.error("Pusher connection error:", err)
    );

    channel.bind("game-event", (msg: WebSocketMessage) => {
      setLastMessage(msg);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe("buzzmaster");
      pusher.disconnect();
    };
  }, []);

  return {
    socket: null,
    isConnected,
    lastMessage,
    sendMessage: (_msg?: unknown) => {},
    connect: () => {},
    disconnect: () => {},
  };
}
