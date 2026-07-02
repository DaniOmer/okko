import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export class CropNotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'CropNotFoundError';
  }
}

export class PublishCropUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { id: string; actor: string }): Promise<CropSnapshot> {
    const snap = await this.crops.findById(input.id);
    if (!snap) throw new CropNotFoundError(input.id);
    const crop = Crop.fromSnapshot(snap);
    crop.publish();
    const next = crop.toSnapshot();
    await this.crops.save(next);
    await this.audit.record({
      entityType: 'Crop',
      entityId: crop.id,
      actor: input.actor,
      at: this.clock.nowIso(),
      changes: { status: 'PUBLISHED' },
    });
    return next;
  }
}
