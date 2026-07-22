import { Pest, PestSnapshot } from '../../domain/pest/pest';
import { PestType } from '../../domain/pest/pest-type';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { MediaImageJSON } from '../../domain/media/media-image';
import { PestRepository } from './pest.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';
import { IdGenerator } from '../shared/id-generator';

export interface CreatePestInput {
  id?: string;
  name: Record<string, string>;
  type: PestType;
  scientificName?: string;
  symptoms?: Record<string, string>;
  images?: MediaImageJSON[];
  notes?: string;
  actor: string;
}

export class CreatePestUseCase {
  constructor(
    private readonly pests: PestRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreatePestInput): Promise<PestSnapshot> {
    const pest = Pest.create({
      id: input.id ?? this.ids.next(),
      name: TranslatableText.create(input.name),
      type: input.type,
      scientificName: input.scientificName,
      symptoms: input.symptoms ? TranslatableText.create(input.symptoms) : undefined,
      images: input.images,
      notes: input.notes,
    });
    const snap = pest.toSnapshot();
    await this.pests.save(snap);
    await this.audit.record({
      entityType: 'Pest', entityId: pest.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { created: snap },
    });
    return snap;
  }
}
