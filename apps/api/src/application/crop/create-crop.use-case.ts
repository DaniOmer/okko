import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { CycleType } from '../../domain/crop/cycle-type';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export interface CreateCropInput {
  id: string;
  commonNames: Record<string, string>;
  scientificName: string;
  family: string;
  cycleType: CycleType;
  actor: string;
}

export class CreateCropUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: CreateCropInput): Promise<CropSnapshot> {
    const crop = Crop.create({
      id: input.id,
      commonNames: TranslatableText.create(input.commonNames),
      scientificName: input.scientificName,
      family: input.family,
      cycleType: input.cycleType,
    });
    const snapshot = crop.toSnapshot();
    await this.crops.save(snapshot);
    await this.audit.record({
      entityType: 'Crop',
      entityId: crop.id,
      actor: input.actor,
      at: this.clock.nowIso(),
      changes: { created: snapshot },
    });
    return snapshot;
  }
}
