import { CampaignSnapshot } from '../../domain/parcel/campaign';

export const CAMPAIGN_REPOSITORY = Symbol('CAMPAIGN_REPOSITORY');

export interface CampaignRepository {
  save(c: CampaignSnapshot): Promise<void>;
  findById(id: string): Promise<CampaignSnapshot | null>;
  listByParcel(organizationId: string, parcelId: string): Promise<CampaignSnapshot[]>;
  listActive(): Promise<CampaignSnapshot[]>;
  delete(id: string): Promise<void>;
}
