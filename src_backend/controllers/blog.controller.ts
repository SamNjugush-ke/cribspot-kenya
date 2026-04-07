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

function escHtml(value: any): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function asPlainText(value: any): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(asPlainText).filter(Boolean).join(" ");
  if (typeof value === "object") {
    if (typeof value.text === "string") return value.text;
    if (typeof value.content === "string") return value.content;
    if (typeof value.caption === "string") return value.caption;
    if (typeof value.title === "string") return value.title;
    if (typeof value.url === "string") return value.url;
    if (value.file?.url) return asPlainText(value.file.url);
    return Object.values(value).map(asPlainText).filter(Boolean).join(" ");
  }
  return "";
}

function asInlineHtml(value: any): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(asInlineHtml).join("");
  if (typeof value === "object") {
    if (typeof value.text === "string") return value.text;
    if (typeof value.content === "string") return value.content;
    if (typeof value.caption === "string") return value.caption;
    if (typeof value.title === "string") return value.title;
    return Object.values(value).map(asInlineHtml).join("");
  }
  return "";
}

function getEditorJsImageUrl(data: any): string {
  const url = data?.file?.url || data?.url || data?.src || "";
  return typeof url === "string" ? url : asPlainText(url);
}

function renderEditorJsListItems(items: any[]): string {
  return (items || [])
    .map((item: any) => {
      if (item == null) return "";

      if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
        return `<li>${String(item)}</li>`;
      }

      if (typeof item === "object") {
        const content = asInlineHtml(item.content ?? item.text ?? item.title ?? item);
        const childItems = Array.isArray(item.items) && item.items.length
          ? `<ul>${renderEditorJsListItems(item.items)}</ul>`
          : "";
        return `<li>${content}${childItems}</li>`;
      }

      return `<li>${escHtml(asPlainText(item))}</li>`;
    })
    .join("");
}

function extractEditorJsTableRows(data: any): any[][] {
  const rows = Array.isArray(data?.content)
    ? data.content
    : Array.isArray(data?.withHeadings) || Array.isArray(data?.rows)
    ? data.rows
    : [];

  return Array.isArray(rows) ? rows : [];
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

      switch (b.type) {
        case "list":
          return asPlainText(d.items);
        case "table":
          return asPlainText(extractEditorJsTableRows(d));
        case "image":
          return asPlainText([d.caption, getEditorJsImageUrl(d)]);
        default:
          return asPlainText(d.text ?? d.caption ?? d.title ?? d);
      }
    })
    .filter(Boolean);

  return texts.join(" ").replace(/\s+/g, " ").trim();
}

/** Convert Editor.js JSON into HTML */
function renderEditorJsToHtml(json: any): string {
  try {
    const blocks = Array.isArray(json?.blocks) ? json.blocks : [];

    return blocks
      .map((b: any) => {
        const d = b?.data || {};

        switch (b?.type) {
          case "header": {
            const lvl = Math.min(Math.max(Number(d.level) || 2, 1), 6);
            return `<h${lvl}>${asInlineHtml(d.text)}</h${lvl}>`;
          }

          case "paragraph":
            return `<p>${asInlineHtml(d.text)}</p>`;

          case "list": {
            const style = d.style === "ordered" ? "ordered" : "unordered";
            const tag = style === "ordered" ? "ol" : "ul";
            const items = Array.isArray(d.items) ? d.items : [];
            return `<${tag}>${renderEditorJsListItems(items)}</${tag}>`;
          }

          case "quote": {
            const caption = d.caption ? `<cite>${escHtml(asPlainText(d.caption))}</cite>` : "";
            return `<blockquote>${asInlineHtml(d.text)}${caption}</blockquote>`;
          }

          case "table": {
            const rows = extractEditorJsTableRows(d);
            const useHead = !!d.withHeadings;
            if (!rows.length) return "";

            const renderCell = (cell: any, tag: "td" | "th") => `<${tag}>${asInlineHtml(cell)}</${tag}>`;
            const head = useHead && rows[0]?.length
              ? `<thead><tr>${rows[0].map((cell: any) => renderCell(cell, "th")).join("")}</tr></thead>`
              : "";
            const bodyRows = (useHead ? rows.slice(1) : rows)
              .map((row: any[]) => `<tr>${(Array.isArray(row) ? row : []).map((cell: any) => renderCell(cell, "td")).join("")}</tr>`)
              .join("");

            return `<div class="blog-table-wrap"><table>${head}<tbody>${bodyRows}</tbody></table></div>`;
          }

          case "delimiter":
            return `<hr />`;

          case "image": {
            const url = getEditorJsImageUrl(d);
            if (!url) return "";
            const caption = d?.caption ? `<figcaption>${escHtml(asPlainText(d.caption))}</figcaption>` : "";
            return `<figure><img src="${escHtml(url)}" alt="${escHtml(asPlainText(d.caption || "image"))}" />${caption}</figure>`;
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
              if (mark.type === "link") text = `<a href="${mark.attrs.href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
            }
          }
          return text;
        }
        case "heading":
          return `<h${node.attrs.level}>${(node.content || []).map(recur).join("")}</h${node.attrs.level}>`;
        case "bulletList":
          return `<ul>${(node.content || []).map(recur).join("")}</ul>`;
        case "orderedList":
          return `<ol>${(node.content || []).map(recur).join("")}</ol>`;
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

function deriveContentFields(contentJson: Prisma.InputJsonValue | null, format: ContentFormat) {
  const textPlain =
    format === "EDITORJS" && contentJson
      ? extractTextFromEditorJS(contentJson)
      : format === "TIPTAP" && contentJson
      ? extractTextFromTipTap(contentJson)
      : "";

  const contentHtml =
    format === "EDITORJS" && contentJson
      ? renderEditorJsToHtml(contentJson)
      : format === "TIPTAP" && contentJson
      ? renderTipTapToHtml(contentJson)
      : null;

  return {
    textPlain,
    contentHtml,
    readingTimeMins: estimateReadingTime(textPlain),
  };
}

function serializeBlogForRead<T extends Record<string, any>>(blog: T): T {
  const rawContent =
    blog.contentJson && blog.contentJson !== (Prisma as any).JsonNull
      ? (blog.contentJson as Prisma.InputJsonValue)
      : null;

  if (!rawContent) return blog;

  const format = pickContentFormat(String(blog.contentFormat || "TIPTAP"));
  const derived = deriveContentFields(rawContent, format);

  return {
    ...blog,
    contentJson: rawContent,
    contentText: derived.textPlain || blog.contentText || null,
    contentHtml: derived.contentHtml || blog.contentHtml || null,
    readingTimeMins: derived.readingTimeMins || blog.readingTimeMins || 1,
    excerpt: blog.excerpt || toExcerpt(rawContent, format, blog.title || ""),
  };
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

    const user = (req as any).user as { role?: Role } | undefined;
    const isPrivileged =
      user?.role === Role.EDITOR ||
      user?.role === Role.ADMIN ||
      user?.role === Role.SUPER_ADMIN;

    const wantsDraftOnly = status === "draft";
    const wantsPublishedOnly = status === "published";
    const wantsAll = status === "all" || includeUnpublished === "1";

    let publishedFilter: boolean | undefined;

    if (!isPrivileged) {
      publishedFilter = true;
    } else {
      if (wantsPublishedOnly) publishedFilter = true;
      else if (wantsDraftOnly) publishedFilter = false;
      else if (wantsAll) publishedFilter = undefined;
      else publishedFilter = true;
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
      const u = (req as any).user;
      const allowed = u && [Role.EDITOR, Role.ADMIN, Role.SUPER_ADMIN].includes(u.role);
      if (!allowed) return res.status(404).json({ message: "Blog not found" });
    }

    res.json(serializeBlogForRead(blog));
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

    const derived = deriveContentFields(parsedJson, format);
    const finalExcerpt = excerpt?.trim() || toExcerpt(parsedJson, format, title);

    const base = slugify(slugIn || title);
    const suffix = Math.random().toString(36).slice(2, 8);
    const slug = `${base}-${suffix}`;

    const created = await prisma.blog.create({
      data: {
        title,
        slug,
        coverImage: coverImage ?? null,
        excerpt: finalExcerpt,
        contentJson: parsedJson ?? (Prisma as any).JsonNull,
        contentFormat: format,
        contentText: derived.textPlain,
        contentHtml: derived.contentHtml,
        readingTimeMins: derived.readingTimeMins,
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

    const currentJson =
      (existing.contentJson as any) && (existing.contentJson as any) !== (Prisma as any).JsonNull
        ? (existing.contentJson as Prisma.InputJsonValue)
        : null;

    const contentFormat = rawFmt ? pickContentFormat(rawFmt) : existing.contentFormat;
    const contentJson: Prisma.InputJsonValue | null =
      raw !== undefined ? (typeof raw === "string" ? JSON.parse(raw) : raw) : currentJson;

    const derived = deriveContentFields(contentJson, contentFormat);

    const nextPublished = typeof published === "boolean" ? published : existing.published;
    const nextPublishedAt = nextPublished ? existing.publishedAt ?? new Date() : null;

    const updated = await prisma.blog.update({
      where: { id },
      data: {
        title: title ?? existing.title,
        slug: slug ? slugify(slug) : existing.slug,
        coverImage: coverImage ?? existing.coverImage,
        excerpt: excerpt ?? existing.excerpt,
        contentJson: (contentJson ?? (Prisma as any).JsonNull) as any,
        contentFormat,
        contentText: derived.textPlain,
        contentHtml: derived.contentHtml,
        readingTimeMins: derived.readingTimeMins,
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

    res.json(serializeBlogForRead(blog));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch blog", error: err });
  }
};
