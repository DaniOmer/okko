import { Crop } from '../../domain/crop/crop';
import { CropEventStore } from '../crop/crop-event-store';
import { CropZoneSuitabilityRepository } from './crop-zone-suitability.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from '../crop/publish-crop.use-case';

export class ZoneSuitabilityNotFoundError extends Error {
  constructor(id: string) { super(`Zone suitability not found: ${id}`); this.name = 'ZoneSuitabilityNotFoundError'; }
}

export interface RemoveCropZoneSuitabilityInput { cropId: string; zoneId: string; actor: string; }

export class RemoveCropZoneSuitabilityUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly suitabilities: CropZoneSuitabilityRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RemoveCropZoneSuitabilityInput): Promise<void> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromEvents(stored);
    if (!crop.zones.some((z) => z.zoneId === input.zoneId)) throw new ZoneSuitabilityNotFoundError(input.zoneId);
    crop.removeZoneSuitability(input.zoneId);
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    await this.suitabilities.replaceForCrop(input.cropId, crop.zones);
    await this.audit.record({ entityType: 'CropZoneSuitability', entityId: `${input.cropId}:${input.zoneId}`, actor: input.actor, at, changes: { removed: { zoneId: input.zoneId } } });
  }
}
