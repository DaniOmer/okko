import { Pest, PestSnapshot, ApprovedProductJSON } from '../../domain/pest/pest';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestRepository } from './pest.repository';
import { PestNotFoundError } from './update-pest.use-case';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export interface SetPestManagementInput {
  id: string; actor: string;
  prevention?: Record<string, string>; biologicalControl?: Record<string, string>;
  predators?: string[]; parasitoids?: string[];
  approvedProducts?: ApprovedProductJSON[]; knownResistances?: Record<string, string>;
}

export class SetPestManagementUseCase {
  constructor(
    private readonly pests: PestRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetPestManagementInput): Promise<PestSnapshot> {
    const existing = await this.pests.findById(input.id);
    if (!existing) throw new PestNotFoundError(input.id);
    const snap = Pest.fromSnapshot(existing).setManagement({
      prevention: input.prevention ? TranslatableText.create(input.prevention) : undefined,
      biologicalControl: input.biologicalControl ? TranslatableText.create(input.biologicalControl) : undefined,
      predators: input.predators,
      parasitoids: input.parasitoids,
      approvedProducts: input.approvedProducts,
      knownResistances: input.knownResistances ? TranslatableText.create(input.knownResistances) : undefined,
    }).toSnapshot();
    await this.pests.save(snap);
    await this.audit.record({
      entityType: 'Pest', entityId: snap.id, actor: input.actor,
      at: this.clock.nowIso(),
      changes: { management: { prevention: input.prevention, biologicalControl: input.biologicalControl, predators: input.predators, parasitoids: input.parasitoids, approvedProducts: input.approvedProducts, knownResistances: input.knownResistances } },
    });
    return snap;
  }
}
