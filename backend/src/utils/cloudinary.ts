import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
  secure: true,
});

export type CloudinaryUploadResult = {
  url: string;
  public_id: string;
  width?: number;
  height?: number;
};

export async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder = process.env.CLOUDINARY_UPLOAD_FOLDER || "cribspot-kenya"
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image", overwrite: false },
      (err, result) => {
        if (err || !result) return reject(err);
        resolve({
          url: result.secure_url,
          public_id: result.public_id,
          width: result.width,
          height: result.height,
        });
      }
    );
    stream.end(buffer);
  });
}

export default cloudinary;