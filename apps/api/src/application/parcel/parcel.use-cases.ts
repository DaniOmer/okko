import { ParcelRepository } from './parcel.repository';
import { BeneficiaryRepository } from './beneficiary.repository';
import { ParcelSnapshot } from '../../domain/parcel/parcel';
import { ParcelNotFoundError, BeneficiaryNotFoundError } from './errors';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';

export interface CreateParcelInput {
  organizationId: string; name: string; beneficiaryId?: string; zoneId?: string;
  gpsLat?: number; gpsLng?: number; locality?: string; areaHectares?: number; notes?: string;
}
export interface UpdateParcelInput extends Partial<CreateParcelInput> { id: string; organizationId: string; }

export class CreateParcelUseCase {
  constructor(private readonly repo: ParcelRepository, private readonly beneficiaries: BeneficiaryRepository, private readonly clock: Clock, private readonly ids: IdGenerator) {}
  async execute(input: CreateParcelInput): Promise<ParcelSnapshot> {
    if (input.beneficiaryId) {
      const b = await this.beneficiaries.findById(input.beneficiaryId);
      if (!b || b.organizationId !== input.organizationId) throw new BeneficiaryNotFoundError(input.beneficiaryId);
    }
    const snap: ParcelSnapshot = {
      id: this.ids.next(), organizationId: input.organizationId, name: input.name,
      beneficiaryId: input.beneficiaryId, zoneId: input.zoneId, gpsLat: input.gpsLat, gpsLng: input.gpsLng,
      locality: input.locality, areaHectares: input.areaHectares, notes: input.notes, createdAt: this.clock.nowIso(),
    };
    await this.repo.save(snap);
    return snap;
  }
}

export class ListParcelsUseCase {
  constructor(private readonly repo: ParcelRepository) {}
  execute(input: { organizationId: string }): Promise<ParcelSnapshot[]> { return this.repo.listByOrganization(input.organizationId); }
}

const keep = <T>(v: T | undefined, cur: T): T => (v !== undefined ? v : cur);

export class UpdateParcelUseCase {
  constructor(private readonly repo: ParcelRepository) {}
  async execute(input: UpdateParcelInput): Promise<ParcelSnapshot> {
    const existing = await this.repo.findById(input.id);
    if (!existing || existing.organizationId !== input.organizationId) throw new ParcelNotFoundError(input.id);
    const snap: ParcelSnapshot = {
      ...existing,
      name: input.name ?? existing.name,
      beneficiaryId: keep(input.beneficiaryId, existing.beneficiaryId),
      zoneId: keep(input.zoneId, existing.zoneId),
      gpsLat: keep(input.gpsLat, existing.gpsLat),
      gpsLng: keep(input.gpsLng, existing.gpsLng),
      locality: keep(input.locality, existing.locality),
      areaHectares: keep(input.areaHectares, existing.areaHectares),
      notes: keep(input.notes, existing.notes),
    };
    await this.repo.save(snap);
    return snap;
  }
}

export class DeleteParcelUseCase {
  constructor(private readonly repo: ParcelRepository) {}
  async execute(input: { id: string; organizationId: string }): Promise<void> {
    const existing = await this.repo.findById(input.id);
    if (!existing || existing.organizationId !== input.organizationId) throw new ParcelNotFoundError(input.id);
    await this.repo.delete(input.id);
  }
}
