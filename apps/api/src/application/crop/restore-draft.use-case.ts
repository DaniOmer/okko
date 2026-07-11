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
import { rebuildCropProjections } from './rebuild-crop-projections';

export class RestoreDraftUseCase {
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

  async execute(input: { id: string; revision: number; actor: string }): Promise<CropSnapshot> {
    const stored = await this.events.load(input.id);
    if (stored.length === 0) throw new CropNotFoundError(input.id);
    const crop = Crop.fromEvents(stored);
    crop.restoreDraft(input.revision); // NoPublishedVersionError / RevisionNotFoundError
    const at = this.clock.nowIso();
    await this.events.append(input.id, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    const next = await rebuildCropProjections(crop, { crops: this.crops, varieties: this.varieties, windows: this.windows, zones: this.zones, pests: this.pests, prices: this.prices });
    await this.audit.record({ entityType: 'Crop', entityId: crop.id, actor: input.actor, at, changes: { draftRestoredFromRevision: input.revision } });
    return next;
  }
}
