import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

/**
 * Stores product / banner images on local disk and serves them from /uploads.
 * For production, replace the write below with an upload to S3-compatible storage
 * (AWS S3, Cloudflare R2, DigitalOcean Spaces) and return the CDN URL.
 */
@UseGuards(AdminAuthGuard)
@AdminRoles(AdminRole.PRODUCT_MANAGER, AdminRole.MARKETING_MANAGER)
@Controller('admin/uploads')
export class UploadsController {
  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } }))
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const ext = detectImageType(file.buffer);
    if (!ext) throw new BadRequestException('Only JPG, PNG and WEBP images are allowed');
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const name = `${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;
    await fs.writeFile(join(UPLOAD_DIR, name), file.buffer);
    return { url: `${config.publicApiUrl}/uploads/${name}` };
  }
}
