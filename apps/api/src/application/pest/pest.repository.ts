import { PestSnapshot } from '../../domain/pest/pest';

export const PEST_REPOSITORY = Symbol('PEST_REPOSITORY');

export interface PestRepository {
  save(p: PestSnapshot): Promise<void>;
  findById(id: string): Promise<PestSnapshot | null>;
  list(): Promise<PestSnapshot[]>;
  delete(id: string): Promise<void>;
}
