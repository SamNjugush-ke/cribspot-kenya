//backend/src/controllers/blogRelations.controller
import { Request, Response } from "express";
import prisma from "../utils/prisma";

/* ----------- TAGS ----------- */

// GET /api/blogs/:id/tags
export const getBlogTags = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const blog = await prisma.blog.findUnique({
      where: { id },
      include: {
        tags: { include: { tag: true } },
      },
    });
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    res.json(blog.tags.map((bt) => bt.tag));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch tags", error: err });
  }
};

// POST /api/blogs/:id/tags (link tags by IDs)
export const addBlogTags = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tagIds } = req.body as { tagIds: string[] };

    await prisma.blogTag.deleteMany({ where: { blogId: id } }); // reset
    await prisma.blogTag.createMany({
      data: tagIds.map((tagId) => ({ blogId: id, tagId })),
    });

    const updated = await prisma.blog.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } } },
    });
    res.json(updated?.tags.map((bt) => bt.tag));
  } catch (err) {
    res.status(500).json({ message: "Failed to update tags", error: err });
  }
};

/* ----------- CATEGORIES ----------- */

// GET /api/blogs/:id/categories
export const getBlogCategories = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const blog = await prisma.blog.findUnique({
      where: { id },
      include: {
        categories: { include: { category: true } },
      },
    });
    if (!blog) return res.status(404).json({ message: "Blog not found" });
    res.json(blog.categories.map((bc) => bc.category));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch categories", error: err });
  }
};

// POST /api/blogs/:id/categories (link categories by IDs)
export const addBlogCategories = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { categoryIds } = req.body as { categoryIds: string[] };

    await prisma.blogCategory.deleteMany({ where: { blogId: id } }); // reset
    await prisma.blogCategory.createMany({
      data: categoryIds.map((categoryId) => ({ blogId: id, categoryId })),
    });

    const updated = await prisma.blog.findUnique({
      where: { id },
      include: { categories: { include: { category: true } } },
    });
    res.json(updated?.categories.map((bc) => bc.category));
  } catch (err) {
    res.status(500).json({ message: "Failed to update categories", error: err });
  }
};
