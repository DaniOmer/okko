import { OperationLogRepository } from './operation-log.repository';
import { OperationLogSnapshot } from '../../domain/parcel/operation-log';

export class InMemoryOperationLogRepository implements OperationLogRepository {
  private store = new Map<string, OperationLogSnapshot>();
  async save(o: OperationLogSnapshot): Promise<void> { this.store.set(o.id, o); }
  async findById(id: string): Promise<OperationLogSnapshot | null> { return this.store.get(id) ?? null; }
  async listByCampaign(organizationId: string, campaignId: string): Promise<OperationLogSnapshot[]> {
    return [...this.store.values()].filter((o) => o.organizationId === organizationId && o.campaignId === campaignId);
  }
  async delete(id: string): Promise<void> { this.store.delete(id); }
}
