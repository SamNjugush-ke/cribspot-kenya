//backend/src/routes/blog.routes.ts

import express from "express";
import rateLimit from "express-rate-limit";
import { verifyToken } from "../middlewares/verifyToken";
import { requireRole } from "../middlewares/requireRole";
import { Role } from "@prisma/client";
import { optionalVerifyToken } from "../middlewares/optionalVerifyToken";

import {
  listBlogs,
  getBlog,
  createBlog,
  updateBlog,
  deleteBlog,
  listComments,
  addComment,
  listLatestBlogs,
  duplicateBlog,
  getBlogBySlug,
} from "../controllers/blog.controller";

import {
  listTags,
  createTag,
  deleteTag,
  attachTagToBlog,
  detachTagFromBlog,
  listCategories,
  createCategory,
  deleteCategory,
  attachCategoryToBlog,
  detachCategoryFromBlog,
  createAndAttachTag,
  searchTags,
  createAndAttachCategory,
  searchCategories,
  updateTag,
  updateCategory,
} from "../controllers/tagCategory.controller";

import {
  getBlogTags,
  addBlogTags,
  getBlogCategories,
  addBlogCategories,
} from "../controllers/blogRelations.controller";

import {
  checkSlug,
  deleteCommentModeration,
  listAllComments,
  updateCommentStatus,
} from "../controllers/comment.controller";

const router = express.Router();

const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many comments. Please wait a bit and try again." },
});

/**
 * RULES:
 * - Static routes first
 * - Nested routes before "/:id"
 * - "/:id" LAST
 */

/* -------------------------------
   LIST + LATEST + SLUG CHECK
   ------------------------------- */

// Dashboard/editor calls include token → listBlogs can honor includeUnpublished/includeTrashed for roles
router.get("/", optionalVerifyToken, listBlogs);
router.get("/latest", listLatestBlogs);
router.get("/check-slug", checkSlug);
router.get("/slug/:slug", getBlogBySlug);

/* -------------------------------
   TAGS (static before "/:id")
   ------------------------------- */
router.get("/tags/all", listTags);
router.get("/tags", searchTags);

router.post(
  "/tags",
  verifyToken,
  requireRole([Role.EDITOR, Role.ADMIN, Role.SUPER_ADMIN]),
  createTag
);

router.delete(
  "/tags/:id",
  verifyToken,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  deleteTag
);

/* -------------------------------
   CATEGORIES (static before "/:id")
   ------------------------------- */
router.get("/categories/all", listCategories);
router.get("/categories", searchCategories);

router.post(
  "/categories",
  verifyToken,
  requireRole([Role.EDITOR, Role.ADMIN, Role.SUPER_ADMIN]),
  createCategory
);

router.delete(
  "/categories/:id",
  verifyToken,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  deleteCategory
);

/* -------------------------------
   COMMENT MODERATION (static)
   ------------------------------- */
router.get(
  "/comments",
  verifyToken,
  requireRole([Role.EDITOR, Role.ADMIN, Role.SUPER_ADMIN]),
  listAllComments
);

router.patch(
  "/comments/:commentId",
  verifyToken,
  requireRole([Role.EDITOR, Role.ADMIN, Role.SUPER_ADMIN]),
  updateCommentStatus
);

router.delete(
  "/comments/:commentId",
  verifyToken,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  deleteCommentModeration
);

/* -------------------------------
   BLOG CRUD (protected static)
   ------------------------------- */
router.post(
  "/",
  verifyToken,
  requireRole([Role.EDITOR, Role.ADMIN, Role.SUPER_ADMIN]),
  createBlog
);

/* -------------------------------
   BLOG NESTED ROUTES (before "/:id")
   ------------------------------- */

// Comments on a blog
router.get("/:id/comments", listComments);
router.post("/:id/comments", verifyToken, commentLimiter, addComment);

// Duplicate
router.post(
  "/:id/duplicate",
  verifyToken,
  requireRole([Role.EDITOR, Role.ADMIN, Role.SUPER_ADMIN]),
  duplicateBlog
);

// Blog ↔ Tags (bulk)
router.get("/:id/tags", getBlogTags);
router.post(
  "/:id/tags",
  verifyToken,
  requireRole([Role.EDITOR, Role.ADMIN, Role.SUPER_ADMIN]),
  addBlogTags
);

router.patch(
  "/tags/:id",
  verifyToken,
  requireRole([Role.EDITOR, Role.ADMIN, Role.SUPER_ADMIN]),
  updateTag
);


// Blog ↔ Categories (bulk)
router.get("/:id/categories", getBlogCategories);
router.post(
  "/:id/categories",
  verifyToken,
  requireRole([Role.EDITOR, Role.ADMIN, Role.SUPER_ADMIN]),
  addBlogCategories
);

router.patch(
  "/categories/:id",
  verifyToken,
  requireRole([Role.EDITOR, Role.ADMIN, Role.SUPER_ADMIN]),
  updateCategory
);

// Create + attach new tag/category to a blog
router.post(
  "/:id/tags/new",
  verifyToken,
  requireRole([Role.EDITOR, Role.ADMIN, Role.SUPER_ADMIN]),
  createAndAttachTag
);

router.post(
  "/:id/categories/new",
  verifyToken,
  requireRole([Role.EDITOR, Role.ADMIN, Role.SUPER_ADMIN]),
  createAndAttachCategory
);

// Attach/detach existing tag/category
router.post(
  "/:id/tags/:tagId",
  verifyToken,
  requireRole([Role.EDITOR, Role.ADMIN, Role.SUPER_ADMIN]),
  attachTagToBlog
);

router.delete(
  "/:id/tags/:tagId",
  verifyToken,
  requireRole([Role.EDITOR, Role.ADMIN, Role.SUPER_ADMIN]),
  detachTagFromBlog
);

router.post(
  "/:id/categories/:categoryId",
  verifyToken,
  requireRole([Role.EDITOR, Role.ADMIN, Role.SUPER_ADMIN]),
  attachCategoryToBlog
);

router.delete(
  "/:id/categories/:categoryId",
  verifyToken,
  requireRole([Role.EDITOR, Role.ADMIN, Role.SUPER_ADMIN]),
  detachCategoryFromBlog
);

/* -------------------------------
   "/:id" LAST
   ------------------------------- */

// Update blog
router.put(
  "/:id",
  verifyToken,
  requireRole([Role.EDITOR, Role.ADMIN, Role.SUPER_ADMIN]),
  updateBlog
);

// Delete blog (soft delete in controller, admin+)
router.delete(
  "/:id",
  verifyToken,
  requireRole([Role.ADMIN, Role.SUPER_ADMIN]),
  deleteBlog
);

// Blog detail: public published-only, but allow editor preview via token
router.get("/:id", optionalVerifyToken, getBlog);

export default router;