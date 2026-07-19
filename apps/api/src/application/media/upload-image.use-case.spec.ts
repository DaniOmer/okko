import { UploadImageUseCase, UnsupportedImageTypeError, ImageTooLargeError } from './upload-image.use-case';
import { InMemoryStorage } from './in-memory-storage';

describe('UploadImageUseCase', () => {
  it('accepte jpeg/png/webp et stocke → clé', async () => {
    const storage = new InMemoryStorage();
    const out = await new UploadImageUseCase(storage).execute({ bytes: Buffer.from('x'), contentType: 'image/png', actor: 'a' });
    expect(out.key).toMatch(/^images\/.+\.png$/);
    expect(storage.objects.has(out.key)).toBe(true);
  });
  it('rejette un type non supporté', async () => {
    await expect(new UploadImageUseCase(new InMemoryStorage()).execute({ bytes: Buffer.from('x'), contentType: 'application/pdf', actor: 'a' }))
      .rejects.toThrow(UnsupportedImageTypeError);
  });
  it('rejette > 5 Mo', async () => {
    await expect(new UploadImageUseCase(new InMemoryStorage()).execute({ bytes: Buffer.alloc(5 * 1024 * 1024 + 1), contentType: 'image/jpeg', actor: 'a' }))
      .rejects.toThrow(ImageTooLargeError);
  });
});
