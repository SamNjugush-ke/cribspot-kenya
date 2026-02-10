import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { Prisma, ContentFormat, Role } from "@prisma/client";

/* ---------------- Helpers ---------------- */

function slugify(input: string) {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function pickContentFormat(raw?: string): ContentFormat {
  if (!raw) return "TIPTAP";
  const norm = raw.toUpperCase();
  if (norm === "EDITORJS") return "EDITORJS";
  if (norm === "MARKDOWN") return "MARKDOWN";
  if (norm === "HTML") return "HTML";
  return "TIPTAP";
}

/** Extract text from TipTap JSON */
function extractTextFromTipTap(json: any): string {
  const parts: string[] = [];
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "text" && typeof node.text === "string") parts.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(json);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** Extract text from Editor.js JSON */
function extractTextFromEditorJS(json: any): string {
  const blocks = Array.isArray(json?.blocks) ? json.blocks : [];
  const texts = blocks
    .map((b: any) => {
      if (!b || typeof b !== "object") return "";
      const d = b.data || {};
      if (typeof d.text === "string") return d.text;
      if (typeof d.caption === "string") return d.caption;
      if (typeof d.title === "string") return d.title;
      if (Array.isArray(d.items)) return d.items.join(" ");
      return "";
    })
    .filter(Boolean);
  return texts.join(" ").replace(/\s+/g, " ").trim();
}

/** Convert Editor.js JSON into HTML */
function renderEditorJsToHtml(json: any): string {
  try {
    const blocks = Array.isArray(json?.blocks) ? json.blocks : [];

    const esc = (s: any) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    return blocks
      .map((b: any) => {
        const d = b?.data || {};
        switch (b?.type) {
          case "header": {
            const lvl = Math.min(Math.max(Number(d.level) || 2, 1), 6);
            return `<h${lvl}>${d.text || ""}</h${lvl}>`;
          }

          case "paragraph":
            return `<p>${d.text || ""}</p>`;

          case "list": {
            const tag = d.style === "ordered" ? "ol" : "ul";
            const items = Array.isArray(d.items) ? d.items : [];
            return `<${tag}>${items.map((it: string) => `<li>${it}</li>`).join("")}</${tag}>`;
          }

          case "quote":
            return `<blockquote>${d.text || ""}</blockquote>`;

          case "table": {
            const rows = Array.isArray(d.content) ? d.content : [];
            return `<table>${rows
              .map((row: string[]) => `<tr>${(row || []).map((cell: string) => `<td>${cell}</td>`).join("")}</tr>`)
              .join("")}</table>`;
          }

          case "delimiter":
            return `<hr />`;

          case "image": {
            // EditorJS image tool stores URL as data.file.url
            const url = d?.file?.url || d?.url || "";
            if (!url) return "";
            const caption = d?.caption ? `<figcaption>${esc(d.caption)}</figcaption>` : "";
            // Keep it simple: figure + img
            return `<figure><img src="${esc(url)}" alt="${esc(d.caption || "image")}" />${caption}</figure>`;
          }

          default:
            return "";
        }
      })
      .join("");
  } catch {
    return "";
  }
}


/** Convert TipTap JSON into HTML (simplified) */
function renderTipTapToHtml(json: any): string {
  try {
    if (!json?.type && !json?.content) return "";
    const recur = (node: any): string => {
      if (!node) return "";
      switch (node.type) {
        case "paragraph":
          return `<p>${(node.content || []).map(recur).join("")}</p>`;
        case "text": {
          let text = node.text || "";
          if (node.marks) {
            for (const mark of node.marks) {
              if (mark.type === "bold") text = `<strong>${text}</strong>`;
              if (mark.type === "italic") text = `<em>${text}</em>`;
              if (mark.type === "underline") text = `<u>${text}</u>`;
              if (mark.type === "link") text = `<a href="${mark.attrs.href}" target="_blank">${text}</a>`;
            }
          }
          return text;
        }
        case "heading":
          return `<h${node.attrs.level}>${(node.content || []).map(recur).join("")}</h${node.attrs.level}>`;
        case "bulletList":
          return `<ul>${(node.content || []).map(recur).join("")}</ul>`;
        case "listItem":
          return `<li>${(node.content || []).map(recur).join("")}</li>`;
        default:
          return (node.content || []).map(recur).join("");
      }
    };
    return (json.content || []).map(recur).join("");
  } catch {
    return "";
  }
}

function toExcerpt(contentJson: any, format: ContentFormat, fallback = "", maxLen = 200): string {
  let text = "";
  try {
    text = format === "EDITORJS" ? extractTextFromEditorJS(contentJson) : extractTextFromTipTap(contentJson);
  } catch {
    text = "";
  }
  const t = (text || fallback || "").trim();
  return t.length > maxLen ? t.slice(0, maxLen - 1) + "…" : t;
}

function estimateReadingTime(text: string): number {
  const words = (text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/* --------------- Controllers --------------- */


// GET /api/blogs
export const listBlogs = async (req: Request, res: Response) => {
  try {
    const {
      search = "",
      page = "1",
      perPage = "10",
      sort = "newest",
      status = "all",
      categoryId,
      tagId,
      includeUnpublished = "0",
    } = req.query as Record<string, string>;

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const take = Math.min(Math.max(parseInt(perPage, 10) || 10, 1), 50);
    const skip = (p - 1) * take;

    // ✅ Fix Prisma orderBy typing (SortOrder, not string)
    const orderBy: Prisma.BlogOrderByWithRelationInput[] =
      sort === "oldest"
        ? [
            { updatedAt: Prisma.SortOrder.asc },
            { createdAt: Prisma.SortOrder.asc },
          ]
        : [
            { updatedAt: Prisma.SortOrder.desc },
            { createdAt: Prisma.SortOrder.desc },
          ];

    // ---- privilege check (works because route uses optionalVerifyToken)
    const user = (req as any).user as { role?: Role } | undefined;
    const isPrivileged =
      user?.role === Role.EDITOR ||
      user?.role === Role.ADMIN ||
      user?.role === Role.SUPER_ADMIN;

    const wantsDraftOnly = status === "draft";
    const wantsPublishedOnly = status === "published";
    const wantsAll = status === "all" || includeUnpublished === "1";

    // ✅ published filter logic:
    // Public users: ALWAYS published-only
    // Privileged:
    //   - published -> true
    //   - draft -> false
    //   - all OR includeUnpublished=1 -> undefined (both)
    let publishedFilter: boolean | undefined;

    if (!isPrivileged) {
      publishedFilter = true;
    } else {
      if (wantsPublishedOnly) publishedFilter = true;
      else if (wantsDraftOnly) publishedFilter = false;
      else if (wantsAll) publishedFilter = undefined; // BOTH drafts + published
      else publishedFilter = true; // privileged default
    }

    const where: Prisma.BlogWhereInput = {
      published: publishedFilter,
      OR: search
        ? [
            { title: { contains: search, mode: "insensitive" } },
            { excerpt: { contains: search, mode: "insensitive" } },
            { contentText: { contains: search, mode: "insensitive" } },
          ]
        : undefined,
      categories: categoryId ? { some: { categoryId } } : undefined,
      tags: tagId ? { some: { tagId } } : undefined,
    };

    const [items, total] = await Promise.all([
      prisma.blog.findMany({
        where,
        orderBy,
        skip,
        take,
        select: {
          id: true,
          title: true,
          slug: true,
          coverImage: true,
          excerpt: true,
          published: true,
          publishedAt: true,
          authorUser: { select: { id: true, name: true } },
        },
      }),
      prisma.blog.count({ where }),
    ]);

    res.json({
      items,
      pagination: {
        page: p,
        perPage: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch blogs", error: err });
  }
};


// GET /api/blogs/:id
export const getBlog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const blog = await prisma.blog.findUnique({
      where: { id },
      include: {
        authorUser: { select: { id: true, name: true } },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
      },
    });

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    if (!blog.published) {
      const u = (req as any).user; // populated only if verifyToken ran
      const allowed = u && [Role.EDITOR, Role.ADMIN, Role.SUPER_ADMIN].includes(u.role);
      if (!allowed) return res.status(404).json({ message: "Blog not found" });
    }

    res.json(blog);
  } catch (err) {
    res.status(500).json({ message: "Failed to load blog", error: err });
  }
};


// POST /api/blogs
export const createBlog = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const {
      title,
      slug: slugIn,
      coverImage,
      excerpt,
      contentJson: raw,
      contentFormat: rawFmt,
      seoTitle,
      seoDesc,
      seoKeywords,
      published = false,
    } = req.body;

    if (!title?.trim()) return res.status(400).json({ message: "Title is required" });

    const format = pickContentFormat(rawFmt);

    const parsedJson: Prisma.InputJsonValue | null =
      raw !== undefined ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;

    const textPlain =
      format === "EDITORJS" && parsedJson
        ? extractTextFromEditorJS(parsedJson)
        : format === "TIPTAP" && parsedJson
        ? extractTextFromTipTap(parsedJson)
        : "";

    const readingTimeMins = estimateReadingTime(textPlain);
    const finalExcerpt = excerpt?.trim() || toExcerpt(parsedJson, format, title);
    const contentHtml =
      format === "EDITORJS" && parsedJson
        ? renderEditorJsToHtml(parsedJson)
        : format === "TIPTAP" && parsedJson
        ? renderTipTapToHtml(parsedJson)
        : null;

    const base = slugify(slugIn || title);
    const suffix = Math.random().toString(36).slice(2, 8);
    const slug = `${base}-${suffix}`;

    const created = await prisma.blog.create({
      data: {
        title,
        slug,
        coverImage: coverImage ?? null,
        excerpt: finalExcerpt,
        contentJson: parsedJson ?? (Prisma as any).JsonNull, // 👈 important
        contentFormat: format,
        contentText: textPlain,
        contentHtml,
        readingTimeMins,
        seoTitle,
        seoDesc,
        seoKeywords,
        published,
        publishedAt: published ? new Date() : null,
        authorId: user.id,
      },
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ message: "Failed to create blog", error: err });
  }
};

// PUT /api/blogs/:id
export const updateBlog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.blog.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Blog not found" });

    const {
      title,
      slug,
      coverImage,
      excerpt,
      contentJson: raw,
      contentFormat: rawFmt,
      seoTitle,
      seoDesc,
      seoKeywords,
      published,
    } = req.body;

    // normalize current contentJson (can be Prisma.JsonNull)
    const currentJson =
      (existing.contentJson as any) && (existing.contentJson as any) !== (Prisma as any).JsonNull
        ? (existing.contentJson as Prisma.InputJsonValue)
        : null;

    let contentFormat = rawFmt ? pickContentFormat(rawFmt) : existing.contentFormat;
    let contentJson: Prisma.InputJsonValue | null =
      raw !== undefined ? (typeof raw === "string" ? JSON.parse(raw) : raw) : currentJson;

    let contentText = "";
    let contentHtml: string | null = null;
    let readingTimeMins = existing.readingTimeMins ?? 1;

    if (contentJson) {
      contentText =
        contentFormat === "EDITORJS"
          ? extractTextFromEditorJS(contentJson)
          : extractTextFromTipTap(contentJson);
      contentHtml =
        contentFormat === "EDITORJS"
          ? renderEditorJsToHtml(contentJson)
          : renderTipTapToHtml(contentJson);
      readingTimeMins = estimateReadingTime(contentText);
    }

    const nextPublished = typeof published === "boolean" ? published : existing.published;
    const nextPublishedAt = nextPublished ? existing.publishedAt ?? new Date() : null;

    const updated = await prisma.blog.update({
      where: { id },
      data: {
        title: title ?? existing.title,
        slug: slug ? slugify(slug) : existing.slug,
        coverImage: coverImage ?? existing.coverImage,
        excerpt: excerpt ?? existing.excerpt,
        contentJson: (contentJson ?? (Prisma as any).JsonNull) as any, // important
        contentFormat,
        contentText,
        contentHtml,
        readingTimeMins,
        seoTitle,
        seoDesc,
        seoKeywords,
        published: nextPublished,
        publishedAt: nextPublishedAt,
      },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update blog", error: err });
  }
};

// DELETE /api/blogs/:id
export const deleteBlog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.blog.delete({ where: { id } });
    res.json({ message: "Blog deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete blog", error: err });
  }
};

// GET /api/blogs/:id/comments
export const listComments = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const comments = await prisma.blogComment.findMany({
      where: { blogId: id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true } } },
    });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch comments", error: err });
  }
};

// POST /api/blogs/:id/comments
export const addComment = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const { content } = req.body as { content?: string };

    if (!content?.trim()) return res.status(400).json({ message: "Comment cannot be empty" });

    const blog = await prisma.blog.findFirst({ where: { id, published: true } });
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    const created = await prisma.blogComment.create({
      data: { blogId: id, userId: user.id, content: content.trim() },
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ message: "Failed to add comment", error: err });
  }
};

// GET /api/blogs/latest
export const listLatestBlogs = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 8, 20);
    const blogs = await prisma.blog.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: { id: true, title: true, slug: true, coverImage: true, publishedAt: true, excerpt: true },
    });
    res.json(blogs);
  } catch (err) {
    res.status(500).json({ message: "Failed to load blogs", error: err });
  }
};

// duplicate blog
export const duplicateBlog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const blog = await prisma.blog.findUnique({ where: { id } });
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    const baseSlug = blog.slug.replace(/-copy-\w+$/, "");
    const slug = `${baseSlug}-copy-${Math.random().toString(36).slice(2, 6)}`;

    const copy = await prisma.blog.create({
      data: {
        title: blog.title + " (Copy)",
        slug,
        coverImage: blog.coverImage,
        excerpt: blog.excerpt,
        // carry over null as Prisma.JsonNull
        contentJson:
          (blog.contentJson as any) && (blog.contentJson as any) !== (Prisma as any).JsonNull
            ? (blog.contentJson as Prisma.InputJsonValue)
            : (Prisma as any).JsonNull,
        contentFormat: blog.contentFormat,
        contentText: blog.contentText,
        contentHtml: blog.contentHtml,
        readingTimeMins: blog.readingTimeMins,
        seoTitle: blog.seoTitle,
        seoDesc: blog.seoDesc,
        seoKeywords: blog.seoKeywords,
        published: false,
        authorId: user.id,
      },
    });

    res.json(copy);
  } catch (err) {
    res.status(500).json({ message: "Failed to duplicate blog", error: err });
  }
};

// GET /api/blogs/slug/:slug
export const getBlogBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const blog = await prisma.blog.findUnique({
      where: { slug },
      include: {
        authorUser: { select: { id: true, name: true } },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
      },
    });

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    if (!blog.published) {
      const u = (req as any).user;
      const allowed = u && [Role.EDITOR, Role.ADMIN, Role.SUPER_ADMIN].includes(u.role);
      if (!allowed) return res.status(404).json({ message: "Blog not found" });
    }

    res.json(blog);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch blog", error: err });
  }
};
