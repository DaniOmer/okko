import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { CropRepository } from './crop.repository';
import { CropEventStore } from './crop-event-store';
import { CropNotFoundError } from './publish-crop.use-case';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { VarietyRepository } from './variety.repository';
import { CroppingWindowRepository } from '../window/cropping-window.repository';
import { CropZoneSuitabilityRepository } from '../zone/crop-zone-suitability.repository';
import { CropPestControlRepository } from '../pest/crop-pest-control.repository';
import { PricePointRepository } from '../price/price-point.repository';

export class DiscardDraftUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly crops: CropRepository,
    private readonly varieties: VarietyRepository,
    private readonly windows: CroppingWindowRepository,
    private readonly zones: CropZoneSuitabilityRepository,
    private readonly pests: CropPestControlRepository,
    private readonly prices: PricePointRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: { id: string; actor: string }): Promise<CropSnapshot> {
    const stored = await this.events.load(input.id);
    if (stored.length === 0) throw new CropNotFoundError(input.id);
    const crop = Crop.fromEvents(stored);
    crop.discardDraft(); // lève NoPublishedVersionError si jamais publié
    const at = this.clock.nowIso();
    await this.events.append(input.id, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    const next = crop.toSnapshot();
    await this.crops.save(next);
    await this.varieties.replaceForCrop(input.id, crop.varieties);
    await this.windows.replaceForCrop(input.id, crop.windows);
    await this.zones.replaceForCrop(input.id, crop.zones);
    await this.pests.replaceForCrop(input.id, crop.pests);
    await this.prices.replaceForCrop(input.id, crop.prices);
    await this.audit.record({ entityType: 'Crop', entityId: crop.id, actor: input.actor, at, changes: { draftDiscarded: true } });
    return next;
  }
}
