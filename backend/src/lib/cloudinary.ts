import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import multer from 'multer';
import { cloudinaryEnabled, env } from '../config/env';
import { badRequest, HttpError } from './errors';

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Multer keeps uploads in memory; we stream them to Cloudinary ourselves. */
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(badRequest('Only JPG, PNG or WEBP images are allowed'));
  },
});

export async function uploadImage(
  buffer: Buffer,
  folder: string,
): Promise<{ url: string; publicId: string }> {
  if (!cloudinaryEnabled) {
    throw new HttpError(503, 'Image uploads are not configured (set CLOUDINARY_* env vars)');
  }
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: `online-shops/${folder}`,
          transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
        },
        (err, res) => (err || !res ? reject(err ?? new Error('Upload failed')) : resolve(res)),
      )
      .end(buffer);
  });
  return { url: result.secure_url, publicId: result.public_id };
}

/** Best-effort delete; never fails the request. */
export async function deleteImage(publicId: string | null | undefined): Promise<void> {
  if (!publicId || !cloudinaryEnabled) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn('Cloudinary delete failed for', publicId, err);
  }
}
