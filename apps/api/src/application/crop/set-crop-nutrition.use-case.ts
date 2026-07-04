import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { NutrientRequirement, NutrientRequirementJSON } from '../../domain/crop/nutrient-requirement';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from './publish-crop.use-case';

export interface SetCropNutritionInput {
  cropId: string;
  requirements: NutrientRequirementJSON[];
  actor: string;
}

export class SetCropNutritionUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetCropNutritionInput): Promise<CropSnapshot> {
    const snap = await this.crops.findById(input.cropId);
    if (!snap) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromSnapshot(snap);
    crop.setNutrition(input.requirements.map((j) => NutrientRequirement.fromJSON(j)));
    const next = crop.toSnapshot();
    await this.crops.save(next);
    await this.audit.record({
      entityType: 'Crop', entityId: crop.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { nutrition: { from: snap.nutrition, to: next.nutrition } },
    });
    return next;
  }
}
