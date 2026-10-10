import { io, type ManagerOptions, type Socket, type SocketOptions } from "socket.io-client";
import { API_URL } from "@/lib/constants";

/**
 * Connects to the backend's Socket.IO server.
 *
 * When the API lives under a path (https://syncro.test/api), passing that URL to io()
 * makes "/api" a namespace and the client looks for /socket.io at the site root, which
 * never reaches the backend. The path has to go in the `path` option instead.
 */
export function connectSocket(options: Partial<ManagerOptions & SocketOptions> = {}): Socket {
  const url = new URL(API_URL, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  const basePath = url.pathname.replace(/\/+$/, "");
  return io(url.origin, {
    path: `${basePath}/socket.io`,
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    ...options,
  });
}
