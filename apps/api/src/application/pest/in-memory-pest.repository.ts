import { PestRepository } from './pest.repository';
import { PestSnapshot } from '../../domain/pest/pest';

export class InMemoryPestRepository implements PestRepository {
  private store = new Map<string, PestSnapshot>();
  async save(p: PestSnapshot): Promise<void> { this.store.set(p.id, p); }
  async findById(id: string): Promise<PestSnapshot | null> { return this.store.get(id) ?? null; }
  async list(): Promise<PestSnapshot[]> { return [...this.store.values()]; }
  async delete(id: string): Promise<void> { this.store.delete(id); }
}
