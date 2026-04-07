import { z } from "zod";

export const blogCreateSchema = z.object({
  title: z.string().min(4).max(150),
  content: z.string().min(20),
  coverImage: z.string().url().optional(),
  published: z.boolean().optional(),
});

export const blogUpdateSchema = z.object({
  title: z.string().min(4).max(150).optional(),
  content: z.string().min(20).optional(),
  coverImage: z.string().url().optional(),
  published: z.boolean().optional(),
});

export const commentCreateSchema = z.object({
  content: z.string().min(2).max(1500),
});