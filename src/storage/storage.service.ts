import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';
import { SignedUploadUrlResponse } from './dto/signed-upload-url.dto';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly storage: Storage;
  private readonly bucketName: string;

  private static readonly SIGNED_URL_TTL_MS = 15 * 60 * 1000; // 15 minutes

  constructor(config: ConfigService) {
    const projectId = config.get<string>('GCS_PROJECT_ID');
    const clientEmail = config.get<string>('GCS_CLIENT_EMAIL');
    const privateKey = config
      .get<string>('GCS_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    this.storage = new Storage({
      projectId,
      credentials:
        clientEmail && privateKey
          ? { client_email: clientEmail, private_key: privateKey }
          : undefined,
    });

    this.bucketName =
      config.get<string>('GCS_BUCKET_NAME') ?? 'silomis_local';

    this.logger.log(`Storage bucket: ${this.bucketName}`);
  }

  async signedUploadUrl(params: {
    folder: string;
    fileName: string;
    contentType: string;
    userId: string;
  }): Promise<SignedUploadUrlResponse> {
    const ext = params.fileName.split('.').pop()?.toLowerCase() ?? 'jpg';
    const key = `${params.folder}/${params.userId}/${Date.now()}-${randomUUID()}.${ext}`;

    const file = this.storage.bucket(this.bucketName).file(key);
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + StorageService.SIGNED_URL_TTL_MS,
      contentType: params.contentType,
    });

    const publicUrl = this.publicUrl(key);
    this.logger.debug(`Signed upload URL generated: ${key}`);
    return { uploadUrl, publicUrl, key };
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.storage.bucket(this.bucketName).file(key).delete();
      this.logger.log(`Deleted object: ${key}`);
    } catch (err) {
      this.logger.warn(`Could not delete object ${key}: ${err}`);
    }
  }

  publicUrl(key: string): string {
    return `https://storage.googleapis.com/${this.bucketName}/${key}`;
  }
}
