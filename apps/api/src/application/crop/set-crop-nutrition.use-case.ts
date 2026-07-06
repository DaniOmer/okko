import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { NutrientRequirement, NutrientRequirementJSON } from '../../domain/crop/nutrient-requirement';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropEventStore } from './crop-event-store';
import { CropNotFoundError } from './publish-crop.use-case';

export interface SetCropNutritionInput {
  cropId: string;
  requirements: NutrientRequirementJSON[];
  actor: string;
}

export class SetCropNutritionUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetCropNutritionInput): Promise<CropSnapshot> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromEvents(stored);
    const before = crop.toSnapshot();
    crop.setNutrition(input.requirements.map((j) => NutrientRequirement.fromJSON(j)));
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    const next = crop.toSnapshot();
    await this.crops.save(next);
    await this.audit.record({
      entityType: 'Crop', entityId: crop.id, actor: input.actor, at,
      changes: { nutrition: { from: before.nutrition, to: next.nutrition } },
    });
    return next;
  }
}
