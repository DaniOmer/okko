import { PricePoint, PricePointSnapshot } from '../../domain/price/price-point';
import { Crop } from '../../domain/crop/crop';
import { CropEventStore } from '../crop/crop-event-store';
import { PricePointRepository } from './price-point.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';
import { CropNotFoundError } from '../crop/publish-crop.use-case';

export class InvalidPricePeriodError extends Error {
  constructor() {
    super('periodEnd must be >= periodStart');
    this.name = 'InvalidPricePeriodError';
  }
}

export interface AddPricePointInput {
  cropId: string;
  id?: string;
  market: string;
  periodStart: string;
  periodEnd?: string;
  price: number;
  unit: string;
  currency: string;
  actor: string;
}

export class AddPricePointUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly prices: PricePointRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: AddPricePointInput): Promise<PricePointSnapshot> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);

    const periodStart = input.periodStart;
    const periodEnd = input.periodEnd || input.periodStart;
    if (periodEnd < periodStart) throw new InvalidPricePeriodError();

    const point = PricePoint.create({
      id: input.id ?? this.ids.next(),
      cropId: input.cropId, market: input.market,
      periodStart, periodEnd,
      price: input.price, unit: input.unit, currency: input.currency,
    });
    const snap = point.toSnapshot();
    const crop = Crop.fromEvents(stored);
    crop.addPricePoint(snap);
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    await this.prices.save(snap);
    await this.audit.record({
      entityType: 'PricePoint', entityId: point.id, actor: input.actor,
      at, changes: { created: snap },
    });
    return snap;
  }
}
