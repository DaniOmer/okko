import { CropZoneSuitability, CropZoneSuitabilitySnapshot } from '../../domain/zone/crop-zone-suitability';
import { SuitabilityRating } from '../../domain/zone/suitability-rating';
import { CropRepository } from '../crop/crop.repository';
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
}

export class SetCropZoneSuitabilityUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly zones: ZoneRepository,
    private readonly suitabilities: CropZoneSuitabilityRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetCropZoneSuitabilityInput): Promise<CropZoneSuitabilitySnapshot> {
    if (!(await this.crops.findById(input.cropId))) throw new CropNotFoundError(input.cropId);
    if (!(await this.zones.findById(input.zoneId))) throw new ZoneNotFoundError(input.zoneId);
    const suitability = CropZoneSuitability.create({
      cropId: input.cropId, zoneId: input.zoneId, rating: input.rating, justification: input.justification,
    });
    const snap = suitability.toSnapshot();
    await this.suitabilities.save(snap);
    await this.audit.record({
      entityType: 'CropZoneSuitability', entityId: `${input.cropId}:${input.zoneId}`,
      actor: input.actor, at: this.clock.nowIso(), changes: { set: snap },
    });
    return snap;
  }
}
