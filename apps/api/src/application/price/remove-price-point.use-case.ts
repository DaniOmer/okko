import { Crop } from '../../domain/crop/crop';
import { CropEventStore } from '../crop/crop-event-store';
import { PricePointRepository } from './price-point.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from '../crop/publish-crop.use-case';
import { PricePointNotFoundError } from './update-price-point.use-case';

export interface RemovePricePointInput { cropId: string; priceId: string; actor: string; }

export class RemovePricePointUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly prices: PricePointRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RemovePricePointInput): Promise<void> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromEvents(stored);
    if (!crop.prices.some((p) => p.id === input.priceId)) throw new PricePointNotFoundError(input.priceId);
    crop.removePricePoint(input.priceId);
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    await this.prices.replaceForCrop(input.cropId, crop.prices);
    await this.audit.record({ entityType: 'PricePoint', entityId: input.priceId, actor: input.actor, at, changes: { removed: { id: input.priceId } } });
  }
}
