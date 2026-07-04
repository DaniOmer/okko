import { PestRepository } from './pest.repository';
import { PestDiseaseSnapshot } from '../../domain/pest/pest-disease';

export class InMemoryPestRepository implements PestRepository {
  private store = new Map<string, PestDiseaseSnapshot>();
  async save(p: PestDiseaseSnapshot): Promise<void> { this.store.set(p.id, p); }
  async findById(id: string): Promise<PestDiseaseSnapshot | null> { return this.store.get(id) ?? null; }
  async list(): Promise<PestDiseaseSnapshot[]> { return [...this.store.values()]; }
}
