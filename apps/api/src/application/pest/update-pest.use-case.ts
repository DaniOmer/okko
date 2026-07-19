import { PestDisease, PestDiseaseSnapshot } from '../../domain/pest/pest-disease';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { PestType } from '../../domain/pest/pest-type';
import { MediaImageJSON } from '../../domain/media/media-image';
import { PestRepository } from './pest.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export class PestNotFoundError extends Error {
  constructor(id: string) { super(`Pest not found: ${id}`); this.name = 'PestNotFoundError'; }
}

export interface UpdatePestInput {
  id: string; name: Record<string, string>; type: PestType; scientificName?: string;
  images?: MediaImageJSON[];
  actor: string;
}

export class UpdatePestUseCase {
  constructor(
    private readonly pests: PestRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdatePestInput): Promise<PestDiseaseSnapshot> {
    const existing = await this.pests.findById(input.id);
    if (!existing) throw new PestNotFoundError(input.id);
    const updated = PestDisease.fromSnapshot(existing).update({
      name: TranslatableText.create(input.name),
      type: input.type,
      scientificName: input.scientificName || undefined,
      images: input.images,
    });
    const snap = updated.toSnapshot();
    await this.pests.save(snap);
    await this.audit.record({
      entityType: 'PestDisease', entityId: snap.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { updated: snap },
    });
    return snap;
  }
}
