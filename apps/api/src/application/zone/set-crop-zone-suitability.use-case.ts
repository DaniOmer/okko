import { CropZoneSuitability, CropZoneSuitabilitySnapshot } from '../../domain/zone/crop-zone-suitability';
import { SuitabilityRating } from '../../domain/zone/suitability-rating';
import { Provenance, ProvenanceProps } from '../../domain/shared/provenance';
import { Crop } from '../../domain/crop/crop';
import { CropEventStore } from '../crop/crop-event-store';
import { ZoneRepository } from './zone.repository';
import { CropZoneSuitabilityRepository } from './crop-zone-suitability.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from '../crop/publish-crop.use-case';

export class ZoneNotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'ZoneNotFoundError';
  }
}

export interface SetCropZoneSuitabilityInput {
  cropId: string;
  zoneId: string;
  rating: SuitabilityRating;
  justification?: string;
  actor: string;
  provenance?: ProvenanceProps;
}

export class SetCropZoneSuitabilityUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly zones: ZoneRepository,
    private readonly suitabilities: CropZoneSuitabilityRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetCropZoneSuitabilityInput): Promise<CropZoneSuitabilitySnapshot> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    if (!(await this.zones.findById(input.zoneId))) throw new ZoneNotFoundError(input.zoneId);
    const provenance = input.provenance
      ? Provenance.fromJSON(input.provenance)
      : Provenance.manual(input.actor, this.clock.nowIso());
    const suitability = CropZoneSuitability.create({
      cropId: input.cropId, zoneId: input.zoneId, rating: input.rating, justification: input.justification,
      provenance,
    });
    const snap = suitability.toSnapshot();
    const crop = Crop.fromEvents(stored);
    crop.setZoneSuitability(snap);
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    await this.suitabilities.save(snap);
    await this.audit.record({
      entityType: 'CropZoneSuitability', entityId: `${input.cropId}:${input.zoneId}`,
      actor: input.actor, at, changes: { set: snap },
    });
    return snap;
  }
}
