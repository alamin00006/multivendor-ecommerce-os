import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { env } from '../../config/env.js';

/** S3-compatible object storage (MinIO locally). */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger('Storage');
  private readonly s3 = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  });

  /** Creates the bucket with public-read on first start (idempotent). */
  async onModuleInit(): Promise<void> {
    if (env.NODE_ENV === 'test') return;
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
        await this.s3.send(
          new PutBucketPolicyCommand({
            Bucket: env.S3_BUCKET,
            Policy: JSON.stringify({
              Version: '2012-10-17',
              Statement: [
                {
                  Effect: 'Allow',
                  Principal: { AWS: ['*'] },
                  Action: ['s3:GetObject'],
                  Resource: [`arn:aws:s3:::${env.S3_BUCKET}/*`],
                },
              ],
            }),
          }),
        );
        this.logger.log(`Created public-read bucket "${env.S3_BUCKET}"`);
      } catch (error) {
        this.logger.warn(`Object storage unavailable: ${String(error)}. Uploads will fail until it is reachable.`);
      }
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return `${env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  }
}
