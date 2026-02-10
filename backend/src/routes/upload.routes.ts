//backend/src/routes/upload.routes.ts
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { promises as fsp } from "fs";
import crypto from "crypto";
import { verifyToken } from "../middlewares/verifyToken";
import { requireAuth } from "../middlewares/requireAuth";
import { uploadBlogImage } from "../controllers/upload.controller";

const router = express.Router();

/* -------------------- Config -------------------- */
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL || "http://localhost:4000";
const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");
const MISC_DIR = path.join(UPLOADS_ROOT, "misc");
const BLOG_DIR = path.join(UPLOADS_ROOT, "blogs");

// Ensure base directories exist
function ensureDirSync(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
ensureDirSync(UPLOADS_ROOT);
ensureDirSync(MISC_DIR);
ensureDirSync(BLOG_DIR);

/* -------------------- Multer -------------------- */
const uploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

/* -------------------- Routes -------------------- */

/**
 * GET /api/uploads?dir=blog&q=...
 * Returns { files: [{ url, path, filename, size, mime, createdAt }] }
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const dir = String(req.query.dir || "blog");
    const q = String(req.query.q || "").toLowerCase();

    const target =
      dir === "blog"
        ? BLOG_DIR
        : dir === "misc"
        ? MISC_DIR
        : path.join(UPLOADS_ROOT, dir);

    ensureDirSync(target);

    const files = await fsp.readdir(target);
    const filtered = q
      ? files.filter((f) => f.toLowerCase().includes(q))
      : files;

    const out = await Promise.all(
      filtered.map(async (filename) => {
        const abs = path.join(target, filename);
        const st = await fsp.stat(abs);
        const rel = path.relative(UPLOADS_ROOT, abs).replace(/\\/g, "/"); // windows-safe
        const url = `${PUBLIC_BASE}/uploads/${rel}`;
        return {
          url,
          path: abs, // server path used for delete
          filename,
          size: st.size,
          createdAt: st.birthtime?.toISOString?.() || undefined,
        };
      })
    );

    return res.json({ files: out });
  } catch (e) {
    return res.status(500).json({ message: "Failed to list uploads" });
  }
});

/**
 * POST /api/uploads?dir=blog  (FormData file)
 * Returns { url, filename, size, mimeType }
 */
router.post("/", verifyToken, uploader.single("file"), async (req, res) => {
  try {
    const dir = String(req.query.dir || "blog");
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ message: "No file uploaded. Use field name 'file'." });
    }

    const target =
      dir === "blog"
        ? BLOG_DIR
        : dir === "misc"
        ? MISC_DIR
        : path.join(UPLOADS_ROOT, dir);

    ensureDirSync(target);

    const rawExt = path.extname(file.originalname || "").toLowerCase();
    const ext = rawExt || ".jpg";
    const name = `${crypto.randomBytes(10).toString("hex")}${ext}`;
    const abs = path.join(target, name);

    fs.writeFileSync(abs, file.buffer);

    const rel = path.relative(UPLOADS_ROOT, abs).replace(/\\/g, "/");
    const url = `${PUBLIC_BASE}/uploads/${rel}`;

    return res.status(201).json({
      url,
      filename: name,
      size: file.size,
      mimeType: file.mimetype,
    });
  } catch (e) {
    return res.status(500).json({ message: "Upload failed" });
  }
});

/**
 * DELETE /api/uploads?path=<absolute-path>
 * IMPORTANT: ensure delete is limited to uploads folder.
 */
router.delete("/", verifyToken, async (req, res) => {
  try {
    const p = String(req.query.path || "");
    if (!p) return res.status(400).json({ message: "Missing path" });

    const resolved = path.resolve(p);
    if (!resolved.startsWith(UPLOADS_ROOT)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await fsp.unlink(resolved);
    return res.json({ message: "Deleted" });
  } catch (e) {
    return res.status(500).json({ message: "Delete failed" });
  }
});



/**
 * POST /api/uploads/image (misc)
 */
router.post(
  "/image",
  verifyToken,
  uploader.single("file"),
  async (req, res) => {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) {
        return res
          .status(400)
          .json({ message: "No file uploaded. Use field name 'file'." });
      }

      const rawExt = path.extname(file.originalname || "").toLowerCase();
      const ext = rawExt || ".jpg";
      const name = `${crypto.randomBytes(10).toString("hex")}${ext}`;
      const abs = path.join(MISC_DIR, name);

      fs.writeFileSync(abs, file.buffer);

      const url = `${PUBLIC_BASE}/uploads/misc/${name}`;
      return res.status(201).json({
        message: "Uploaded",
        url,
        filename: name,
        size: file.size,
        mimeType: file.mimetype,
      });
    } catch (err) {
      console.error("Upload error:", err);
      return res
        .status(500)
        .json({ message: "Upload failed", error: (err as Error).message });
    }
  }
);

/**
 * GET /api/uploads/misc
 */
router.get("/misc", (_req, res) => {
  try {
    ensureDirSync(MISC_DIR);
    const files = fs.readdirSync(MISC_DIR);
    const urls = files.map((f) => `${PUBLIC_BASE}/uploads/misc/${f}`);
    res.json({ count: files.length, files: urls });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to list uploads", error: (err as Error).message });
  }
});

/**
 * POST /api/uploads/editor-image
 * Editor.js compatible
 */
router.post(
  "/editor-image",
  verifyToken,
  requireAuth,
  uploader.single("file"),
  async (req, res) => {
    try {
      const file = req.file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ success: 0, message: "No file" });

      const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
      const ext = (path.extname(file.originalname || "") || "").toLowerCase();
      if (!allowed.includes(ext)) {
        return res
          .status(400)
          .json({ success: 0, message: "Invalid file type" });
      }

      const dir = path.join(process.cwd(), "uploads");
      await fsp.mkdir(dir, { recursive: true });

      const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      const full = path.join(dir, name);
      await fsp.writeFile(full, file.buffer);

      const url = `${PUBLIC_BASE}/uploads/${name}`;
      res.json({ success: 1, file: { url } });
    } catch (e) {
      console.error("editor-image upload failed:", e);
      res.status(500).json({ success: 0, message: "Upload failed" });
    }
  }
);

/**
 * POST /api/uploads/blog-image
 * Save blog featured image in /uploads/blogs
 */
router.post(
  "/blog-image",
  verifyToken,
  uploader.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      ensureDirSync(BLOG_DIR);

      const rawExt = path.extname(req.file.originalname || "").toLowerCase();
      const ext = rawExt || ".jpg";
      const name = `${crypto.randomBytes(10).toString("hex")}${ext}`;
      const abs = path.join(BLOG_DIR, name);

      fs.writeFileSync(abs, req.file.buffer);

      const url = `${PUBLIC_BASE}/uploads/blogs/${name}`;
      return res.status(201).json({
        url,
        filename: name,
        size: req.file.size,
        mimeType: req.file.mimetype,
      });
    } catch (err) {
      console.error("Blog upload error:", err);
      return res
        .status(500)
        .json({ message: "Failed to upload blog image", error: (err as Error).message });
    }
  }
);




export default router;
