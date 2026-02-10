//backend/src/routes/index.ts
import { Router } from "express";

import users from "./users";
import accessRoles from "./access.roles";
import accessUsers from "./access.users";
import audit from "./audit";
import amenityRoutes from "./amenity.routes";
import propertyRoutes from "./property.routes";
import subscriptionPlanRoutes from "./subscriptionPlan.routes";
import subscriptionRoutes from "./subscription.routes";
import paymentRoutes from "./payments.routes";
import supportRoutes from "./support.routes";

import authRoutes from "./auth.routes";
import blogRoutes from "./blog.routes";
import commentRoutes from "./comment.routes";
import favoriteRoutes from "./favorite.routes";
import messageRoutes from "./message.routes";
import notificationRoutes from "./notification.routes";
import analyticsRoutes from "./analytics.routes";
import agentRoutes from "./agent.routes";
import uploadRoutes from "./upload.routes";
import alertRoutes from "./alert.routes";
import adminRoutes from "./admin.routes";
import sendBroadcast from "./admin.broadcasts.routes";;

const api = Router();

// Core / RBAC
api.use("/users", users);
api.use("/access/roles", accessRoles);
api.use("/access/users", accessUsers);
api.use("/audit", audit);

// Domain: Listings & Amenities
api.use("/amenities", amenityRoutes);
api.use("/properties", propertyRoutes);

// Billing: Plans / Subscriptions / Payments
api.use("/plans", subscriptionPlanRoutes);
api.use("/subscriptions", subscriptionRoutes);
api.use("/payments", paymentRoutes);

// Support / Helpdesk
api.use("/support", supportRoutes);

// Content & Other Modules
api.use("/auth", authRoutes);
api.use("/blogs", blogRoutes);
api.use("/comments", commentRoutes);
api.use("/favorites", favoriteRoutes);
api.use("/messages", messageRoutes);
api.use("/notifications", notificationRoutes);
api.use("/analytics", analyticsRoutes);
api.use("/agents", agentRoutes);
api.use("/upload", uploadRoutes);
api.use("/uploads", uploadRoutes);
api.use("/alerts", alertRoutes);
api.use("/admin", adminRoutes);

//Messaging
api.use("/admin/broadcasts", sendBroadcast);

// Basic health for quick smoke-tests
api.get("/health", (_req, res) =>
  res.json({ ok: true, uptime: process.uptime(), ts: new Date().toISOString() })
);

export default api;