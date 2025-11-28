/**
 * Get the WebSocket URL based on the current environment
 * Returns empty string during SSR to avoid hydration mismatch
 */
export function getWebSocketUrl(): string {
  // During SSR, return empty string
  // The hook should handle this gracefully
  if (typeof window === "undefined") {
    return "";
  }

  // Use the current page's origin to construct the WebSocket URL
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  
  return `${protocol}//${host}/ws`;
}
