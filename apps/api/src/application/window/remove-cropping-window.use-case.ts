import { Crop } from '../../domain/crop/crop';
import { CropEventStore } from '../crop/crop-event-store';
import { CroppingWindowRepository } from './cropping-window.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from '../crop/publish-crop.use-case';
import { CroppingWindowNotFoundError } from './update-cropping-window.use-case';

export interface RemoveCroppingWindowInput { cropId: string; windowId: string; actor: string; }

export class RemoveCroppingWindowUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly windows: CroppingWindowRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RemoveCroppingWindowInput): Promise<void> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromEvents(stored);
    if (!crop.windows.some((w) => w.id === input.windowId)) throw new CroppingWindowNotFoundError(input.windowId);
    crop.removeCroppingWindow(input.windowId);
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    await this.windows.replaceForCrop(input.cropId, crop.windows);
    await this.audit.record({ entityType: 'CroppingWindow', entityId: input.windowId, actor: input.actor, at, changes: { removed: { id: input.windowId } } });
  }
}
