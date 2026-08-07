import { BeneficiaryRepository } from './beneficiary.repository';
import { BeneficiarySnapshot } from '../../domain/parcel/beneficiary';
import { BeneficiaryNotFoundError } from './errors';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';

export interface CreateBeneficiaryInput { organizationId: string; name: string; phone?: string; notes?: string; }
export interface UpdateBeneficiaryInput { id: string; organizationId: string; name?: string; phone?: string; notes?: string; }

export class CreateBeneficiaryUseCase {
  constructor(private readonly repo: BeneficiaryRepository, private readonly clock: Clock, private readonly ids: IdGenerator) {}
  async execute(input: CreateBeneficiaryInput): Promise<BeneficiarySnapshot> {
    const snap: BeneficiarySnapshot = {
      id: this.ids.next(), organizationId: input.organizationId, name: input.name,
      phone: input.phone, notes: input.notes, createdAt: this.clock.nowIso(),
    };
    await this.repo.save(snap);
    return snap;
  }
}

export class ListBeneficiariesUseCase {
  constructor(private readonly repo: BeneficiaryRepository) {}
  execute(input: { organizationId: string }): Promise<BeneficiarySnapshot[]> {
    return this.repo.listByOrganization(input.organizationId);
  }
}

export class UpdateBeneficiaryUseCase {
  constructor(private readonly repo: BeneficiaryRepository) {}
  async execute(input: UpdateBeneficiaryInput): Promise<BeneficiarySnapshot> {
    const existing = await this.repo.findById(input.id);
    if (!existing || existing.organizationId !== input.organizationId) throw new BeneficiaryNotFoundError(input.id);
    const snap: BeneficiarySnapshot = {
      ...existing,
      name: input.name ?? existing.name,
      phone: input.phone !== undefined ? input.phone : existing.phone,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    };
    await this.repo.save(snap);
    return snap;
  }
}

export class DeleteBeneficiaryUseCase {
  constructor(private readonly repo: BeneficiaryRepository) {}
  async execute(input: { id: string; organizationId: string }): Promise<void> {
    const existing = await this.repo.findById(input.id);
    if (!existing || existing.organizationId !== input.organizationId) throw new BeneficiaryNotFoundError(input.id);
    await this.repo.delete(input.id);
  }
}
