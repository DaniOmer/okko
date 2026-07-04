import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { YieldReference, YieldReferenceJSON } from '../../domain/crop/yield-reference';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from './publish-crop.use-case';

export interface SetCropYieldsInput {
  cropId: string;
  yields: YieldReferenceJSON[];
  actor: string;
}

export class SetCropYieldsUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetCropYieldsInput): Promise<CropSnapshot> {
    const snap = await this.crops.findById(input.cropId);
    if (!snap) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromSnapshot(snap);
    crop.setYields(input.yields.map((j) => YieldReference.fromJSON(j)));
    const next = crop.toSnapshot();
    await this.crops.save(next);
    await this.audit.record({
      entityType: 'Crop', entityId: crop.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { yields: { from: snap.yields, to: next.yields } },
    });
    return next;
  }
}
