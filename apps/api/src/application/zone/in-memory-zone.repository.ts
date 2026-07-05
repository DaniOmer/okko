import { ZoneRepository } from './zone.repository';
import { ZoneSnapshot } from '../../domain/zone/agro-ecological-zone';

export class InMemoryZoneRepository implements ZoneRepository {
  private store = new Map<string, ZoneSnapshot>();
  async save(z: ZoneSnapshot): Promise<void> { this.store.set(z.id, z); }
  async findById(id: string): Promise<ZoneSnapshot | null> { return this.store.get(id) ?? null; }
  async list(): Promise<ZoneSnapshot[]> { return [...this.store.values()]; }
  async delete(id: string): Promise<void> { this.store.delete(id); }
}
