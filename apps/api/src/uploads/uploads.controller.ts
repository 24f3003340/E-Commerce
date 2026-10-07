import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { AdminRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { memoryStorage } from 'multer';
import { join } from 'path';
import { config } from '../common/config';
import { AdminRoles } from '../common/decorators';
import { AdminAuthGuard } from '../common/guards';

export const UPLOAD_DIR = join(process.cwd(), 'uploads');
const MAX_BYTES = 5 * 1024 * 1024;

/** Detects the real image type from magic bytes (the client-provided mimetype is not trusted). */
export function detectImageType(buf: Buffer): 'jpg' | 'png' | 'webp' | undefined {
  if (buf.length < 12) return undefined;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return undefined;
}

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

let s3: S3Client | undefined;
function s3Client() {
  s3 ??= new S3Client({
    region: config.storage.region,
    endpoint: config.storage.endpoint || undefined,
    credentials: { accessKeyId: config.storage.accessKeyId, secretAccessKey: config.storage.secretAccessKey },
    // Cloudflare R2 does not accept every newer AWS checksum header; only send them when required
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  return s3;
}

/**
 * Stores an uploaded product / banner image and returns its public URL. In production configure
 * S3-compatible storage (Cloudflare R2, AWS S3, DigitalOcean Spaces) via the S3_* variables so
 * images survive redeploys; otherwise files go to local disk and are served from /uploads
 * (development only).
 */
export async function storeImage(file?: Express.Multer.File): Promise<{ url: string }> {
  if (!file) throw new BadRequestException('No file uploaded');
  const ext = detectImageType(file.buffer);
  if (!ext) throw new BadRequestException('Only JPG, PNG and WEBP images are allowed');
  const name = `${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;
  if (config.storage.enabled) {
    const key = `uploads/${name}`;
    await s3Client().send(
      new PutObjectCommand({
        Bucket: config.storage.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: MIME[ext],
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return { url: `${config.storage.publicUrl}/${key}` };
  }
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(join(UPLOAD_DIR, name), file.buffer);
  return { url: `${config.publicApiUrl}/uploads/${name}` };
}

export const imageUpload = () =>
  UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } }));

@UseGuards(AdminAuthGuard)
@AdminRoles(AdminRole.PRODUCT_MANAGER, AdminRole.MARKETING_MANAGER)
@Controller('admin/uploads')
export class UploadsController {
  @Post()
  @imageUpload()
  upload(@UploadedFile() file?: Express.Multer.File) {
    return storeImage(file);
  }
}
