import { Crop } from '../../domain/crop/crop';
import { CropEventStore } from './crop-event-store';
import { VarietyRepository } from './variety.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropNotFoundError } from './publish-crop.use-case';
import { VarietyNotFoundError } from './update-variety.use-case';

export interface RemoveVarietyInput { cropId: string; varietyId: string; actor: string; }

export class RemoveVarietyUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly varieties: VarietyRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: RemoveVarietyInput): Promise<void> {
    const stored = await this.events.load(input.cropId);
    if (stored.length === 0) throw new CropNotFoundError(input.cropId);
    const crop = Crop.fromEvents(stored);
    if (!crop.varieties.some((v) => v.id === input.varietyId)) throw new VarietyNotFoundError(input.varietyId);
    crop.removeVariety(input.varietyId);
    const at = this.clock.nowIso();
    await this.events.append(input.cropId, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    await this.varieties.replaceForCrop(input.cropId, crop.varieties);
    await this.audit.record({ entityType: 'Variety', entityId: input.varietyId, actor: input.actor, at, changes: { removed: { id: input.varietyId } } });
  }
}
