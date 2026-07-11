import { Crop, CropSnapshot } from '../../domain/crop/crop';
import { CropRepository } from './crop.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { CropEventStore } from './crop-event-store';
import { CropDocumentComposer } from './compose-crop-document';
import { PublishedCropRepository } from './published-crop.repository';

export class CropNotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'CropNotFoundError';
  }
}

export class PublishCropUseCase {
  constructor(
    private readonly events: CropEventStore,
    private readonly crops: CropRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
    private readonly composer: CropDocumentComposer,
    private readonly published: PublishedCropRepository,
  ) {}

  async execute(input: { id: string; actor: string; note?: string }): Promise<CropSnapshot> {
    const stored = await this.events.load(input.id);
    if (stored.length === 0) throw new CropNotFoundError(input.id);
    const crop = Crop.fromEvents(stored);
    crop.publish();
    const at = this.clock.nowIso();
    await this.events.append(input.id, stored.length, crop.pullPendingEvents().map((event) => ({ event, actor: input.actor, at })));
    const next = crop.toSnapshot();
    await this.crops.save(next);
    const document = await this.composer.compose(input.id, next);
    const latest = await this.published.findLatest(input.id);
    const revision = latest ? latest.revision + 1 : 1;
    const note = input.note?.trim() || null;
    await this.published.save({ cropId: input.id, revision, document, version: next.version, publishedAt: at, publishedBy: input.actor, note });
    await this.audit.record({
      entityType: 'Crop',
      entityId: crop.id,
      actor: input.actor,
      at,
      changes: { status: 'PUBLISHED' },
    });
    return next;
  }
}
