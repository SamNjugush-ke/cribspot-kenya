"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import { API_BASE } from "@/lib/api";

type SocketContextValue = {
  socket: Socket | null;
  unread: number;
  setUnread: (n: number) => void;
};

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  unread: 0,
  setUnread: () => {},
});

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("rk_token");
    if (!token) return;

    const s = io(API_BASE, {
      auth: { token },
    });

    s.on("connect", () => {
      console.log("Socket connected");
    });

    // New message → bump unread count
    s.on("msg:new", () => {
      setUnread((prev) => prev + 1);
    });

    // Broadcast received
    s.on("msg:broadcast", () => {
      setUnread((prev) => prev + 1);
    });

    // Mark read event (optional: adjust counts)
    s.on("msg:read", () => {
      setUnread((prev) => Math.max(prev - 1, 0));
    });

    setSocket(s);

    // fetch initial unread count
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/messages/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUnread(data.unread || 0);
        }
      } catch (err) {
        console.error("Failed to fetch unread count", err);
      }
    })();

    return () => {
      s.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, unread, setUnread }}>
      {children}
    </SocketContext.Provider>
  );
}