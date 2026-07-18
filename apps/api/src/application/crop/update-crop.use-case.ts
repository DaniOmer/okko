import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropEventStore } from './crop-event-store';
import { CropNotFoundError } from './publish-crop.use-case';
import { CycleType } from '../../domain/crop/cycle-type';

export interface UpdateCropInput {
  id: string;
  commonNames?: Record<string, string>;
  metadata?: Record<string, unknown>;
  scientificName?: string;
  family?: string;
  cycleType?: CycleType;
  usageCategory?: string;
  description?: Record<string, string>;
  actor: string;
}

export class UpdateCropUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateCropInput): Promise<CropSnapshot> {
    const stored = await this.events.load(input.id);
    if (stored.length === 0) throw new CropNotFoundError(input.id);
    const crop = Crop.fromEvents(stored);
    const before = crop.toSnapshot();
    if (input.commonNames) crop.rename(TranslatableText.create(input.commonNames));
    if (input.metadata) {
      for (const [k, v] of Object.entries(input.metadata)) crop.setMetadata(k, v);
    }
    if (input.scientificName !== undefined || input.family !== undefined || input.cycleType !== undefined || input.usageCategory !== undefined || input.description !== undefined) {
      crop.editIdentity({
        scientificName: input.scientificName ?? before.scientificName,
        family: input.family ?? before.family,
        cycleType: (input.cycleType ?? before.cycleType) as CycleType,
        usageCategory: input.usageCategory,
        description: input.description,
      });
    }
    const at = this.clock.nowIso();
    await this.events.append(input.id, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    const next = crop.toSnapshot();
    await this.crops.save(next);
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (input.commonNames) changes.commonNames = { from: before.commonNames, to: next.commonNames };
    if (input.metadata !== undefined) changes.metadata = { from: before.metadata, to: next.metadata };
    if (input.scientificName !== undefined || input.family !== undefined || input.cycleType !== undefined || input.usageCategory !== undefined || input.description !== undefined) changes.identity = { from: { scientificName: before.scientificName, family: before.family, cycleType: before.cycleType, usageCategory: before.usageCategory, description: before.description }, to: { scientificName: next.scientificName, family: next.family, cycleType: next.cycleType, usageCategory: next.usageCategory, description: next.description } };
    await this.audit.record({
      entityType: 'Crop',
      entityId: crop.id,
      actor: input.actor,
      at,
      changes,
    });
    return next;
  }
}
