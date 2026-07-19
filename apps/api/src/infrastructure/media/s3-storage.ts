import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { StoragePort, SaveImageInput } from '../../application/media/storage.port';

export class S3Storage implements StoragePort {
  private readonly client: S3Client;
  constructor(
    private readonly bucket: string,
    private readonly publicBaseUrl: string,
    opts: { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string; forcePathStyle?: boolean },
  ) {
    this.client = new S3Client({
      endpoint: opts.endpoint,
      region: opts.region,
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
      forcePathStyle: opts.forcePathStyle ?? false,
    });
  }
  async save(input: SaveImageInput): Promise<{ key: string }> {
    const key = `images/${randomUUID()}.${input.ext}`;
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: input.bytes, ContentType: input.contentType }));
    return { key };
  }
  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
  publicUrl(key: string): string { return `${this.publicBaseUrl.replace(/\/$/, '')}/${key}`; }

  static fromEnv(): S3Storage {
    return new S3Storage(
      process.env.S3_BUCKET ?? '',
      process.env.S3_PUBLIC_BASE_URL ?? '',
      {
        endpoint: process.env.S3_ENDPOINT ?? '',
        region: process.env.S3_REGION ?? 'auto',
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      },
    );
  }
}
