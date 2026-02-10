// src/controllers/upload.controller.ts
import { Request, Response } from "express";
import { uploadBufferToCloudinary } from "../utils/cloudinary";
import path from "path";
import fs from "fs";

export const uploadSingleImage = async (req: Request, res: Response) => {
  try {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    const uploaded = await uploadBufferToCloudinary(file.buffer);
    return res.status(201).json(uploaded);
  } catch (err) {
    return res.status(500).json({ message: "Upload failed", error: err });
  }
};

export const uploadMultipleImages = async (req: Request, res: Response) => {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) return res.status(400).json({ message: "No files uploaded" });

    const results = await Promise.all(files.map(f => uploadBufferToCloudinary(f.buffer)));
    return res.status(201).json({ count: results.length, items: results });
  } catch (err) {
    return res.status(500).json({ message: "Bulk upload failed", error: err });
  }
};

export const uploadBlogImage = (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // save in /uploads/blogs
    const fileUrl = `/uploads/blogs/${req.file.filename}`;

    return res.status(201).json({
      url: fileUrl,
      filename: req.file.filename,
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to upload blog image", error: err });
  }
};