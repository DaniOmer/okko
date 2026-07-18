import { PricePoint, PricePointSnapshot } from '../../domain/price/price-point';
import { Crop } from '../../domain/crop/crop';
import { CropEventStore } from '../crop/crop-event-store';
import { PricePointRepository } from './price-point.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from '../crop/publish-crop.use-case';
import { InvalidPricePeriodError } from './add-price-point.use-case';

export class PricePointNotFoundError extends Error {
  constructor(id: string) { super(`PricePoint not found: ${id}`); this.name = 'PricePointNotFoundError'; }
}

export interface UpdatePricePointInput {
  cropId: string;
  priceId: string;
  form: string;
  market: string;
  periodStart: string;
  periodEnd?: string;
  price: number;
  unit: string;
  currency: string;
  actor: string;
}

export class UpdatePricePointUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly prices: PricePointRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdatePricePointInput): Promise<PricePointSnapshot> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromEvents(stored);
    if (!crop.prices.some((p) => p.id === input.priceId)) throw new PricePointNotFoundError(input.priceId);

    const periodStart = input.periodStart;
    const periodEnd = input.periodEnd || input.periodStart;
    if (periodEnd < periodStart) throw new InvalidPricePeriodError();

    const point = PricePoint.create({
      id: input.priceId,
      cropId: input.cropId,
      form: input.form,
      market: input.market,
      periodStart,
      periodEnd,
      price: input.price,
      unit: input.unit,
      currency: input.currency,
    });
    const snap = point.toSnapshot();
    crop.updatePricePoint(snap);
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    await this.prices.save(snap);
    await this.audit.record({ entityType: 'PricePoint', entityId: input.priceId, actor: input.actor, at, changes: { updated: snap } });
    return snap;
  }
}
