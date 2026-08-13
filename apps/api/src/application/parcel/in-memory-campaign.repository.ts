import { CampaignRepository } from './campaign.repository';
import { CampaignSnapshot } from '../../domain/parcel/campaign';

export class InMemoryCampaignRepository implements CampaignRepository {
  private store = new Map<string, CampaignSnapshot>();
  async save(c: CampaignSnapshot): Promise<void> { this.store.set(c.id, c); }
  async findById(id: string): Promise<CampaignSnapshot | null> { return this.store.get(id) ?? null; }
  async listByParcel(organizationId: string, parcelId: string): Promise<CampaignSnapshot[]> {
    return [...this.store.values()].filter((c) => c.organizationId === organizationId && c.parcelId === parcelId);
  }
  async listActive(): Promise<CampaignSnapshot[]> { return [...this.store.values()].filter((c) => c.status === 'ACTIVE'); }
  async delete(id: string): Promise<void> { this.store.delete(id); }
}
