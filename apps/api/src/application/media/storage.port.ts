export const STORAGE_PORT = Symbol('STORAGE_PORT');
export interface SaveImageInput { bytes: Buffer; contentType: string; ext: string; }
export interface StoragePort {
  save(input: SaveImageInput): Promise<{ key: string }>;
  remove(key: string): Promise<void>;
  publicUrl(key: string): string;
}
