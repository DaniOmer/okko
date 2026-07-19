import { randomUUID } from 'crypto';
import { StoragePort, SaveImageInput } from './storage.port';

export class InMemoryStorage implements StoragePort {
  readonly objects = new Map<string, { bytes: Buffer; contentType: string }>();
  async save(input: SaveImageInput): Promise<{ key: string }> {
    const key = `images/${randomUUID()}.${input.ext}`;
    this.objects.set(key, { bytes: input.bytes, contentType: input.contentType });
    return { key };
  }
  async remove(key: string): Promise<void> { this.objects.delete(key); }
  publicUrl(key: string): string { return `memory://${key}`; }
}
