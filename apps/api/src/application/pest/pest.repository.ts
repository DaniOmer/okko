import { PestDiseaseSnapshot } from '../../domain/pest/pest-disease';

export const PEST_REPOSITORY = Symbol('PEST_REPOSITORY');

export interface PestRepository {
  save(p: PestDiseaseSnapshot): Promise<void>;
  findById(id: string): Promise<PestDiseaseSnapshot | null>;
  list(): Promise<PestDiseaseSnapshot[]>;
  delete(id: string): Promise<void>;
}
