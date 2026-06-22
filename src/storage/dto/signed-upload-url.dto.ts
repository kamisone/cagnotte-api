import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const SignedUploadUrlSchema = z.object({
  folder: z.enum(['receipts', 'avatars', 'reports']).default('receipts'),
  fileName: z.string().min(1).max(255),
  contentType: z.string().regex(
    /^image\/(jpeg|png|webp|heic|heif)$/,
    'Content-type must be an image (jpeg, png, webp, heic)',
  ),
});

export class SignedUploadUrlDto extends createZodDto(SignedUploadUrlSchema) {}

export interface SignedUploadUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}
