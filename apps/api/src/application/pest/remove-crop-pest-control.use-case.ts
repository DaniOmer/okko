import { Crop } from '../../domain/crop/crop';
import { CropEventStore } from '../crop/crop-event-store';
import { CropPestControlRepository } from './crop-pest-control.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from '../crop/publish-crop.use-case';

export class PestControlNotFoundError extends Error {
  constructor(id: string) { super(`Pest control not found: ${id}`); this.name = 'PestControlNotFoundError'; }
}

export interface RemoveCropPestControlInput { cropId: string; pestId: string; actor: string; }

export class RemoveCropPestControlUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly controls: CropPestControlRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RemoveCropPestControlInput): Promise<void> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromEvents(stored);
    if (!crop.pests.some((p) => p.pestId === input.pestId)) throw new PestControlNotFoundError(input.pestId);
    crop.removePestControl(input.pestId);
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    await this.controls.replaceForCrop(input.cropId, crop.pests);
    await this.audit.record({ entityType: 'CropPestControl', entityId: `${input.cropId}:${input.pestId}`, actor: input.actor, at, changes: { removed: { pestId: input.pestId } } });
  }
}
