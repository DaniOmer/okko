import { ParcelRepository } from './parcel.repository';
import { ParcelSnapshot } from '../../domain/parcel/parcel';

export class InMemoryParcelRepository implements ParcelRepository {
  private store = new Map<string, ParcelSnapshot>();
  async save(p: ParcelSnapshot): Promise<void> { this.store.set(p.id, p); }
  async findById(id: string): Promise<ParcelSnapshot | null> { return this.store.get(id) ?? null; }
  async listByOrganization(organizationId: string): Promise<ParcelSnapshot[]> {
    return [...this.store.values()].filter((p) => p.organizationId === organizationId);
  }
  async delete(id: string): Promise<void> { this.store.delete(id); }
}
