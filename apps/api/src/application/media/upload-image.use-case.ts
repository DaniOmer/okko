import { StoragePort } from './storage.port';

const ALLOWED: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 5 * 1024 * 1024;

export class UnsupportedImageTypeError extends Error {
  constructor(t: string) { super(`Type d'image non supporté : ${t}`); this.name = 'UnsupportedImageTypeError'; }
}
export class ImageTooLargeError extends Error {
  constructor() { super('Image supérieure à 5 Mo'); this.name = 'ImageTooLargeError'; }
}

export interface UploadImageInput { bytes: Buffer; contentType: string; actor: string; }

export class UploadImageUseCase {
  constructor(private readonly storage: StoragePort) {}
  async execute(input: UploadImageInput): Promise<{ key: string }> {
    const ext = ALLOWED[input.contentType];
    if (!ext) throw new UnsupportedImageTypeError(input.contentType);
    if (input.bytes.length > MAX_BYTES) throw new ImageTooLargeError();
    return this.storage.save({ bytes: input.bytes, contentType: input.contentType, ext });
  }
}
