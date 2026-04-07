//backend/src/controllers/tagCategory.ts

import { Request, Response } from "express";
import prisma from "../utils/prisma";

const normQuery = (req: any) => {
  const raw = (req.query?.q ?? req.query?.search ?? "").toString();
  return raw.trim();
};

/* --------------------------
   TAGS
   -------------------------- */

// GET /api/blogs/tags/all
export const listTags = async (req: Request, res: Response) => {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });
    res.json(tags);
  } catch (err) {
    res.status(500).json({ message: "Failed to list tags", error: err });
  }
};

// POST /api/blogs/tags
export const createTag = async (req: Request, res: Response) => {
  try {
    const { name } = req.body as { name?: string };
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Tag name is required" });
    }

    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const created = await prisma.tag.create({
      data: { name: name.trim(), slug },
    });

    res.status(201).json(created);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "Tag already exists" });
    }
    res.status(500).json({ message: "Failed to create tag", error: err });
  }
};

// DELETE /api/blogs/tags/:id
export const deleteTag = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.tag.delete({ where: { id } });
    res.json({ message: "Tag deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete tag", error: err });
  }
};

// POST /api/blogs/:id/tags/:tagId
export const attachTagToBlog = async (req: Request, res: Response) => {
  try {
    const { id, tagId } = req.params;

    await prisma.blogTag.create({
      data: { blogId: id, tagId },
    });

    res.json({ message: "Tag attached to blog" });
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "Tag already linked to blog" });
    }
    res.status(500).json({ message: "Failed to attach tag", error: err });
  }
};

// DELETE /api/blogs/:id/tags/:tagId
export const detachTagFromBlog = async (req: Request, res: Response) => {
  try {
    const { id, tagId } = req.params;

    await prisma.blogTag.delete({
      where: { blogId_tagId: { blogId: id, tagId } },
    });

    res.json({ message: "Tag detached from blog" });
  } catch (err) {
    res.status(500).json({ message: "Failed to detach tag", error: err });
  }
};

/* --------------------------
   CATEGORIES
   -------------------------- */

// GET /api/blogs/categories/all
export const listCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: "Failed to list categories", error: err });
  }
};

// POST /api/blogs/categories
export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name } = req.body as { name?: string };
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const created = await prisma.category.create({
      data: { name: name.trim(), slug },
    });

    res.status(201).json(created);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "Category already exists" });
    }
    res.status(500).json({ message: "Failed to create category", error: err });
  }
};

// DELETE /api/blogs/categories/:id
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.category.delete({ where: { id } });
    res.json({ message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete category", error: err });
  }
};

// POST /api/blogs/:id/categories/:categoryId
export const attachCategoryToBlog = async (req: Request, res: Response) => {
  try {
    const { id, categoryId } = req.params;

    await prisma.blogCategory.create({
      data: { blogId: id, categoryId },
    });

    res.json({ message: "Category attached to blog" });
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "Category already linked to blog" });
    }
    res.status(500).json({ message: "Failed to attach category", error: err });
  }
};

// DELETE /api/blogs/:id/categories/:categoryId
export const detachCategoryFromBlog = async (req: Request, res: Response) => {
  try {
    const { id, categoryId } = req.params;

    await prisma.blogCategory.delete({
      where: { blogId_categoryId: { blogId: id, categoryId } },
    });

    res.json({ message: "Category detached from blog" });
  } catch (err) {
    res.status(500).json({ message: "Failed to detach category", error: err });
  }
};


//GET /api/blogs/tags?search=xxx
export const searchTags = async (req: Request, res: Response) => {
  try {
    const q = normQuery(req);
    const take = Math.min(Number(req.query?.limit) || 20, 50);

    const tags = await prisma.tag.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
      take,
      select: { id: true, name: true },
    });

    res.json(tags);
  } catch (err) {
    res.status(500).json({ message: "Failed to search tags", error: err });
  }
};

// POST /api/blogs/:id/tags
export const createAndAttachTag = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // blogId
    const { name } = req.body as { name?: string };
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Tag name is required" });
    }

    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    let tag = await prisma.tag.findUnique({ where: { slug } });
    if (!tag) {
      tag = await prisma.tag.create({ data: { name: name.trim(), slug } });
    }

    await prisma.blogTag.create({ data: { blogId: id, tagId: tag.id } });

    res.status(201).json(tag);
  } catch (err: any) {
    if (err.code === "P2002") {
      return res.status(400).json({ message: "Tag already attached" });
    }
    res.status(500).json({ message: "Failed to create/attach tag", error: err });
  }
};

// GET /api/blogs/categories?search=xxx
export const searchCategories = async (req: Request, res: Response) => {
  try {
    const q = normQuery(req);
    const take = Math.min(Number(req.query?.limit) || 20, 50);

    const cats = await prisma.category.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { name: "asc" },
      take,
      select: { id: true, name: true },
    });

    res.json(cats);
  } catch (err) {
    res.status(500).json({ message: "Failed to search categories", error: err });
  }
};

// POST /api/blogs/:id/categories/new
export const createAndAttachCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // blogId
    const { name } = req.body as { name?: string };

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    // Check if category already exists (case-insensitive)
    let category = await prisma.category.findFirst({
      where: { slug },
    });

    if (!category) {
      category = await prisma.category.create({
        data: { name: name.trim(), slug },
      });
    }

    // Attach category to blog (ignore duplicates)
    try {
      await prisma.blogCategory.create({
        data: { blogId: id, categoryId: category.id },
      });
    } catch (err: any) {
      if (err.code === "P2002") {
        // Unique constraint violation → already attached
        return res.json(category);
      }
      throw err;
    }

    res.status(201).json(category);
  } catch (err) {
    res.status(500).json({ message: "Failed to create/attach category", error: err });
  }
};

// PATCH /api/blogs/tags/:id
export const updateTag = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body as { name?: string };
    if (!name || !name.trim()) return res.status(400).json({ message: "Name required" });

    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const updated = await prisma.tag.update({
      where: { id },
      data: { name: name.trim(), slug },
      select: { id: true, name: true, slug: true },
    });

    res.json(updated);
  } catch (err: any) {
    if (err.code === "P2002") return res.status(400).json({ message: "Tag already exists" });
    res.status(500).json({ message: "Failed to update tag", error: err });
  }
};

// PATCH /api/blogs/categories/:id
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body as { name?: string };
    if (!name || !name.trim()) return res.status(400).json({ message: "Name required" });

    const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    const updated = await prisma.category.update({
      where: { id },
      data: { name: name.trim(), slug },
      select: { id: true, name: true, slug: true },
    });

    res.json(updated);
  } catch (err: any) {
    if (err.code === "P2002") return res.status(400).json({ message: "Category already exists" });
    res.status(500).json({ message: "Failed to update category", error: err });
  }
};


