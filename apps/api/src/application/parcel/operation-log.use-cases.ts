import { OperationLogRepository } from './operation-log.repository';
import { CampaignRepository } from './campaign.repository';
import { OperationLogSnapshot, OperationInput } from '../../domain/parcel/operation-log';
import { OperationType } from '../../domain/window/operation-type';
import { OperationLogNotFoundError, CampaignNotFoundError } from './errors';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';

export interface CreateOperationLogInput {
  organizationId: string; campaignId: string; type: OperationType; date: string;
  inputs?: OperationInput[]; laborCost?: number; notes?: string; recordedByUserId: string;
}
export interface UpdateOperationLogInput {
  id: string; organizationId: string; type?: OperationType; date?: string;
  inputs?: OperationInput[]; laborCost?: number; notes?: string;
}

const keep = <T>(v: T | undefined, cur: T): T => (v !== undefined ? v : cur);

export class CreateOperationLogUseCase {
  constructor(private readonly repo: OperationLogRepository, private readonly campaigns: CampaignRepository, private readonly clock: Clock, private readonly ids: IdGenerator) {}
  async execute(input: CreateOperationLogInput): Promise<OperationLogSnapshot> {
    const campaign = await this.campaigns.findById(input.campaignId);
    if (!campaign || campaign.organizationId !== input.organizationId) throw new CampaignNotFoundError(input.campaignId);
    const snap: OperationLogSnapshot = {
      id: this.ids.next(), organizationId: input.organizationId, campaignId: input.campaignId,
      type: input.type, date: input.date, inputs: input.inputs ?? [], laborCost: input.laborCost,
      notes: input.notes, recordedByUserId: input.recordedByUserId, createdAt: this.clock.nowIso(),
    };
    await this.repo.save(snap);
    return snap;
  }
}

export class ListOperationsByCampaignUseCase {
  constructor(private readonly repo: OperationLogRepository) {}
  execute(input: { organizationId: string; campaignId: string }): Promise<OperationLogSnapshot[]> {
    return this.repo.listByCampaign(input.organizationId, input.campaignId);
  }
}

export class UpdateOperationLogUseCase {
  constructor(private readonly repo: OperationLogRepository) {}
  async execute(input: UpdateOperationLogInput): Promise<OperationLogSnapshot> {
    const existing = await this.repo.findById(input.id);
    if (!existing || existing.organizationId !== input.organizationId) throw new OperationLogNotFoundError(input.id);
    const snap: OperationLogSnapshot = {
      ...existing,
      type: keep(input.type, existing.type), date: keep(input.date, existing.date),
      inputs: keep(input.inputs, existing.inputs), laborCost: keep(input.laborCost, existing.laborCost),
      notes: keep(input.notes, existing.notes),
    };
    await this.repo.save(snap);
    return snap;
  }
}

export class DeleteOperationLogUseCase {
  constructor(private readonly repo: OperationLogRepository) {}
  async execute(input: { id: string; organizationId: string }): Promise<void> {
    const existing = await this.repo.findById(input.id);
    if (!existing || existing.organizationId !== input.organizationId) throw new OperationLogNotFoundError(input.id);
    await this.repo.delete(input.id);
  }
}
