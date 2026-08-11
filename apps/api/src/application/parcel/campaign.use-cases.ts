import { CampaignRepository } from './campaign.repository';
import { ParcelRepository } from './parcel.repository';
import { CampaignSnapshot } from '../../domain/parcel/campaign';
import { CampaignNotFoundError, ParcelNotFoundError } from './errors';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';

export interface CreateCampaignInput {
  organizationId: string; parcelId: string; cropId: string; varietyId?: string;
  season: string; startDate?: string; status?: 'ACTIVE' | 'CLOSED'; notes?: string;
}
export interface UpdateCampaignInput {
  id: string; organizationId: string; cropId?: string; varietyId?: string;
  season?: string; startDate?: string; status?: 'ACTIVE' | 'CLOSED'; notes?: string;
}

const keep = <T>(v: T | undefined, cur: T): T => (v !== undefined ? v : cur);

export class CreateCampaignUseCase {
  constructor(private readonly repo: CampaignRepository, private readonly parcels: ParcelRepository, private readonly clock: Clock, private readonly ids: IdGenerator) {}
  async execute(input: CreateCampaignInput): Promise<CampaignSnapshot> {
    const parcel = await this.parcels.findById(input.parcelId);
    if (!parcel || parcel.organizationId !== input.organizationId) throw new ParcelNotFoundError(input.parcelId);
    const snap: CampaignSnapshot = {
      id: this.ids.next(), organizationId: input.organizationId, parcelId: input.parcelId,
      cropId: input.cropId, varietyId: input.varietyId, season: input.season,
      startDate: input.startDate, status: input.status ?? 'ACTIVE', notes: input.notes, createdAt: this.clock.nowIso(),
    };
    await this.repo.save(snap);
    return snap;
  }
}

export class ListCampaignsByParcelUseCase {
  constructor(private readonly repo: CampaignRepository) {}
  execute(input: { organizationId: string; parcelId: string }): Promise<CampaignSnapshot[]> {
    return this.repo.listByParcel(input.organizationId, input.parcelId);
  }
}

export class UpdateCampaignUseCase {
  constructor(private readonly repo: CampaignRepository) {}
  async execute(input: UpdateCampaignInput): Promise<CampaignSnapshot> {
    const existing = await this.repo.findById(input.id);
    if (!existing || existing.organizationId !== input.organizationId) throw new CampaignNotFoundError(input.id);
    const snap: CampaignSnapshot = {
      ...existing,
      cropId: keep(input.cropId, existing.cropId), varietyId: keep(input.varietyId, existing.varietyId),
      season: keep(input.season, existing.season), startDate: keep(input.startDate, existing.startDate),
      status: keep(input.status, existing.status), notes: keep(input.notes, existing.notes),
    };
    await this.repo.save(snap);
    return snap;
  }
}

export class DeleteCampaignUseCase {
  constructor(private readonly repo: CampaignRepository) {}
  async execute(input: { id: string; organizationId: string }): Promise<void> {
    const existing = await this.repo.findById(input.id);
    if (!existing || existing.organizationId !== input.organizationId) throw new CampaignNotFoundError(input.id);
    await this.repo.delete(input.id);
  }
}
