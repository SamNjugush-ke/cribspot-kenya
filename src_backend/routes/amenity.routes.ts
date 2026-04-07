import express from "express";
import { listAmenities, createAmenity } from "../controllers/amenity.controller";
import { verifyToken } from "../middlewares/verifyToken";
import { requireAuth } from "../middlewares/requireAuth";

const router = express.Router();

// Public: list all amenities (listers need to see them in UI)
router.get("/", listAmenities);

// Protected: create new amenity (tighten with RBAC as needed)
router.post("/", verifyToken, requireAuth, createAmenity);

export default router;