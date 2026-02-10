//backend/src/controllers/comment.controller.ts
import { Request, Response } from "express";
import prisma from "../utils/prisma";

// Add comment or reply
export const addComment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { blogId, content, parentId } = req.body as {
      blogId: string;
      content: string;
      parentId?: string | null;
    };

    if (!blogId || !content?.trim()) {
      return res.status(400).json({ message: "blogId and content are required" });
    }

    const comment = await prisma.blogComment.create({
      data: {
        content: content.trim(),
        blog: { connect: { id: blogId } },
        user: { connect: { id: userId } },
        // only set parent relation if this is a reply
        parent: parentId ? { connect: { id: parentId } } : undefined,
      },
      include: {
        user: { select: { id: true, name: true } },
        replies: true,
      },
    });

    return res.status(201).json(comment);
  } catch (err) {
    return res.status(500).json({ message: "Failed to add comment", error: err });
  }
};


// Get comments for a blog
export const getCommentsByBlog = async (req: Request, res: Response) => {
  try {
    const { blogId } = req.params;

    const comments = await prisma.blogComment.findMany({
      where: {
        blogId,
        parentId: null, // Only top-level comments
      },
      include: {
        user: { select: { id: true, name: true } },
        replies: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch comments", error: err });
  }
};

// Delete comment (admin or comment owner only)
export const deleteComment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const comment = await prisma.blogComment.findUnique({ where: { id } });
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    if (comment.userId !== userId && userRole !== "ADMIN" && userRole !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Not allowed to delete this comment" });
    }

    await prisma.blogComment.delete({ where: { id } });

    res.json({ message: "Comment deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete comment", error: err });
  }
};

// GET /api/blogs/comments?status=pending|approved|hidden|all&blogId=&q=&page=&perPage=
export const listAllComments = async (req: Request, res: Response) => {
  try {
    const {
      status = "pending",
      blogId,
      q = "",
      page = "1",
      perPage = "20",
    } = req.query as Record<string, string>;

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const take = Math.min(Math.max(parseInt(perPage, 10) || 20, 1), 100);
    const skip = (p - 1) * take;

    const where: any = {
      blogId: blogId || undefined,
      OR: q
        ? [
            { content: { contains: q, mode: "insensitive" } },
            { user: { name: { contains: q, mode: "insensitive" } } },
            { blog: { title: { contains: q, mode: "insensitive" } } },
          ]
        : undefined,
    };

    if (status === "pending") where.isApproved = false;
    if (status === "approved") where.isApproved = true, where.hiddenAt = null;
    if (status === "hidden") where.hiddenAt = { not: null };
    // status=all => no extra

    const [items, total] = await Promise.all([
      prisma.blogComment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
          blog: { select: { id: true, title: true } },
        },
      }),
      prisma.blogComment.count({ where }),
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
    res.status(500).json({ message: "Failed to fetch comments", error: err });
  }
};

// PATCH /api/blogs/comments/:commentId
// body: { isApproved?: boolean, hidden?: boolean }
export const updateCommentStatus = async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const { isApproved, hidden } = req.body as { isApproved?: boolean; hidden?: boolean };

    const updated = await prisma.blogComment.update({
      where: { id: commentId },
      data: {
        isApproved: typeof isApproved === "boolean" ? isApproved : undefined,
        hiddenAt: typeof hidden === "boolean" ? (hidden ? new Date() : null) : undefined,
      },
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update comment", error: err });
  }
};

// DELETE /api/blogs/comments/:commentId (Admin+)
export const deleteCommentModeration = async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    await prisma.blogComment.delete({ where: { id: commentId } });
    res.json({ message: "Comment deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete comment", error: err });
  }
};

export const checkSlug = async (req: Request, res: Response) => {
  const slug = String(req.query.slug || '').trim();
  const excludeId = String(req.query.excludeId || '').trim();
  if (!slug) return res.status(400).json({ message: "slug required" });

  const exists = await prisma.blog.findFirst({
    where: { slug, id: excludeId ? { not: excludeId } : undefined },
    select: { id: true },
  });

  res.json({ available: !exists });
};

