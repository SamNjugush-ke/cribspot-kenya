// backend/src/socket/server.ts
import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import prisma from "../utils/prisma";

export let io: Server;

export function initSocket(server: HttpServer) {
  const isProd = process.env.NODE_ENV === "production";

  const socketOrigins = isProd
    ? [
        "https://cribspot.co.ke",
        "https://www.cribspot.co.ke",
        // optional, but safe to include if your frontend ever uses it
        "https://api.cribspot.co.ke",
        "https://www.api.cribspot.co.ke",
      ]
    : ["http://localhost:3000", "http://127.0.0.1:3000"];

  io = new Server(server, {
    cors: {
      origin: socketOrigins,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    // client should send userId after connecting
    socket.on("auth:hello", async ({ userId }: { userId: string }) => {
      if (!userId) return;

      socket.join(`user:${userId}`);

      // auto-join their conversation rooms
      const convos = await prisma.conversationParticipant.findMany({
        where: { userId },
        select: { conversationId: true },
        take: 500,
      });

      convos.forEach((c) => socket.join(`convo:${c.conversationId}`));
    });

    socket.on("disconnect", () => {});
  });
}
