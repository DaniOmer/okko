import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { CommercializationProduct, CommercializationProductJSON } from '../../domain/crop/commercialization-product';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropEventStore } from './crop-event-store';
import { CropNotFoundError } from './publish-crop.use-case';

export interface SetCropCommercializationInput { cropId: string; commercialization: CommercializationProductJSON[]; actor: string; }

export class SetCropCommercializationUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}
  async execute(input: SetCropCommercializationInput): Promise<CropSnapshot> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromEvents(stored);
    const before = crop.toSnapshot();
    crop.setCommercialization(input.commercialization.map((j) => CommercializationProduct.fromJSON(j)));
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    const next = crop.toSnapshot();
    await this.crops.save(next);
    await this.audit.record({ entityType: 'Crop', entityId: crop.id, actor: input.actor, at, changes: { commercialization: { from: before.commercialization, to: next.commercialization } } });
    return next;
  }
}
