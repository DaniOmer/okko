import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { PhenologicalStage, PhenologicalStageJSON } from '../../domain/crop/phenological-stage';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from './publish-crop.use-case';

export interface SetCropPhenologyInput {
  cropId: string;
  stages: PhenologicalStageJSON[];
  actor: string;
}

export class SetCropPhenologyUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetCropPhenologyInput): Promise<CropSnapshot> {
    const snap = await this.crops.findById(input.cropId);
    if (!snap) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromSnapshot(snap);
    crop.setPhenology(input.stages.map((j) => PhenologicalStage.fromJSON(j)));
    const next = crop.toSnapshot();
    await this.crops.save(next);
    await this.audit.record({
      entityType: 'Crop', entityId: crop.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { phenology: { from: snap.phenology, to: next.phenology } },
    });
    return next;
  }
}
