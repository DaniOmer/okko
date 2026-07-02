import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from './publish-crop.use-case';

export interface UpdateCropInput {
  id: string;
  commonNames?: Record<string, string>;
  metadata?: Record<string, unknown>;
  actor: string;
}

export class UpdateCropUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateCropInput): Promise<CropSnapshot> {
    const snap = await this.crops.findById(input.id);
    if (!snap) throw new CropNotFoundError(input.id);
    const crop = Crop.fromSnapshot(snap);
    if (input.commonNames) crop.rename(TranslatableText.create(input.commonNames));
    if (input.metadata) {
      for (const [k, v] of Object.entries(input.metadata)) crop.setMetadata(k, v);
    }
    const next = crop.toSnapshot();
    await this.crops.save(next);
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (input.commonNames) changes.commonNames = { from: snap.commonNames, to: next.commonNames };
    if (input.metadata !== undefined) changes.metadata = { from: snap.metadata, to: next.metadata };
    await this.audit.record({
      entityType: 'Crop',
      entityId: crop.id,
      actor: input.actor,
      at: this.clock.nowIso(),
      changes,
    });
    return next;
  }
}
