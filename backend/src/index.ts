//backend/src/index.ts

import dotenv from "dotenv";
import "dotenv/config";   

import express from "express";
import api from "./routes"; 
import cors from "cors";
import http from "http";
import { deactivateExpiredSubscriptions } from "./utils/subscriptionCleanup";
import { startSchedulers } from "./jobs/scheduler";
import { initSocket } from "./socket/server";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./docs/swagger";
import rateLimit from "express-rate-limit";
import path from "path";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

const writeLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 30,          // 30 write ops/min per IP
});

const isProd = process.env.NODE_ENV === "production";

const allowedOrigins = new Set<string>([
  "https://cribspot.co.ke",
  "https://www.cribspot.co.ke",
  "https://api.cribspot.co.ke",
  "https://www.api.cribspot.co.ke",
]);

if (!isProd) {
  allowedOrigins.add("http://localhost:3000");
  allowedOrigins.add("http://127.0.0.1:3000");
}

app.use(
  cors({
    origin(origin, cb) {
      // allow non-browser requests (Postman/curl) where Origin is undefined
      if (!origin) return cb(null, true);

      if (allowedOrigins.has(origin)) return cb(null, true);

      // IMPORTANT: don't throw — return an error via callback
      return cb(new Error(`CORS blocked: ${origin}`), false);
    },
    credentials: true,
  })
);

app.use(express.json());

// All REST routes centralized here
app.use("/api", api);

// Apply rate limits for sensitive endpoints
app.use("/api/properties", writeLimiter);
app.use("/api/payments", writeLimiter);

// Health routes 
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/ready", (_req, res) => res.json({ ready: true }));

// Static file serving (uploads)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// API docs
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  swaggerOptions: { persistAuthorization: true }
}));

// Create HTTP server and attach Socket.IO 
const server = http.createServer(app);
initSocket(server);

// Start server
server.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await deactivateExpiredSubscriptions(); // one-off sweep at boot
  startSchedulers(); // cron jobs (expiry checks, reminders, etc.)
});

// Confirm MPESA Callback Variables
console.log("MPESA_CALLBACK_URL =", process.env.MPESA_CALLBACK_URL);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down...");
  server.close(() => process.exit(0));
});