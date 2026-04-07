//src/routes/comment.routes.ts

import express from "express";
import { addComment, getCommentsByBlog, deleteComment } from "../controllers/comment.controller";
import { verifyToken } from "../middlewares";

const router = express.Router();

router.post("/", verifyToken, addComment);
router.get("/:blogId", getCommentsByBlog);
router.delete("/:id", verifyToken, deleteComment);

export default router;