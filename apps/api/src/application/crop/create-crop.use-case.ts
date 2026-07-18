import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { CycleType } from '../../domain/crop/cycle-type';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropEventStore } from './crop-event-store';

export interface CreateCropInput {
  id: string;
  commonNames: Record<string, string>;
  scientificName: string;
  family: string;
  cycleType: CycleType;
  usageCategory?: string;
  description?: Record<string, string>;
  actor: string;
}

export class CreateCropUseCase {
  constructor(
    private readonly events: CropEventStore,
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
      usageCategory: input.usageCategory,
      description: input.description,
    });
    const at = this.clock.nowIso();
    await this.events.append(input.id, 0, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    const snapshot = crop.toSnapshot();
    await this.crops.save(snapshot);
    await this.audit.record({
      entityType: 'Crop',
      entityId: crop.id,
      actor: input.actor,
      at,
      changes: { created: snapshot },
    });
    return snapshot;
  }
}
