import { Response } from "express";

/**
 * Server-Sent Events helper for streaming real-time updates to the frontend.
 */
export interface SSEConnection {
  send: (event: string, data: unknown) => void;
  close: () => void;
}

/**
 * Initialize an SSE connection on an Express response.
 * Returns a helper object for sending events.
 */
export function createSSEConnection(res: Response): SSEConnection {
  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  // Send initial connection event
  res.write("event: connected\ndata: {}\n\n");

  return {
    send(event: string, data: unknown): void {
      const payload = typeof data === "string" ? data : JSON.stringify(data);
      res.write(`event: ${event}\ndata: ${payload}\n\n`);
    },
    close(): void {
      res.write("event: done\ndata: {}\n\n");
      res.end();
    },
  };
}
