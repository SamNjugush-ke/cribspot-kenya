import express from "express";
import { addFavorite, removeFavorite, toggleFavorite, listMyFavorites } from "../controllers/favorite.controller";
import { verifyToken } from "../middlewares/verifyToken";
import { requireAuth } from "../middlewares/requireAuth";

const router = express.Router();

// Auth required
router.post("/:propertyId", verifyToken, requireAuth, addFavorite);
router.delete("/:propertyId", verifyToken, requireAuth, removeFavorite);
router.post("/:propertyId/toggle", verifyToken, requireAuth, toggleFavorite);
router.get("/me", verifyToken, requireAuth, listMyFavorites);

export default router;