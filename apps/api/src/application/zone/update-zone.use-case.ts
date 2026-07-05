import { AgroEcologicalZone, ZoneSnapshot } from '../../domain/zone/agro-ecological-zone';
import { TranslatableText } from '../../domain/shared/translatable-text';
import { ZoneRepository } from './zone.repository';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export class ZoneNotFoundError extends Error {
  constructor(id: string) { super(`Zone not found: ${id}`); this.name = 'ZoneNotFoundError'; }
}

export interface UpdateZoneInput {
  id: string; name: Record<string, string>; country: string; koppen?: string; actor: string;
}

export class UpdateZoneUseCase {
  constructor(
    private readonly zones: ZoneRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: UpdateZoneInput): Promise<ZoneSnapshot> {
    const existing = await this.zones.findById(input.id);
    if (!existing) throw new ZoneNotFoundError(input.id);
    const updated = AgroEcologicalZone.fromSnapshot(existing).update({
      name: TranslatableText.create(input.name),
      country: input.country,
      koppen: input.koppen || undefined,
    });
    const snap = updated.toSnapshot();
    await this.zones.save(snap);
    await this.audit.record({
      entityType: 'AgroEcologicalZone', entityId: snap.id, actor: input.actor,
      at: this.clock.nowIso(), changes: { updated: snap },
    });
    return snap;
  }
}
