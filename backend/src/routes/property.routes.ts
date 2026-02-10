// backend/src/routes/property.routes.ts
import express from "express";
import multer from "multer";

import {
  getAllProperties,
  getPropertyById,
  createProperty,
  deleteProperty,
  getPropertyDetails,
  getSimilarProperties,
  updateProperty,
  getPublishedProperties,
  publishProperty,
  changePropertyStatus,
  getMyProperties,
  getPropertyStatsByCounty,
  getPropertyStatsByConstituency,
  uploadPropertyImage,
  removePropertyImage,
} from "../controllers/property.controller";

import { verifyToken } from "../middlewares/verifyToken";
import { requireAuth } from "../middlewares/requireAuth";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * PUBLIC ROUTES (READ-ONLY)
 * Order matters: specific routes before "/:id"
 */
router.get("/published", getPublishedProperties);
router.get("/stats/counties", getPropertyStatsByCounty);
router.get("/stats/constituencies", getPropertyStatsByConstituency);
router.get("/", getAllProperties);

/**
 * AUTHENTICATED ROUTES (OWNER-SCOPED)
 */
router.get("/mine", verifyToken, requireAuth, getMyProperties);

// Must come after /mine
router.get("/:id/details", getPropertyDetails);
router.get("/:id/similar", getSimilarProperties);
router.get("/:id", getPropertyById);

router.post("/", verifyToken, requireAuth, createProperty);
router.patch("/:id", verifyToken, requireAuth, updateProperty);
router.patch("/:id/publish", verifyToken, requireAuth, publishProperty);
router.patch("/:id/status", verifyToken, requireAuth, changePropertyStatus);
router.delete("/:id", verifyToken, requireAuth, deleteProperty);

/**
 * IMAGES
 */
router.post("/:id/images", verifyToken, requireAuth, upload.single("file"), uploadPropertyImage);
router.delete("/:id/images/:imageId", verifyToken, requireAuth, removePropertyImage);

export default router;