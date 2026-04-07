//backend/src/controllers/alert.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";

// 1. User subscribes for alerts
export const createAlert = async (req: Request, res: Response) => {
  try {
    const { email, location } = req.body;

    const alert = await prisma.alert.create({
      data: { email, location },
    });

    res.status(201).json({ message: "Alert created successfully", alert });
  } catch (err) {
    res.status(500).json({ message: "Failed to create alert", error: err });
  }
};

// 2. Admin: View all alerts
export const getAllAlerts = async (_req: Request, res: Response) => {
  try {
    const alerts = await prisma.alert.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.json(alerts);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch alerts", error: err });
  }
};

// 3. Admin: Trigger alert notification (email simulation)
export const sendAlertNotification = async (req: Request, res: Response) => {
  try {
    const { message, location } = req.body;

    const alerts = await prisma.alert.findMany({
      where: { location },
    });

    if (alerts.length === 0) {
      return res.status(404).json({ message: "No alerts found for location" });
    }

    // Simulate sending email (e.g., with nodemailer, actual integration later)
    alerts.forEach((a) => {
      console.log(`Sending alert to ${a.email} for ${location}: ${message}`);
    });

    res.json({ message: `Alerts sent to ${alerts.length} subscribers for ${location}` });
  } catch (err) {
    res.status(500).json({ message: "Failed to send alerts", error: err });
  }
};